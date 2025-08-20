import { 
    generateJoinToken, 
    createRoomIfNotExists, 
    deleteRoom,
    getRoomStats,
    listParticipants,
    removeParticipant,
    muteParticipantAudio,
    muteParticipantVideo,
    sendData,
    updateParticipantMetadata
} from './liveket';
import RedisVideoService from './redis-enhanced';
import { Room } from '../models/Room';
import { Participant } from '../models/Participant';
import { Session } from '../models/Session';
import { v4 as uuidv4 } from 'uuid';

// Interfaces for live streaming
export interface StreamConfig {
    streamId: string;
    roomId: string;
    title: string;
    description?: string;
    isLive: boolean;
    isRecording: boolean;
    quality: 'low' | 'medium' | 'high' | 'ultra';
    maxViewers: number;
    currentViewers: number;
    streamKey: string;
    rtmpUrl?: string;
    hlsUrl?: string;
    webRtcUrl?: string;
    settings: {
        enableChat: boolean;
        enableScreenShare: boolean;
        enableRecording: boolean;
        enableModeration: boolean;
        allowViewerInteraction: boolean;
        autoRecord: boolean;
        streamDelay: number; // in seconds
        maxBitrate: number; // in kbps
        resolution: {
            width: number;
            height: number;
        };
    };
    metadata: Record<string, any>;
    startedAt?: Date;
    endedAt?: Date;
    duration: number; // in seconds
    status: 'preparing' | 'live' | 'paused' | 'ended' | 'error';
}

export interface StreamStats {
    streamId: string;
    roomId: string;
    viewerCount: number;
    peakViewers: number;
    averageWatchTime: number;
    chatMessages: number;
    recordingSize: number;
    bandwidth: {
        incoming: number;
        outgoing: number;
    };
    quality: {
        fps: number;
        bitrate: number;
        resolution: string;
        latency: number;
    };
    errors: number;
    uptime: number;
}

export interface StreamEvent {
    eventId: string;
    streamId: string;
    type: 'start' | 'stop' | 'pause' | 'resume' | 'error' | 'viewer_join' | 'viewer_leave' | 'chat_message' | 'quality_change';
    data: Record<string, any>;
    timestamp: Date;
}

export class LiveStreamService {
    
    /**
     * Create a new live stream
     */
    static async createStream(streamData: {
        roomId: string;
        title: string;
        description?: string;
        quality?: 'low' | 'medium' | 'high' | 'ultra';
        maxViewers?: number;
        settings?: Partial<StreamConfig['settings']>;
        metadata?: Record<string, any>;
    }): Promise<StreamConfig> {
        try {
            const streamId = uuidv4();
            const streamKey = this.generateStreamKey();
            
            // Create stream configuration
            const streamConfig: StreamConfig = {
                streamId,
                roomId: streamData.roomId,
                title: streamData.title,
                description: streamData.description,
                isLive: false,
                isRecording: false,
                quality: streamData.quality || 'medium',
                maxViewers: streamData.maxViewers || 1000,
                currentViewers: 0,
                streamKey,
                settings: {
                    enableChat: true,
                    enableScreenShare: true,
                    enableRecording: true,
                    enableModeration: false,
                    allowViewerInteraction: true,
                    autoRecord: false,
                    streamDelay: 2,
                    maxBitrate: this.getBitrateForQuality(streamData.quality || 'medium'),
                    resolution: this.getResolutionForQuality(streamData.quality || 'medium'),
                    ...streamData.settings
                },
                metadata: streamData.metadata || {},
                status: 'preparing',
                duration: 0
            };

            // Cache stream configuration in Redis
            await RedisVideoService.setCache(`stream:${streamId}`, streamConfig, 86400); // 24 hours

            // Create stream room in LiveKit if it doesn't exist
            await createRoomIfNotExists(streamId, {
                name: streamData.title,
                maxParticipants: streamConfig.maxViewers
            });

            console.log(`🎥 Created live stream: ${streamId}`);
            return streamConfig;
        } catch (error) {
            console.error('❌ Failed to create live stream:', error);
            throw error;
        }
    }

