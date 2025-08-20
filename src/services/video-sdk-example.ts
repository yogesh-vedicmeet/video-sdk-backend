import { 
    generateJoinToken, 
    createRoomIfNotExists, 
    listParticipants,
    generateModeratorToken,
    getRoomStats 
} from './liveket';
import DatabaseService, { 
    IRoom, 
    IParticipant, 
    ISession,
    IRoom as IRoomDoc 
} from './database';
import RedisVideoService, { 
    RoomCache, 
    ParticipantCache, 
    SessionCache 
} from './redis-enhanced';
import { v4 as uuidv4 } from 'uuid';

/**
 * Complete Video SDK Service Example
 * This demonstrates how to use LiveKit, Redis, and Database services together
 */
export class VideoSDKService {
    
    /**
     * Create a new video room with full integration
     */
    static async createVideoRoom(roomData: {
        name: string;
        description?: string;
        createdBy: string;
        maxParticipants?: number;
        settings?: {
            recordingEnabled: boolean;
            chatEnabled: boolean;
            screenShareEnabled: boolean;
            waitingRoomEnabled: boolean;
            moderatorApprovalRequired: boolean;
        };
    }): Promise<{
        roomId: string;
        livekitRoom: any;
        dbRoom: IRoom;
        cachedRoom: boolean;
    }> {
        try {
            const roomId = uuidv4();
            
            // 1. Create room in LiveKit
            const livekitRoom = await createRoomIfNotExists(roomId, {
                name: roomData.name,
                maxParticipants: roomData.maxParticipants || 20
            });
            
            // 2. Create room in database
            const dbRoom = await DatabaseService.createRoom({
                roomId,
                name: roomData.name,
                description: roomData.description,
                createdBy: roomData.createdBy,
                maxParticipants: roomData.maxParticipants || 20,
                settings: roomData.settings || {
                    recordingEnabled: true,
                    chatEnabled: true,
                    screenShareEnabled: true,
                    waitingRoomEnabled: false,
                    moderatorApprovalRequired: false
                }
            });
            
            // 3. Cache room in Redis
            const roomCache: RoomCache = {
                roomId,
                name: roomData.name,
                isActive: true,
                participantCount: 0,
                maxParticipants: roomData.maxParticipants || 20,
                hostId: roomData.createdBy,
                settings: roomData.settings || {
                    recordingEnabled: true,
                    chatEnabled: true,
                    screenShareEnabled: true,
                    waitingRoomEnabled: false,
                    moderatorApprovalRequired: false
                },
                metadata: {},
                lastActivityAt: Date.now(),
                createdAt: Date.now()
            };
            
            const cachedRoom = await RedisVideoService.cacheRoom(roomCache);
            
            console.log(`🎥 Created video room: ${roomId}`);
            
            return {
                roomId,
                livekitRoom,
                dbRoom,
                cachedRoom
            };
        } catch (error) {
            console.error('❌ Failed to create video room:', error);
            throw error;
        }
    }
    
    /**
     * Join a participant to a video room
     */
    static async joinParticipant(roomId: string, participantData: {
        identity: string;
        name: string;
        email?: string;
        role?: 'host' | 'moderator' | 'participant' | 'viewer';
    }): Promise<{
        token: string;
        participantId: string;
        dbParticipant: IParticipant;
        cachedParticipant: boolean;
    }> {
        try {
            const participantId = uuidv4();
            
            // 1. Generate LiveKit token
            const token = await generateJoinToken({
                identity: participantData.identity,
                room: roomId,
                metadata: {
                    name: participantData.name,
                    email: participantData.email,
                    role: participantData.role || 'participant'
                }
            });
            
            // 2. Create participant in database
            const dbParticipant = await DatabaseService.addParticipant({
                participantId,
                roomId,
                identity: participantData.identity,
                name: participantData.name,
                email: participantData.email,
                role: participantData.role || 'participant',
                isOnline: true,
                joinedAt: new Date()
            });
            
            // 3. Cache participant in Redis
            const participantCache: ParticipantCache = {
                participantId,
                roomId,
                identity: participantData.identity,
                name: participantData.name,
                role: participantData.role || 'participant',
                isOnline: true,
                isMuted: false,
                isVideoEnabled: true,
                isScreenSharing: false,
                joinedAt: Date.now(),
                lastActivityAt: Date.now(),
                metadata: {
                    email: participantData.email
                }
            };
            
            const cachedParticipant = await RedisVideoService.cacheParticipant(participantCache);
            
            // 4. Update room participant count
            await RedisVideoService.incrementRoomParticipants(roomId);
            await RedisVideoService.updateRoomActivity(roomId);
            
            // 5. Log analytics event
            await DatabaseService.logEvent({
                eventId: uuidv4(),
                roomId,
                participantId,
                eventType: 'join',
                eventData: {
                    role: participantData.role || 'participant',
                    timestamp: new Date()
                }
            });
            
            console.log(`👤 Participant joined: ${participantData.identity} to room ${roomId}`);
            
            return {
                token,
                participantId,
                dbParticipant,
                cachedParticipant
            };
        } catch (error) {
            console.error('❌ Failed to join participant:', error);
            throw error;
        }
    }
    
