import Redis, { RedisOptions } from 'ioredis';
import { config } from '../config/config';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

// Redis connection configuration
const redisConfig: RedisOptions = {
    host: config.redisHost,
    port: Number(config.redisPort),
    password: config.redisPassword,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
};

// Initialize Redis client with connection state tracking
let redisInstance: Redis;
let isConnected = false;

// Initialize Redis connection
const initializeRedis = (): Redis => {
    if (!redisInstance) {
        redisInstance = new Redis(redisConfig);
        
        redisInstance.on('connect', () => {
            console.log('✅ Redis Video Service connected successfully');
            isConnected = true;
        });

        redisInstance.on('ready', () => {
            console.log('🚀 Redis Video Service ready to accept commands');
            isConnected = true;
        });

        redisInstance.on('error', (error) => {
            console.error('❌ Redis Video Service connection error:', error);
            isConnected = false;
        });

        redisInstance.on('close', () => {
            console.log('🔌 Redis Video Service connection closed');
            isConnected = false;
        });

        redisInstance.on('reconnecting', () => {
            console.log('🔄 Redis Video Service reconnecting...');
            isConnected = false;
        });

        redisInstance.on('end', () => {
            console.log('🔚 Redis Video Service connection ended');
            isConnected = false;
        });
    }
    return redisInstance;
};

// Get Redis instance with connection check
const getRedis = (): Redis => {
    if (!redisInstance || !isConnected) {
        return initializeRedis();
    }
    return redisInstance;
};

// Initialize Redis on module load
const redis = initializeRedis();

// Redis key prefixes for organization
const KEY_PREFIXES = {
    ROOM: 'room',
    SESSION: 'session',
    PARTICIPANT: 'participant',
    USER: 'user',
    TOKEN: 'token',
    CACHE: 'cache',
    LOCK: 'lock',
    QUEUE: 'queue',
    ANALYTICS: 'analytics',
    NOTIFICATION: 'notification',
    VIDEO_EVENT: 'video_event'
} as const;

// Interfaces
export interface RoomCache {
    roomId: string;
    name: string;
    isActive: boolean;
    participantCount: number;
    maxParticipants: number;
    hostId: string;
    settings: {
        recordingEnabled: boolean;
        chatEnabled: boolean;
        screenShareEnabled: boolean;
        waitingRoomEnabled: boolean;
        moderatorApprovalRequired: boolean;
    };
    metadata: Record<string, any>;
    lastActivityAt: number;
    createdAt: number;
}

export interface VideoEventCache {
    eventId: string;
    roomId: string;
    name: string;
    status: string;
    participantCount: number;
    maxParticipants: number;
    hostId: string;
    settings: {
        allowChat: boolean;
        allowScreenShare: boolean;
        allowRecording: boolean;
        requireApproval: boolean;
        autoRecord: boolean;
    };
    permissions: {
        canJoin: {
            enabled: boolean;
            onlySubscribers: boolean;
            minWalletBalance: number;
        };
        canChat: {
            enabled: boolean;
            onlySubscribers: boolean;
            minWalletBalance: number;
        };
        canVideo: {
            enabled: boolean;
            onlySubscribers: boolean;
            minWalletBalance: number;
        };
        canAudio: {
            enabled: boolean;
            onlySubscribers: boolean;
            minWalletBalance: number;
        };
    };
    createdAt: number;
}

export interface ParticipantCache {
    participantId: string;
    roomId: string;
    identity: string;
    name: string;
    role: 'host' | 'moderator' | 'participant' | 'viewer';
    isOnline: boolean;
    isMuted: boolean;
    isVideoEnabled: boolean;
    isScreenSharing: boolean;
    joinedAt: number;
    lastActivityAt: number;
    metadata: Record<string, any>;
}

export interface SessionCache {
    sessionId: string;
    roomId: string;
    hostId: string;
    title: string;
    status: 'scheduled' | 'active' | 'ended' | 'cancelled';
    startTime: number;
    endTime?: number;
    participantCount: number;
    isRecording: boolean;
    metadata: Record<string, any>;
}

export interface TokenCache {
    token: string;
    identity: string;
    roomId: string;
    permissions: string[];
    expiresAt: number;
    createdAt: number;
}

// Redis service class for video SDK
export class RedisVideoService {
    