    /**
     * Start a live stream
     */
    static async startStream(streamId: string, hostData: {
        identity: string;
        name: string;
        email?: string;
    }): Promise<{
        streamConfig: StreamConfig;
        hostToken: string;
        rtmpUrl: string;
        streamKey: string;
    }> {
        try {
            // Get stream configuration
            const streamConfig = await RedisVideoService.getCache(`stream:${streamId}`);
            if (!streamConfig) {
                throw new Error('Stream not found');
            }

            if (streamConfig.status === 'live') {
                throw new Error('Stream is already live');
            }

            // Generate host token
            const hostToken = await generateJoinToken({
                identity: hostData.identity,
                room: streamId,
                metadata: {
                    name: hostData.name,
                    email: hostData.email,
                    role: 'host',
                    isStreamer: true
                }
            });

            // Update stream status
            const updatedConfig: StreamConfig = {
                ...streamConfig,
                isLive: true,
                status: 'live',
                startedAt: new Date(),
                rtmpUrl: this.generateRtmpUrl(streamId),
                hlsUrl: this.generateHlsUrl(streamId),
                webRtcUrl: this.generateWebRtcUrl(streamId)
            };

            // Cache updated configuration
            await RedisVideoService.setCache(`stream:${streamId}`, updatedConfig, 86400);

            // Log stream start event
            await this.logStreamEvent(streamId, 'start', {
                host: hostData.identity,
                quality: updatedConfig.quality,
                settings: updatedConfig.settings
            });

            console.log(`🎬 Started live stream: ${streamId}`);
            return {
                streamConfig: updatedConfig,
                hostToken,
                rtmpUrl: updatedConfig.rtmpUrl!,
                streamKey: updatedConfig.streamKey
            };
        } catch (error) {
            console.error('❌ Failed to start live stream:', error);
            throw error;
        }
    }

    /**
     * Stop a live stream
     */
    static async stopStream(streamId: string): Promise<boolean> {
        try {
            // Get stream configuration
            const streamConfig = await RedisVideoService.getCache(`stream:${streamId}`);
            if (!streamConfig) {
                throw new Error('Stream not found');
            }

            if (streamConfig.status !== 'live') {
                throw new Error('Stream is not live');
            }

            // Calculate duration
            const duration = streamConfig.startedAt 
                ? Math.floor((Date.now() - streamConfig.startedAt.getTime()) / 1000)
                : 0;

            // Update stream status
            const updatedConfig: StreamConfig = {
                ...streamConfig,
                isLive: false,
                isRecording: false,
                status: 'ended',
                endedAt: new Date(),
                duration
            };

            // Cache updated configuration
            await RedisVideoService.setCache(`stream:${streamId}`, updatedConfig, 86400);

            // Log stream end event
            await this.logStreamEvent(streamId, 'stop', {
                duration,
                finalViewerCount: streamConfig.currentViewers
            });

            console.log(`⏹️ Stopped live stream: ${streamId} (duration: ${duration}s)`);
            return true;
        } catch (error) {
            console.error('❌ Failed to stop live stream:', error);
            throw error;
        }
    }