    /**
     * Leave a participant from a video room
     */
    static async leaveParticipant(roomId: string, participantId: string): Promise<boolean> {
        try {
            // 1. Remove from LiveKit (this would be done by the client)
            
            // 2. Update participant in database
            await DatabaseService.updateParticipant(participantId, {
                isOnline: false,
                leftAt: new Date()
            });
            
            // 3. Remove from Redis cache
            await RedisVideoService.removeParticipant(participantId, roomId);
            
            // 4. Update room participant count
            await RedisVideoService.decrementRoomParticipants(roomId);
            
            // 5. Log analytics event
            await DatabaseService.logEvent({
                eventId: uuidv4(),
                roomId,
                participantId,
                eventType: 'leave',
                eventData: {
                    timestamp: new Date()
                }
            });
            
            console.log(`🚪 Participant left: ${participantId} from room ${roomId}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to leave participant:', error);
            return false;
        }
    }
    
    /**
     * Start a video session
     */
    static async startSession(roomId: string, sessionData: {
        hostId: string;
        title: string;
        description?: string;
    }): Promise<{
        sessionId: string;
        dbSession: ISession;
        cachedSession: boolean;
    }> {
        try {
            const sessionId = uuidv4();
            
            // 1. Create session in database
            const dbSession = await DatabaseService.createSession({
                sessionId,
                roomId,
                hostId: sessionData.hostId,
                title: sessionData.title,
                description: sessionData.description,
                startTime: new Date(),
                status: 'active',
                participantCount: await RedisVideoService.getRoomParticipantsCount(roomId)
            });
            
            // 2. Cache session in Redis
            const sessionCache: SessionCache = {
                sessionId,
                roomId,
                hostId: sessionData.hostId,
                title: sessionData.title,
                status: 'active',
                startTime: Date.now(),
                participantCount: await RedisVideoService.getRoomParticipantsCount(roomId),
                isRecording: false,
                metadata: {}
            };
            
            const cachedSession = await RedisVideoService.cacheSession(sessionCache);
            
            // 3. Update room activity
            await RedisVideoService.updateRoomActivity(roomId);
            
            console.log(`🎬 Started session: ${sessionId} in room ${roomId}`);
            
            return {
                sessionId,
                dbSession,
                cachedSession
            };
        } catch (error) {
            console.error('❌ Failed to start session:', error);
            throw error;
        }
    }
    
    /**
     * End a video session
     */
    static async endSession(sessionId: string): Promise<boolean> {
        try {
            // 1. End session in database
            await DatabaseService.endSession(sessionId);
            
            // 2. Update session status in Redis
            await RedisVideoService.updateSessionStatus(sessionId, 'ended');
            
            console.log(`⏹️ Ended session: ${sessionId}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to end session:', error);
            return false;
        }
    }
    
    /**
     * Get comprehensive room information
     */
    static async getRoomInfo(roomId: string): Promise<{
        room: IRoom | null;
        livekitStats: any;
        participants: IParticipant[];
        cachedParticipants: ParticipantCache[];
        participantCount: number;
        isActive: boolean;
    }> {
        try {
            // 1. Get room from database
            const room = await DatabaseService.getRoom(roomId);
            
            // 2. Get LiveKit room stats
            const livekitStats = await getRoomStats(roomId);
            
            // 3. Get participants from database
            const participants = await DatabaseService.getRoomParticipants(roomId);
            
            // 4. Get cached participants from Redis
            const cachedParticipants = await RedisVideoService.getRoomParticipants(roomId);
            
            // 5. Get participant count from Redis
            const participantCount = await RedisVideoService.getRoomParticipantsCount(roomId);
            
            return {
                room,
                livekitStats,
                participants,
                cachedParticipants,
                participantCount,
                isActive: room?.isActive || false
            };
        } catch (error) {
            console.error('❌ Failed to get room info:', error);
            throw error;
        }
    }
    
    /**
     * Send notification to room participants
     */
    static async sendRoomNotification(roomId: string, notification: {
        type: string;
        message: string;
        data?: Record<string, any>;
    }): Promise<boolean> {
        try {
            // 1. Send notification via Redis
            await RedisVideoService.sendNotification(roomId, notification);
            
            // 2. Log analytics event
            await DatabaseService.logEvent({
                eventId: uuidv4(),
                roomId,
                eventType: 'chat_message',
                eventData: {
                    type: notification.type,
                    message: notification.message,
                    timestamp: new Date()
                }
            });
            
            console.log(`📢 Sent notification to room ${roomId}: ${notification.type}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send notification:', error);
            return false;
        }
    }
    
    /**
     * Get room analytics
     */
    static async getRoomAnalytics(roomId: string, limit: number = 100): Promise<{
        dbEvents: any[];
        redisEvents: any[];
        notifications: any[];
    }> {
        try {
            // 1. Get analytics from database
            const dbEvents = await DatabaseService.getAnalytics({ roomId }, limit);
            
            // 2. Get analytics from Redis
            const redisEvents = await RedisVideoService.getAnalyticsEvents(roomId, limit);
            
            // 3. Get notifications from Redis
            const notifications = await RedisVideoService.getNotifications(roomId, limit);
            
            return {
                dbEvents,
                redisEvents,
                notifications
            };
        } catch (error) {
            console.error('❌ Failed to get room analytics:', error);
            throw error;
        }
    }
    
    /**
     * Generate moderator token for room management
     */
    static async generateModeratorAccess(roomId: string, identity: string): Promise<string> {
        try {
            const token = await generateModeratorToken(identity, roomId);
            
            // Cache token in Redis
            await RedisVideoService.cacheToken({
                token,
                identity,
                roomId,
                permissions: ['moderator'],
                expiresAt: Date.now() + (3600 * 1000), // 1 hour
                createdAt: Date.now()
            });
            
            console.log(`👑 Generated moderator token for ${identity} in room ${roomId}`);
            return token;
        } catch (error) {
            console.error('❌ Failed to generate moderator access:', error);
            throw error;
        }
    }
    
    /**
     * Get system statistics
     */
    static async getSystemStats(): Promise<{
        database: any;
        redis: any;
        rooms: any;
    }> {
        try {
            // 1. Get database stats
            const database = await DatabaseService.getDatabaseStats();
            
            // 2. Get Redis stats
            const redis = await RedisVideoService.getRedisStats();
            
            // 3. Get room stats
            const rooms = await DatabaseService.listRooms();
            
            return {
                database,
                redis,
                rooms: {
                    total: rooms.length,
                    active: rooms.filter(r => r.isActive).length,
                    inactive: rooms.filter(r => !r.isActive).length
                }
            };
        } catch (error) {
            console.error('❌ Failed to get system stats:', error);
            throw error;
        }
    }
    
    /**
     * Cleanup old data
     */
    static async cleanupOldData(daysToKeep: number = 30): Promise<{
        database: any;
        redis: any;
    }> {
        try {
            // 1. Cleanup database
            const database = await DatabaseService.cleanupOldData(daysToKeep);
            
            // 2. Cleanup Redis
            const redis = await RedisVideoService.cleanupExpiredData();
            
            console.log(`🧹 Cleaned up old data (${daysToKeep} days)`);
            
            return {
                database,
                redis
            };
        } catch (error) {
            console.error('❌ Failed to cleanup old data:', error);
            throw error;
        }
    }
}

// Example usage
async function runVideoSDKExample() {
    try {
        console.log('🚀 Starting Video SDK Example...\n');
        
        // 1. Create a video room
        const room = await VideoSDKService.createVideoRoom({
            name: 'Team Meeting',
            description: 'Weekly team sync',
            createdBy: 'user123',
            maxParticipants: 10,
            settings: {
                recordingEnabled: true,
                chatEnabled: true,
                screenShareEnabled: true,
                waitingRoomEnabled: false,
                moderatorApprovalRequired: false
            }
        });
        
        console.log(`✅ Created room: ${room.roomId}\n`);
        
        // 2. Join participants
        const host = await VideoSDKService.joinParticipant(room.roomId, {
            identity: 'host123',
            name: 'John Host',
            email: 'host@example.com',
            role: 'host'
        });
        
        const participant1 = await VideoSDKService.joinParticipant(room.roomId, {
            identity: 'user456',
            name: 'Alice User',
            email: 'alice@example.com',
            role: 'participant'
        });
        
        console.log(`✅ Joined participants: ${host.participantId}, ${participant1.participantId}\n`);
        
        // 3. Start a session
        const session = await VideoSDKService.startSession(room.roomId, {
            hostId: host.participantId,
            title: 'Weekly Team Sync',
            description: 'Discuss project progress'
        });
        
        console.log(`✅ Started session: ${session.sessionId}\n`);
        
        // 4. Send a notification
        await VideoSDKService.sendRoomNotification(room.roomId, {
            type: 'system',
            message: 'Meeting started!',
            data: { sessionId: session.sessionId }
        });
        
        // 5. Get room information
        const roomInfo = await VideoSDKService.getRoomInfo(room.roomId);
        console.log(`📊 Room Info:`, {
            participantCount: roomInfo.participantCount,
            isActive: roomInfo.isActive,
            participants: roomInfo.participants.length
        });
        
        // 6. Get system statistics
        const stats = await VideoSDKService.getSystemStats();
        console.log(`📈 System Stats:`, {
            database: stats.database,
            redis: stats.redis,
            rooms: stats.rooms
        });
        
        // 7. End session
        await VideoSDKService.endSession(session.sessionId);
        
        // 8. Leave participants
        await VideoSDKService.leaveParticipant(room.roomId, host.participantId);
        await VideoSDKService.leaveParticipant(room.roomId, participant1.participantId);
        
        console.log('\n✅ Video SDK Example completed successfully!');
        
    } catch (error) {
        console.error('❌ Video SDK Example failed:', error);
    }
}

// Uncomment to run the example
// runVideoSDKExample();

export default VideoSDKService;
