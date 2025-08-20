import { Request, Response } from 'express';
import LiveStreamService, { StreamConfig, StreamStats } from '../services/liveStreamService';
import RedisVideoService from '../services/redis-enhanced';

export class LiveStreamController {
    
    /**
     * Create a new live stream
     * POST /api/streams
     */
    static async createStream(req: Request, res: Response): Promise<void> {
        try {
            const {
                roomId,
                title,
                description,
                quality = 'medium',
                maxViewers = 1000,
                settings = {},
                metadata = {}
            } = req.body;

            const createdBy = req.user?.id || req.body.createdBy;

            if (!createdBy) {
                res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
                return;
            }

            if (!title || title.trim().length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Stream title is required'
                });
                return;
            }

            const streamConfig = await LiveStreamService.createStream({
                roomId,
                title: title.trim(),
                description: description?.trim(),
                quality,
                maxViewers,
                settings,
                metadata: {
                    ...metadata,
                    createdBy
                }
            });

            res.status(201).json({
                success: true,
                message: 'Live stream created successfully',
                data: {
                    streamId: streamConfig.streamId,
                    title: streamConfig.title,
                    description: streamConfig.description,
                    quality: streamConfig.quality,
                    maxViewers: streamConfig.maxViewers,
                    streamKey: streamConfig.streamKey,
                    status: streamConfig.status,
                    settings: streamConfig.settings
                }
            });

        } catch (error) {
            console.error('❌ Error creating live stream:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create live stream',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Start a live stream
     * POST /api/streams/:streamId/start
     */
    static async startStream(req: Request, res: Response): Promise<void> {
        try {
            const { streamId } = req.params;
            const { identity, name, email } = req.body;

            if (!identity || !name) {
                res.status(400).json({
                    success: false,
                    message: 'Identity and name are required'
                });
                return;
            }

            const result = await LiveStreamService.startStream(streamId, {
                identity,
                name,
                email
            });

            res.json({
                success: true,
                message: 'Live stream started successfully',
                data: {
                    streamId,
                    hostToken: result.hostToken,
                    rtmpUrl: result.rtmpUrl,
                    streamKey: result.streamKey,
                    hlsUrl: result.streamConfig.hlsUrl,
                    webRtcUrl: result.streamConfig.webRtcUrl,
                    status: result.streamConfig.status,
                    startedAt: result.streamConfig.startedAt
                }
            });

        } catch (error) {
            console.error('❌ Error starting live stream:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to start live stream',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Stop a live stream
     * POST /api/streams/:streamId/stop
     */
    static async stopStream(req: Request, res: Response): Promise<void> {
        try {
            const { streamId } = req.params;

            const success = await LiveStreamService.stopStream(streamId);

            if (success) {
                res.json({
                    success: true,
                    message: 'Live stream stopped successfully',
                    data: { streamId }
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Failed to stop live stream'
                });
            }

        } catch (error) {
            console.error('❌ Error stopping live stream:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to stop live stream',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Pause a live stream
     * POST /api/streams/:streamId/pause
     */
    static async pauseStream(req: Request, res: Response): Promise<void> {
        try {
            const { streamId } = req.params;

            const success = await LiveStreamService.pauseStream(streamId);

            if (success) {
                res.json({
                    success: true,
                    message: 'Live stream paused successfully',
                    data: { streamId }
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Failed to pause live stream'
                });
            }

        } catch (error) {
            console.error('❌ Error pausing live stream:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to pause live stream',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Resume a live stream
     * POST /api/streams/:streamId/resume
     */
    static async resumeStream(req: Request, res: Response): Promise<void> {
        try {
            const { streamId } = req.params;

            const success = await LiveStreamService.resumeStream(streamId);

            if (success) {
                res.json({
                    success: true,
                    message: 'Live stream resumed successfully',
                    data: { streamId }
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Failed to resume live stream'
                });
            }

        } catch (error) {
            console.error('❌ Error resuming live stream:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to resume live stream',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get stream information
     * GET /api/streams/:streamId
     */
    static async getStream(req: Request, res: Response): Promise<void> {
        try {
            const { streamId } = req.params;

            const streamConfig = await LiveStreamService.getStream(streamId);

            if (!streamConfig) {
                res.status(404).json({
                    success: false,
                    message: 'Stream not found'
                });
                return;
            }

            res.json({
                success: true,
                data: {
                    streamId: streamConfig.streamId,
                    title: streamConfig.title,
                    description: streamConfig.description,
                    isLive: streamConfig.isLive,
                    isRecording: streamConfig.isRecording,
                    quality: streamConfig.quality,
                    maxViewers: streamConfig.maxViewers,
                    currentViewers: streamConfig.currentViewers,
                    status: streamConfig.status,
                    startedAt: streamConfig.startedAt,
                    endedAt: streamConfig.endedAt,
                    duration: streamConfig.duration,
                    settings: streamConfig.settings,
                    rtmpUrl: streamConfig.rtmpUrl,
                    hlsUrl: streamConfig.hlsUrl,
                    webRtcUrl: streamConfig.webRtcUrl
                }
            });

        } catch (error) {
            console.error('❌ Error fetching stream:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch stream',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Update stream configuration
     * PUT /api/streams/:streamId
     */
    static async updateStream(req: Request, res: Response): Promise<void> {
        try {
            const { streamId } = req.params;
            const updates = req.body;

            // Only allow certain fields to be updated
            const allowedUpdates = ['title', 'description', 'quality', 'maxViewers', 'settings', 'metadata'];
            const filteredUpdates: any = {};

            allowedUpdates.forEach(field => {
                if (updates[field] !== undefined) {
                    filteredUpdates[field] = updates[field];
                }
            });

            const updatedConfig = await LiveStreamService.updateStream(streamId, filteredUpdates);

            if (updatedConfig) {
                res.json({
                    success: true,
                    message: 'Stream updated successfully',
                    data: {
                        streamId: updatedConfig.streamId,
                        title: updatedConfig.title,
                        description: updatedConfig.description,
                        quality: updatedConfig.quality,
                        maxViewers: updatedConfig.maxViewers,
                        settings: updatedConfig.settings
                    }
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Stream not found'
                });
            }

        } catch (error) {
            console.error('❌ Error updating stream:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update stream',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get stream statistics
     * GET /api/streams/:streamId/stats
     */
    static async getStreamStats(req: Request, res: Response): Promise<void> {
        try {
            const { streamId } = req.params;

            const stats = await LiveStreamService.getStreamStats(streamId);

            if (!stats) {
                res.status(404).json({
                    success: false,
                    message: 'Stream not found'
                });
                return;
            }

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('❌ Error fetching stream stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch stream statistics',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Join stream as viewer
     * POST /api/streams/:streamId/join
     */
    static async joinStream(req: Request, res: Response): Promise<void> {
        try {
            const { streamId } = req.params;
            const { identity, name, email } = req.body;

            if (!identity || !name) {
                res.status(400).json({
                    success: false,
                    message: 'Identity and name are required'
                });
                return;
            }

            const result = await LiveStreamService.addViewer(streamId, {
                identity,
                name,
                email
            });

            res.json({
                success: true,
                message: 'Joined stream successfully',
                data: {
                    token: result.token,
                    viewerCount: result.viewerCount
                }
            });

        } catch (error) {
            console.error('❌ Error joining stream:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to join stream',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Leave stream as viewer
     * POST /api/streams/:streamId/leave
     */
    static async leaveStream(req: Request, res: Response): Promise<void> {
        try {
            const { streamId } = req.params;
            const { identity } = req.body;

            if (!identity) {
                res.status(400).json({
                    success: false,
                    message: 'Identity is required'
                });
                return;
            }

            const success = await LiveStreamService.removeViewer(streamId, identity);

            if (success) {
                res.json({
                    success: true,
                    message: 'Left stream successfully',
                    data: { streamId, identity }
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Failed to leave stream'
                });
            }

        } catch (error) {
            console.error('❌ Error leaving stream:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to leave stream',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Send chat message
     * POST /api/streams/:streamId/chat
     */
    static async sendChatMessage(req: Request, res: Response): Promise<void> {
        try {
            const { streamId } = req.params;
            const { sender, message, type = 'text' } = req.body;

            if (!sender || !message) {
                res.status(400).json({
                    success: false,
                    message: 'Sender and message are required'
                });
                return;
            }

            const success = await LiveStreamService.sendChatMessage(streamId, {
                sender,
                message,
                type
            });

            if (success) {
                res.json({
                    success: true,
                    message: 'Chat message sent successfully',
                    data: { streamId, sender, message, type }
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Failed to send chat message'
                });
            }

        } catch (error) {
            console.error('❌ Error sending chat message:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send chat message',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Start recording
     * POST /api/streams/:streamId/recording/start
     */
    static async startRecording(req: Request, res: Response): Promise<void> {
        try {
            const { streamId } = req.params;

            const success = await LiveStreamService.startRecording(streamId);

            if (success) {
                res.json({
                    success: true,
                    message: 'Recording started successfully',
                    data: { streamId }
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Failed to start recording'
                });
            }

        } catch (error) {
            console.error('❌ Error starting recording:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to start recording',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Stop recording
     * POST /api/streams/:streamId/recording/stop
     */
    static async stopRecording(req: Request, res: Response): Promise<void> {
        try {
            const { streamId } = req.params;
            const { recordingUrl } = req.body;

            const success = await LiveStreamService.stopRecording(streamId, recordingUrl);

            if (success) {
                res.json({
                    success: true,
                    message: 'Recording stopped successfully',
                    data: { streamId, recordingUrl }
                });
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Failed to stop recording'
                });
            }

        } catch (error) {
            console.error('❌ Error stopping recording:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to stop recording',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get stream events
     * GET /api/streams/:streamId/events
     */
    static async getStreamEvents(req: Request, res: Response): Promise<void> {
        try {
            const { streamId } = req.params;
            const { limit = 100 } = req.query;

            const events = await LiveStreamService.getStreamEvents(streamId, Number(limit));

            res.json({
                success: true,
                data: {
                    streamId,
                    events,
                    count: events.length
                }
            });

        } catch (error) {
            console.error('❌ Error fetching stream events:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch stream events',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}

export default LiveStreamController;