    /**
     * Pause a live stream
     */
    static async pauseStream(streamId: string): Promise<boolean> {
        try {
            const streamConfig = await RedisVideoService.getCache(`stream:${streamId}`);
            if (!streamConfig || streamConfig.status !== 'live') {
                throw new Error('Stream is not live');
            }

            const updatedConfig: StreamConfig = {
                ...streamConfig,
                status: 'paused'
            };

            await RedisVideoService.setCache(`stream:${streamId}`, updatedConfig, 86400);
            await this.logStreamEvent(streamId, 'pause', {});

            console.log(`⏸️ Paused live stream: ${streamId}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to pause live stream:', error);
            throw error;
        }
    }

    /**
     * Resume a paused stream
     */
    static async resumeStream(streamId: string): Promise<boolean> {
        try {
            const streamConfig = await RedisVideoService.getCache(`stream:${streamId}`);
            if (!streamConfig || streamConfig.status !== 'paused') {
                throw new Error('Stream is not paused');
            }

            const updatedConfig: StreamConfig = {
                ...streamConfig,
                status: 'live'
            };

            await RedisVideoService.setCache(`stream:${streamId}`, updatedConfig, 86400);
            await this.logStreamEvent(streamId, 'resume', {});

            console.log(`▶️ Resumed live stream: ${streamId}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to resume live stream:', error);
            throw error;
        }
    }

    /**
     * Get stream configuration
     */
    static async getStream(streamId: string): Promise<StreamConfig | null> {
        try {
            const streamConfig = await RedisVideoService.getCache(`stream:${streamId}`);
            return streamConfig;
        } catch (error) {
            console.error(`❌ Failed to get stream ${streamId}:`, error);
            return null;
        }
    }

    /**
     * Update stream configuration
     */
    static async updateStream(streamId: string, updates: Partial<StreamConfig>): Promise<StreamConfig | null> {
        try {
            const streamConfig = await RedisVideoService.getCache(`stream:${streamId}`);
            if (!streamConfig) {
                throw new Error('Stream not found');
            }

            const updatedConfig: StreamConfig = {
                ...streamConfig,
                ...updates
            };

            await RedisVideoService.setCache(`stream:${streamId}`, updatedConfig, 86400);
            console.log(`📝 Updated stream configuration: ${streamId}`);
            return updatedConfig;
        } catch (error) {
            console.error(`❌ Failed to update stream ${streamId}:`, error);
            return null;
        }
    }

    /**
     * Get stream statistics
     */
    static async getStreamStats(streamId: string): Promise<StreamStats | null> {
        try {
            const streamConfig = await RedisVideoService.getCache(`stream:${streamId}`);
            if (!streamConfig) {
                return null;
            }

            // Get LiveKit room stats
            const roomStats = await getRoomStats(streamId);
            
            // Get viewer count from Redis
            const viewerCount = await RedisVideoService.getCache(`stream:${streamId}:viewers`) || 0;
            
            // Get peak viewers
            const peakViewers = await RedisVideoService.getCache(`stream:${streamId}:peak_viewers`) || 0;

            const stats: StreamStats = {
                streamId,
                roomId: streamConfig.roomId,
                viewerCount,
                peakViewers,
                averageWatchTime: 0, // Calculate from analytics
                chatMessages: await RedisVideoService.getCache(`stream:${streamId}:chat_count`) || 0,
                recordingSize: await RedisVideoService.getCache(`stream:${streamId}:recording_size`) || 0,
                bandwidth: {
                    incoming: 0, // Will be calculated from actual stream data
                    outgoing: 0
                },
                quality: {
                    fps: 30,
                    bitrate: streamConfig.settings.maxBitrate,
                    resolution: `${streamConfig.settings.resolution.width}x${streamConfig.settings.resolution.height}`,
                    latency: streamConfig.settings.streamDelay * 1000
                },
                errors: await RedisVideoService.getCache(`stream:${streamId}:errors`) || 0,
                uptime: streamConfig.duration
            };

            return stats;
        } catch (error) {
            console.error(`❌ Failed to get stream stats ${streamId}:`, error);
            return null;
        }
    }

    /**
     * Add viewer to stream
     */
    static async addViewer(streamId: string, viewerData: {
        identity: string;
        name: string;
        email?: string;
    }): Promise<{
        token: string;
        viewerCount: number;
    }> {
        try {
            const streamConfig = await RedisVideoService.getCache(`stream:${streamId}`);
            if (!streamConfig || streamConfig.status !== 'live') {
                throw new Error('Stream is not live');
            }

            if (streamConfig.currentViewers >= streamConfig.maxViewers) {
                throw new Error('Stream is at maximum capacity');
            }

            // Generate viewer token
            const token = await generateJoinToken({
                identity: viewerData.identity,
                room: streamId,
                metadata: {
                    name: viewerData.name,
                    email: viewerData.email,
                    role: 'viewer',
                    isStreamer: false
                }
            });

            // Increment viewer count
            const newViewerCount = streamConfig.currentViewers + 1;
            const updatedConfig: StreamConfig = {
                ...streamConfig,
                currentViewers: newViewerCount
            };

            await RedisVideoService.setCache(`stream:${streamId}`, updatedConfig, 86400);
            await RedisVideoService.setCache(`stream:${streamId}:viewers`, newViewerCount, 3600);

            // Update peak viewers if necessary
            const peakViewers = await RedisVideoService.getCache(`stream:${streamId}:peak_viewers`) || 0;
            if (newViewerCount > peakViewers) {
                await RedisVideoService.setCache(`stream:${streamId}:peak_viewers`, newViewerCount, 86400);
            }

            // Log viewer join event
            await this.logStreamEvent(streamId, 'viewer_join', {
                viewer: viewerData.identity,
                viewerCount: newViewerCount
            });

            console.log(`👤 Viewer joined stream: ${viewerData.identity} (total: ${newViewerCount})`);
            return {
                token,
                viewerCount: newViewerCount
            };
        } catch (error) {
            console.error('❌ Failed to add viewer:', error);
            throw error;
        }
    }

    /**
     * Remove viewer from stream
     */
    static async removeViewer(streamId: string, viewerIdentity: string): Promise<boolean> {
        try {
            const streamConfig = await RedisVideoService.getCache(`stream:${streamId}`);
            if (!streamConfig) {
                return false;
            }

            // Decrement viewer count
            const newViewerCount = Math.max(0, streamConfig.currentViewers - 1);
            const updatedConfig: StreamConfig = {
                ...streamConfig,
                currentViewers: newViewerCount
            };

            await RedisVideoService.setCache(`stream:${streamId}`, updatedConfig, 86400);
            await RedisVideoService.setCache(`stream:${streamId}:viewers`, newViewerCount, 3600);

            // Log viewer leave event
            await this.logStreamEvent(streamId, 'viewer_leave', {
                viewer: viewerIdentity,
                viewerCount: newViewerCount
            });

            console.log(`🚪 Viewer left stream: ${viewerIdentity} (total: ${newViewerCount})`);
            return true;
        } catch (error) {
            console.error('❌ Failed to remove viewer:', error);
            return false;
        }
    }

    /**
     * Send chat message in stream
     */
    static async sendChatMessage(streamId: string, messageData: {
        sender: string;
        message: string;
        type?: 'text' | 'emoji' | 'system';
    }): Promise<boolean> {
        try {
            const streamConfig = await RedisVideoService.getCache(`stream:${streamId}`);
            if (!streamConfig || !streamConfig.settings.enableChat) {
                return false;
            }

            // Increment chat message count
            const currentCount = await RedisVideoService.getCache(`stream:${streamId}:chat_count`) || 0;
            await RedisVideoService.setCache(`stream:${streamId}:chat_count`, currentCount + 1, 3600);

            // Send message to all participants
            const message = {
                id: uuidv4(),
                sender: messageData.sender,
                message: messageData.message,
                type: messageData.type || 'text',
                timestamp: new Date().toISOString()
            };

            await sendData(streamId, new TextEncoder().encode(JSON.stringify(message)), 'chat');

            console.log(`💬 Chat message sent: ${messageData.sender}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send chat message:', error);
            return false;
        }
    }

    /**
     * Start recording stream
     */
    static async startRecording(streamId: string): Promise<boolean> {
        try {
            const streamConfig = await RedisVideoService.getCache(`stream:${streamId}`);
            if (!streamConfig || streamConfig.status !== 'live') {
                throw new Error('Stream is not live');
            }

            if (streamConfig.isRecording) {
                throw new Error('Recording is already active');
            }

            const updatedConfig: StreamConfig = {
                ...streamConfig,
                isRecording: true
            };

            await RedisVideoService.setCache(`stream:${streamId}`, updatedConfig, 86400);
            await this.logStreamEvent(streamId, 'recording_start', {});

            console.log(`🎥 Started recording stream: ${streamId}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            throw error;
        }
    }

    /**
     * Stop recording stream
     */
    static async stopRecording(streamId: string, recordingUrl?: string): Promise<boolean> {
        try {
            const streamConfig = await RedisVideoService.getCache(`stream:${streamId}`);
            if (!streamConfig || !streamConfig.isRecording) {
                throw new Error('Recording is not active');
            }

            const updatedConfig: StreamConfig = {
                ...streamConfig,
                isRecording: false
            };

            await RedisVideoService.setCache(`stream:${streamId}`, updatedConfig, 86400);
            await this.logStreamEvent(streamId, 'recording_stop', { recordingUrl });

            console.log(`⏹️ Stopped recording stream: ${streamId}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to stop recording:', error);
            throw error;
        }
    }

    /**
     * Get stream events
     */
    static async getStreamEvents(streamId: string, limit: number = 100): Promise<StreamEvent[]> {
        try {
            const events = await RedisVideoService.getAnalyticsEvents(streamId, limit);
            return events.filter(event => event.eventType.startsWith('stream_'));
        } catch (error) {
            console.error(`❌ Failed to get stream events ${streamId}:`, error);
            return [];
        }
    }

    /**
     * Log stream event
     */
    private static async logStreamEvent(streamId: string, type: string, data: Record<string, any>): Promise<void> {
        try {
            const event: StreamEvent = {
                eventId: uuidv4(),
                streamId,
                type: type as StreamEvent['type'],
                data,
                timestamp: new Date()
            };

            await RedisVideoService.logAnalyticsEvent({
                eventType: `stream_${type}`,
                roomId: streamId,
                data: event
            });
        } catch (error) {
            console.error('❌ Failed to log stream event:', error);
        }
    }

    /**
     * Generate stream key
     */
    private static generateStreamKey(): string {
        return `live_${uuidv4().replace(/-/g, '')}`;
    }

    /**
     * Generate RTMP URL
     */
    private static generateRtmpUrl(streamId: string): string {
        return `rtmp://live.example.com/live/${streamId}`;
    }

    /**
     * Generate HLS URL
     */
    private static generateHlsUrl(streamId: string): string {
        return `https://live.example.com/hls/${streamId}/index.m3u8`;
    }

    /**
     * Generate WebRTC URL
     */
    private static generateWebRtcUrl(streamId: string): string {
        return `wss://live.example.com/webrtc/${streamId}`;
    }

    /**
     * Get bitrate for quality
     */
    private static getBitrateForQuality(quality: string): number {
        switch (quality) {
            case 'low': return 500;
            case 'medium': return 1500;
            case 'high': return 3000;
            case 'ultra': return 6000;
            default: return 1500;
        }
    }

    /**
     * Get resolution for quality
     */
    private static getResolutionForQuality(quality: string): { width: number; height: number } {
        switch (quality) {
            case 'low': return { width: 640, height: 360 };
            case 'medium': return { width: 1280, height: 720 };
            case 'high': return { width: 1920, height: 1080 };
            case 'ultra': return { width: 2560, height: 1440 };
            default: return { width: 1280, height: 720 };
        }
    }
}

export default LiveStreamService;