    // Room operations
    static async cacheRoom(roomData: RoomCache, ttl: number = 3600): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.ROOM}:${roomData.roomId}`;
            await redisClient.setex(key, ttl, JSON.stringify(roomData));
            console.log(`💾 Cached room: ${roomData.roomId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to cache room ${roomData.roomId}:`, error);
            return false;
        }
    }

    static async getCachedRoom(roomId: string): Promise<RoomCache | null> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.ROOM}:${roomId}`;
            const data = await redisClient.get(key);
            if (data) {
                const room = JSON.parse(data) as RoomCache;
                console.log(`📋 Retrieved cached room: ${roomId}`);
                return room;
            }
            return null;
        } catch (error) {
            console.error(`❌ Failed to get cached room ${roomId}:`, error);
            return null;
        }
    }

    // Video Event operations
    static async cacheVideoEvent(eventData: VideoEventCache, ttl: number = 3600): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.VIDEO_EVENT}:${eventData.eventId}`;
            await redisClient.setex(key, ttl, JSON.stringify(eventData));
            console.log(`💾 Cached video event: ${eventData.eventId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to cache video event ${eventData.eventId}:`, error);
            return false;
        }
    }

    static async getCachedVideoEvent(eventId: string): Promise<VideoEventCache | null> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.VIDEO_EVENT}:${eventId}`;
            const data = await redisClient.get(key);
            if (data) {
                const event = JSON.parse(data) as VideoEventCache;
                console.log(`📋 Retrieved cached video event: ${eventId}`);
                return event;
            }
            return null;
        } catch (error) {
            console.error(`❌ Failed to get cached video event ${eventId}:`, error);
            return null;
        }
    }

    static async clearVideoEventCache(eventId: string): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.VIDEO_EVENT}:${eventId}`;
            await redisClient.del(key);
            console.log(`🗑️ Cleared video event cache: ${eventId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to clear video event cache ${eventId}:`, error);
            return false;
        }
    }

    static async updateVideoEventActivity(eventId: string): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.VIDEO_EVENT}:${eventId}`;
            const data = await redisClient.get(key);
            if (data) {
                const event = JSON.parse(data) as VideoEventCache;
                // Update any activity-related fields here if needed
                await redisClient.setex(key, 3600, JSON.stringify(event));
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to update video event activity ${eventId}:`, error);
            return false;
        }
    }

    static async incrementVideoEventParticipants(eventId: string): Promise<number> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.VIDEO_EVENT}:${eventId}:participants`;
            const count = await redisClient.incr(key);
            await redisClient.expire(key, 3600); // 1 hour TTL
            return count;
        } catch (error) {
            console.error(`❌ Failed to increment video event participants ${eventId}:`, error);
            return 0;
        }
    }

    static async decrementVideoEventParticipants(eventId: string): Promise<number> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.VIDEO_EVENT}:${eventId}:participants`;
            const count = await redisClient.decr(key);
            if (count < 0) {
                await redisClient.set(key, 0);
                return 0;
            }
            await redisClient.expire(key, 3600); // 1 hour TTL
            return count;
        } catch (error) {
            console.error(`❌ Failed to decrement video event participants ${eventId}:`, error);
            return 0;
        }
    }

    static async getVideoEventParticipantsCount(eventId: string): Promise<number> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.VIDEO_EVENT}:${eventId}:participants`;
            const count = await redisClient.get(key);
            return count ? parseInt(count) : 0;
        } catch (error) {
            console.error(`❌ Failed to get video event participants count ${eventId}:`, error);
            return 0;
        }
    }

    static async updateRoomActivity(roomId: string): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.ROOM}:${roomId}`;
            const data = await redisClient.get(key);
            if (data) {
                const room = JSON.parse(data) as RoomCache;
                room.lastActivityAt = Date.now();
                await redisClient.setex(key, 3600, JSON.stringify(room));
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to update room activity ${roomId}:`, error);
            return false;
        }
    }

    static async incrementRoomParticipants(roomId: string): Promise<number> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.ROOM}:${roomId}:participants`;
            const count = await redisClient.incr(key);
            await redisClient.expire(key, 3600); // 1 hour TTL
            return count;
        } catch (error) {
            console.error(`❌ Failed to increment room participants ${roomId}:`, error);
            return 0;
        }
    }

    static async decrementRoomParticipants(roomId: string): Promise<number> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.ROOM}:${roomId}:participants`;
            const count = await redisClient.decr(key);
            if (count < 0) {
                await redisClient.set(key, 0);
                return 0;
            }
            return count;
        } catch (error) {
            console.error(`❌ Failed to decrement room participants ${roomId}:`, error);
            return 0;
        }
    }

    static async getRoomParticipantsCount(roomId: string): Promise<number> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.ROOM}:${roomId}:participants`;
            const count = await redisClient.get(key);
            return count ? parseInt(count) : 0;
        } catch (error) {
            console.error(`❌ Failed to get room participants count ${roomId}:`, error);
            return 0;
        }
    }

    // Participant operations
    static async cacheParticipant(participantData: ParticipantCache, ttl: number = 1800): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.PARTICIPANT}:${participantData.participantId}`;
            await redisClient.setex(key, ttl, JSON.stringify(participantData));
            
            // Add to room participants set
            const roomKey = `${KEY_PREFIXES.ROOM}:${participantData.roomId}:participants:set`;
            await redisClient.sadd(roomKey, participantData.participantId);
            await redisClient.expire(roomKey, 3600);
            
            console.log(`💾 Cached participant: ${participantData.participantId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to cache participant ${participantData.participantId}:`, error);
            return false;
        }
    }

    static async getCachedParticipant(participantId: string): Promise<ParticipantCache | null> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.PARTICIPANT}:${participantId}`;
            const data = await redisClient.get(key);
            if (data) {
                const participant = JSON.parse(data) as ParticipantCache;
                return participant;
            }
            return null;
        } catch (error) {
            console.error(`❌ Failed to get cached participant ${participantId}:`, error);
            return null;
        }
    }

    static async updateParticipantActivity(participantId: string): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.PARTICIPANT}:${participantId}`;
            const data = await redisClient.get(key);
            if (data) {
                const participant = JSON.parse(data) as ParticipantCache;
                participant.lastActivityAt = Date.now();
                await redisClient.setex(key, 1800, JSON.stringify(participant));
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to update participant activity ${participantId}:`, error);
            return false;
        }
    }

    static async removeParticipant(participantId: string, roomId: string): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.PARTICIPANT}:${participantId}`;
            await redisClient.del(key);
            
            // Remove from room participants set
            const roomKey = `${KEY_PREFIXES.ROOM}:${roomId}:participants:set`;
            await redisClient.srem(roomKey, participantId);
            
            console.log(`🗑️ Removed participant from cache: ${participantId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to remove participant ${participantId}:`, error);
            return false;
        }
    }

    static async getRoomParticipants(roomId: string): Promise<ParticipantCache[]> {
        try {
            const redisClient = getRedis();
            const roomKey = `${KEY_PREFIXES.ROOM}:${roomId}:participants:set`;
            const participantIds = await redisClient.smembers(roomKey);
            
            const participants: ParticipantCache[] = [];
            for (const participantId of participantIds) {
                const participant = await this.getCachedParticipant(participantId);
                if (participant && participant.isOnline) {
                    participants.push(participant);
                }
            }
            
            return participants;
        } catch (error) {
            console.error(`❌ Failed to get room participants ${roomId}:`, error);
            return [];
        }
    }

    // Session operations
    static async cacheSession(sessionData: SessionCache, ttl: number = 7200): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.SESSION}:${sessionData.sessionId}`;
            await redisClient.setex(key, ttl, JSON.stringify(sessionData));
            console.log(`💾 Cached session: ${sessionData.sessionId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to cache session ${sessionData.sessionId}:`, error);
            return false;
        }
    }

    static async getCachedSession(sessionId: string): Promise<SessionCache | null> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.SESSION}:${sessionId}`;
            const data = await redisClient.get(key);
            if (data) {
                const session = JSON.parse(data) as SessionCache;
                return session;
            }
            return null;
        } catch (error) {
            console.error(`❌ Failed to get cached session ${sessionId}:`, error);
            return null;
        }
    }

    static async updateSessionStatus(sessionId: string, status: SessionCache['status']): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.SESSION}:${sessionId}`;
            const data = await redisClient.get(key);
            if (data) {
                const session = JSON.parse(data) as SessionCache;
                session.status = status;
                if (status === 'ended') {
                    session.endTime = Date.now();
                }
                await redisClient.setex(key, 7200, JSON.stringify(session));
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to update session status ${sessionId}:`, error);
            return false;
        }
    }

    // Token operations
    static async cacheToken(tokenData: TokenCache, ttl: number = 3600): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.TOKEN}:${tokenData.token}`;
            await redisClient.setex(key, ttl, JSON.stringify(tokenData));
            console.log(`💾 Cached token for: ${tokenData.identity}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to cache token for ${tokenData.identity}:`, error);
            return false;
        }
    }

    static async validateToken(token: string): Promise<TokenCache | null> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.TOKEN}:${token}`;
            const data = await redisClient.get(key);
            if (data) {
                const tokenData = JSON.parse(data) as TokenCache;
                if (tokenData.expiresAt > Date.now()) {
                    return tokenData;
                } else {
                    await redisClient.del(key);
                }
            }
            return null;
        } catch (error) {
            console.error(`❌ Failed to validate token:`, error);
            return null;
        }
    }

    static async invalidateToken(token: string): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.TOKEN}:${token}`;
            await redisClient.del(key);
            console.log(`🗑️ Invalidated token`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to invalidate token:`, error);
            return false;
        }
    }

    // Lock operations for concurrency control
    static async acquireLock(lockName: string, ttl: number = 30): Promise<string | null> {
        try {
            const redisClient = getRedis();
            const lockId = uuidv4();
            const key = `${KEY_PREFIXES.LOCK}:${lockName}`;
            const result = await redisClient.set(key, lockId, 'EX', ttl, 'NX');
            return result === 'OK' ? lockId : null;
        } catch (error) {
            console.error(`❌ Failed to acquire lock ${lockName}:`, error);
            return null;
        }
    }

    static async releaseLock(lockName: string, lockId: string): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.LOCK}:${lockName}`;
            const script = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
            `;
            const result = await redisClient.eval(script, 1, key, lockId);
            return result === 1;
        } catch (error) {
            console.error(`❌ Failed to release lock ${lockName}:`, error);
            return false;
        }
    }

    // Queue operations for background tasks
    static async addToQueue(queueName: string, data: any, priority: number = 0): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const queueData = {
                id: uuidv4(),
                data,
                priority,
                timestamp: Date.now()
            };
            const key = `${KEY_PREFIXES.QUEUE}:${queueName}`;
            await redisClient.zadd(key, priority, JSON.stringify(queueData));
            console.log(`📤 Added to queue ${queueName}: ${queueData.id}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to add to queue ${queueName}:`, error);
            return false;
        }
    }

    static async getFromQueue(queueName: string): Promise<any | null> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.QUEUE}:${queueName}`;
            const items = await redisClient.zrange(key, 0, 0, 'WITHSCORES');
            if (items.length > 0) {
                const queueData = JSON.parse(items[0]);
                await redisClient.zrem(key, items[0]);
                return queueData;
            }
            return null;
        } catch (error) {
            console.error(`❌ Failed to get from queue ${queueName}:`, error);
            return null;
        }
    }

    // Analytics operations
    static async logAnalyticsEvent(eventData: {
        eventType: string;
        roomId: string;
        participantId?: string;
        data: Record<string, any>;
    }): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const event = {
                id: uuidv4(),
                ...eventData,
                timestamp: Date.now()
            };
            const key = `${KEY_PREFIXES.ANALYTICS}:${eventData.roomId}`;
            await redisClient.lpush(key, JSON.stringify(event));
            await redisClient.ltrim(key, 0, 999); // Keep last 1000 events
            await redisClient.expire(key, 86400); // 24 hours TTL
            return true;
        } catch (error) {
            console.error(`❌ Failed to log analytics event:`, error);
            return false;
        }
    }

    static async getAnalyticsEvents(roomId: string, limit: number = 100): Promise<any[]> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.ANALYTICS}:${roomId}`;
            const events = await redisClient.lrange(key, 0, limit - 1);
            return events.map(event => JSON.parse(event));
        } catch (error) {
            console.error(`❌ Failed to get analytics events for room ${roomId}:`, error);
            return [];
        }
    }

    // Notification operations
    static async sendNotification(roomId: string, notification: {
        type: string;
        message: string;
        data?: Record<string, any>;
        targetParticipants?: string[];
    }): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const notificationData = {
                id: uuidv4(),
                ...notification,
                timestamp: Date.now()
            };
            const key = `${KEY_PREFIXES.NOTIFICATION}:${roomId}`;
            await redisClient.lpush(key, JSON.stringify(notificationData));
            await redisClient.ltrim(key, 0, 99); // Keep last 100 notifications
            await redisClient.expire(key, 3600); // 1 hour TTL
            console.log(`📢 Sent notification to room ${roomId}: ${notification.type}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to send notification to room ${roomId}:`, error);
            return false;
        }
    }

    static async getNotifications(roomId: string, limit: number = 50): Promise<any[]> {
        try {
            const redisClient = getRedis();
            const key = `${KEY_PREFIXES.NOTIFICATION}:${roomId}`;
            const notifications = await redisClient.lrange(key, 0, limit - 1);
            return notifications.map(notification => JSON.parse(notification));
        } catch (error) {
            console.error(`❌ Failed to get notifications for room ${roomId}:`, error);
            return [];
        }
    }

    // Cache operations
    static async setCache(key: string, data: any, ttl: number = 3600): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const cacheKey = `${KEY_PREFIXES.CACHE}:${key}`;
            await redisClient.setex(cacheKey, ttl, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error(`❌ Failed to set cache for key ${key}:`, error);
            return false;
        }
    }

    static async getCache(key: string): Promise<any | null> {
        try {
            const redisClient = getRedis();
            const cacheKey = `${KEY_PREFIXES.CACHE}:${key}`;
            const data = await redisClient.get(cacheKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`❌ Failed to get cache for key ${key}:`, error);
            return null;
        }
    }

    static async deleteCache(key: string): Promise<boolean> {
        try {
            const redisClient = getRedis();
            const cacheKey = `${KEY_PREFIXES.CACHE}:${key}`;
            await redisClient.del(cacheKey);
            return true;
        } catch (error) {
            console.error(`❌ Failed to delete cache for key ${key}:`, error);
            return false;
        }
    }

    // Statistics and monitoring
    static async getRedisStats(): Promise<{
        totalKeys: number;
        memoryUsage: string;
        connectedClients: number;
        uptime: number;
    }> {
        try {
            const redisClient = getRedis();
            const info = await redisClient.info();
            const stats: any = {};
            
            // Parse Redis INFO output
            info.split('\r\n').forEach(line => {
                const [key, value] = line.split(':');
                if (key && value) {
                    stats[key] = value;
                }
            });

            return {
                totalKeys: parseInt(stats.db0?.split(',')[0]?.split('=')[1] || '0'),
                memoryUsage: stats.used_memory_human || '0B',
                connectedClients: parseInt(stats.connected_clients || '0'),
                uptime: parseInt(stats.uptime_in_seconds || '0')
            };
        } catch (error) {
            console.error('❌ Failed to get Redis stats:', error);
            return {
                totalKeys: 0,
                memoryUsage: '0B',
                connectedClients: 0,
                uptime: 0
            };
        }
    }

    static async cleanupExpiredData(): Promise<{
        roomsCleaned: number;
        participantsCleaned: number;
        sessionsCleaned: number;
        tokensCleaned: number;
    }> {
        try {
            const redisClient = getRedis();
            // This is a simplified cleanup - in production you might want more sophisticated logic
            const patterns = [
                `${KEY_PREFIXES.ROOM}:*`,
                `${KEY_PREFIXES.PARTICIPANT}:*`,
                `${KEY_PREFIXES.SESSION}:*`,
                `${KEY_PREFIXES.TOKEN}:*`
            ];

            let cleaned = 0;
            for (const pattern of patterns) {
                const keys = await redisClient.keys(pattern);
                if (keys.length > 0) {
                    // Check TTL for each key and remove expired ones
                    for (const key of keys) {
                        const ttl = await redisClient.ttl(key);
                        if (ttl === -1) { // No TTL set, remove after 24 hours
                            const exists = await redisClient.exists(key);
                            if (exists) {
                                await redisClient.expire(key, 86400);
                            }
                        }
                    }
                    cleaned += keys.length;
                }
            }

            console.log(`🧹 Cleaned up ${cleaned} Redis keys`);
            return {
                roomsCleaned: cleaned,
                participantsCleaned: cleaned,
                sessionsCleaned: cleaned,
                tokensCleaned: cleaned
            };
        } catch (error) {
            console.error('❌ Failed to cleanup expired data:', error);
            return {
                roomsCleaned: 0,
                participantsCleaned: 0,
                sessionsCleaned: 0,
                tokensCleaned: 0
            };
        }
    }

    // Connection management
    static async closeConnection(): Promise<void> {
        try {
            if (redisInstance) {
                await redisInstance.quit();
                console.log('✅ Redis connection closed');
            }
        } catch (error) {
            console.error('❌ Error closing Redis connection:', error);
        }
    }
}

// Connection event handlers
redis.on('connect', () => {
    console.log('✅ Redis Video Service connected successfully');
});

redis.on('ready', () => {
    console.log('🚀 Redis Video Service ready to accept commands');
});

redis.on('error', (error) => {
    console.error('❌ Redis Video Service connection error:', error);
});

redis.on('close', () => {
    console.log('🔌 Redis Video Service connection closed');
});

redis.on('reconnecting', () => {
    console.log('🔄 Redis Video Service reconnecting...');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    await RedisVideoService.closeConnection();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await RedisVideoService.closeConnection();
    process.exit(0);
});

// Export the service and Redis instance
export { redis as redis };
export default RedisVideoService;
