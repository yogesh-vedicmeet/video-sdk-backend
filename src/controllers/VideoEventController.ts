import { Request, Response } from 'express';
import { VideoEvent, IVideoEvent } from '../models/VideoEvent';
import { User } from '../models/User';
import { Participant, IParticipant } from '../models/Participant';
import { Session } from '../models/Session';
import { 
    generateJoinToken, 
    generateRoleBasedToken,
    createRoomIfNotExists, 
    deleteRoom as deleteLiveKitRoom,
    getRoomStats, 
    generateModeratorToken,
    generateViewerToken
} from '../services/liveket';
import RedisVideoService from '../services/redis-enhanced';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import { config } from '../config/config';

// Helper function to get participant permissions based on role
const getParticipantPermissions = (isHost: boolean, isModerator: boolean, isViewer: boolean) => {
    return {
        canVideo: !isViewer,
        canAudio: !isViewer,
        canChat: true,
        canScreenShare: isModerator,
        canModerate: isModerator,
        canEndEvent: isHost,
        canBlockUsers: isModerator,
        canViewParticipantList: true,
        canSendMessages: true,
        canReceiveMessages: true,
        isHost,
        isModerator,
        isViewer
    };
};

// Extended interface for VideoEventCache to match our usage
interface ExtendedVideoEventCache {
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
    // Additional fields for database events
    _id?: string;
    event_name?: string;
    greeting_message?: string;
    expected_duration?: number;
    max_participants?: number;
    is_private?: boolean;
    current_participants?: number;
    created_by?: any;
    room_id?: string;
    started_at?: Date;
    ended_at?: Date;
    created_at?: number;
    updated_at?: number;
}

export class VideoEventController {
    
    /**
     * Create a new video event
     * POST /api/video-events
     */
    static async createVideoEvent(req: Request, res: Response): Promise<void> {
        try {
            const {
                event_name,
                greeting_message,
                duration,
                max_participants = 20,
                is_private = false,
                settings = {},
                permissions = {}
            } = req.body;

            const createdBy = req.user?.id || req.body.createdBy;

            if (!createdBy) {
                res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
                return;
            }

            // Validate required fields
            if (!event_name || event_name.trim().length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Event name is required'
                });
                return;
            }

            if (!greeting_message || greeting_message.trim().length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Greeting message is required'
                });
                return;
            }

            const roomId = uuidv4();

            // Create room in LiveKit
            const livekitRoom = await createRoomIfNotExists(roomId, {
                name: event_name,
                maxParticipants: max_participants
            });

            // Create video event in database
            const videoEvent = new VideoEvent({
                event_name: event_name.trim(),
                greeting_message: greeting_message.trim(),
                expected_duration: duration || 60,
                max_participants,
                is_private,
                created_by: new ObjectId(createdBy),
                room_id: roomId,
                settings: {
                    allowChat: settings.allowChat !== false,
                    allowScreenShare: settings.allowScreenShare !== false,
                    allowRecording: settings.allowRecording || false,
                    requireApproval: settings.requireApproval || false,
                    autoRecord: settings.autoRecord || false
                },
                permissions: {
                    canJoin: {
                        enabled: permissions.canJoin?.enabled !== false,
                        onlySubscribers: permissions.canJoin?.onlySubscribers || false,
                        minWalletBalance: permissions.canJoin?.minWalletBalance || 0
                    },
                    canChat: {
                        enabled: permissions.canChat?.enabled !== false,
                        onlySubscribers: permissions.canChat?.onlySubscribers || false,
                        minWalletBalance: permissions.canChat?.minWalletBalance || 0
                    },
                    canVideo: {
                        enabled: permissions.canVideo?.enabled !== false,
                        onlySubscribers: permissions.canVideo?.onlySubscribers || false,
                        minWalletBalance: permissions.canVideo?.minWalletBalance || 0
                    },
                    canAudio: {
                        enabled: permissions.canAudio?.enabled !== false,
                        onlySubscribers: permissions.canAudio?.onlySubscribers || false,
                        minWalletBalance: permissions.canAudio?.minWalletBalance || 0
                    }
                }
            });

            await videoEvent.save();

            // Cache the event
            await RedisVideoService.cacheVideoEvent({
                eventId: videoEvent._id?.toString() || '',
                roomId: videoEvent.room_id,
                name: videoEvent.event_name,
                status: videoEvent.status,
                participantCount: videoEvent.current_participants,
                maxParticipants: videoEvent.max_participants,
                hostId: videoEvent.created_by?.toString() || '',
                settings: videoEvent.settings,
                permissions: videoEvent.permissions,
                createdAt: videoEvent.createdAt.getTime()
            });

            res.status(201).json({
                success: true,
                message: 'Video event created successfully',
                data: {
                    _id: videoEvent._id,
                    event_name: videoEvent.event_name,
                    greeting_message: videoEvent.greeting_message,
                    expected_duration: videoEvent.expected_duration,
                    max_participants: videoEvent.max_participants,
                    is_private: videoEvent.is_private,
                    status: videoEvent.status,
                    room_id: videoEvent.room_id,
                    settings: videoEvent.settings,
                    permissions: videoEvent.permissions,
                    created_at: videoEvent.createdAt
                }
            });

        } catch (error) {
            console.error('❌ Error creating video event:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create video event',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get all video events
     * GET /api/video-events
     */
    static async getVideoEvents(req: Request, res: Response): Promise<void> {
        try {
            const { status, created_by, limit = 50, page = 1 } = req.query;

            let filter: any = {};
            
            if (status) {
                filter.status = status;
            }
            
            if (created_by) {
                filter.created_by = new ObjectId(created_by as string);
            }

            const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

            const videoEvents = await VideoEvent.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit as string))
                .populate('created_by', 'name accountName profileImage');

            const total = await VideoEvent.countDocuments(filter);

            res.json({
                success: true,
                data: videoEvents.map(event => ({
                    _id: event._id,
                    event_name: event.event_name,
                    greeting_message: event.greeting_message,
                    expected_duration: event.expected_duration,
                    max_participants: event.max_participants,
                    is_private: event.is_private,
                    status: event.status,
                    current_participants: event.current_participants,
                    created_by: event.created_by,
                    room_id: event.room_id,
                    started_at: event.started_at,
                    ended_at: event.ended_at,
                    settings: event.settings,
                    permissions: event.permissions,
                    created_at: event.createdAt,
                    updated_at: event.updatedAt
                })),
                pagination: {
                    page: parseInt(page as string),
                    limit: parseInt(limit as string),
                    total,
                    pages: Math.ceil(total / parseInt(limit as string))
                }
            });

        } catch (error) {
            console.error('❌ Error fetching video events:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch video events',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get a specific video event by ID
     * GET /api/video-events/:eventId
     */
    static async getVideoEvent(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;

            // Try to get from cache first
            let event = await RedisVideoService.getCachedVideoEvent(eventId);

            if (!event) {
                // Get from database
                const dbEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) })
                    .populate('created_by', 'name accountName profileImage');
                
                if (!dbEvent) {
                    res.status(404).json({
                        success: false,
                        message: 'Video event not found'
                    });
                    return;
                }

                event = {
                    eventId: dbEvent._id?.toString() || '',
                    roomId: dbEvent.room_id,
                    name: dbEvent.event_name,
                    status: dbEvent.status,
                    participantCount: dbEvent.current_participants,
                    maxParticipants: dbEvent.max_participants,
                    hostId: dbEvent.created_by?._id?.toString() || '',
                    settings: dbEvent.settings,
                    permissions: dbEvent.permissions,
                    createdAt: dbEvent.createdAt.getTime(),
                    // Additional fields for response
                    _id: dbEvent._id?.toString(),
                    event_name: dbEvent.event_name,
                    greeting_message: dbEvent.greeting_message,
                    expected_duration: dbEvent.expected_duration,
                    max_participants: dbEvent.max_participants,
                    is_private: dbEvent.is_private,
                    current_participants: dbEvent.current_participants,
                    created_by: dbEvent.created_by,
                    room_id: dbEvent.room_id,
                    started_at: dbEvent.started_at,
                    ended_at: dbEvent.ended_at,
                    created_at: dbEvent.createdAt.getTime(),
                    updated_at: dbEvent.updatedAt.getTime()
                } as ExtendedVideoEventCache;

                // Cache the event
                await RedisVideoService.cacheVideoEvent(event);
            }

            if (!event) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }

            // Get LiveKit room stats
            const livekitStats = await getRoomStats(event.roomId);

            // Get participants
            const participants = await Participant.find({ roomId: event.roomId, isOnline: true }).sort({ joinedAt: 1 });

            res.json({
                success: true,
                data: {
                    ...event,
                    livekit_stats: livekitStats,
                    participants: participants.map(p => ({
                        userId: p.identity,
                        name: p.name,
                        profileImage: p.metadata?.profileImage || null,
                        isOnline: p.isOnline,
                        joinedAt: p.joinedAt,
                        wallet: p.metadata?.wallet || 0
                    }))
                }
            });

        } catch (error) {
            console.error('❌ Error fetching video event:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch video event',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Update a video event
     * PUT /api/video-events/:eventId
     */
    static async updateVideoEvent(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            const updateData = req.body;

            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }

            // Check if user is the creator
            if (videoEvent.created_by?.toString() !== req.user?.id) {
                res.status(403).json({
                    success: false,
                    message: 'You can only update your own video events'
                });
                return;
            }

            // Update allowed fields
            const allowedFields = ['event_name', 'greeting_message', 'expected_duration', 'max_participants', 'is_private', 'settings', 'permissions'];
            
            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    (videoEvent as any)[field] = updateData[field];
                }
            }

            await videoEvent.save();

            // Update cache
            await RedisVideoService.cacheVideoEvent({
                eventId: videoEvent._id?.toString() || '',
                roomId: videoEvent.room_id,
                name: videoEvent.event_name,
                status: videoEvent.status,
                participantCount: videoEvent.current_participants,
                maxParticipants: videoEvent.max_participants,
                hostId: videoEvent.created_by?.toString() || '',
                settings: videoEvent.settings,
                permissions: videoEvent.permissions,
                createdAt: videoEvent.createdAt.getTime()
            });

            res.json({
                success: true,
                message: 'Video event updated successfully',
                data: {
                    _id: videoEvent._id,
                    event_name: videoEvent.event_name,
                    greeting_message: videoEvent.greeting_message,
                    expected_duration: videoEvent.expected_duration,
                    max_participants: videoEvent.max_participants,
                    is_private: videoEvent.is_private,
                    status: videoEvent.status,
                    settings: videoEvent.settings,
                    permissions: videoEvent.permissions,
                    updated_at: videoEvent.updatedAt
                }
            });

        } catch (error) {
            console.error('❌ Error updating video event:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update video event',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Close a video event
     * POST /api/video-events/:eventId/close
     */
    static async closeVideoEvent(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;

            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }

            // Check if user is the creator
            if (videoEvent.created_by?.toString() !== req.user?.id) {
                res.status(403).json({
                    success: false,
                    message: 'You can only close your own video events'
                });
                return;
            }

            // End the event manually since the method might not exist
            videoEvent.status = 'ended';
            videoEvent.ended_at = new Date();
            await videoEvent.save();

            // Remove all participants
            await Participant.updateMany(
                { roomId: videoEvent.room_id },
                { isOnline: false, leftAt: new Date() }
            );

            // End all active sessions
            await Session.updateMany(
                { roomId: videoEvent.room_id, status: 'active' },
                { status: 'ended', endTime: new Date() }
            );

            // Clear cache
            await RedisVideoService.clearVideoEventCache(eventId);

            res.json({
                success: true,
                message: 'Video event closed successfully',
                data: {
                    _id: videoEvent._id,
                    status: videoEvent.status,
                    ended_at: videoEvent.ended_at
                }
            });

        } catch (error) {
            console.error('❌ Error closing video event:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to close video event',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get event participants
     * GET /api/video-events/:eventId/participants
     */
    static async getEventParticipants(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;

            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }

            const participants = await Participant.find({ roomId: videoEvent.room_id })
                .sort({ joinedAt: 1 });

            res.json({
                success: true,
                data: participants.map(p => ({
                    userId: p.identity,
                    name: p.name,
                    profileImage: p.metadata?.profileImage || null,
                    isOnline: p.isOnline,
                    joinedAt: p.joinedAt,
                    leftAt: p.leftAt,
                    wallet: p.metadata?.wallet || 0,
                    isBlocked: p.metadata?.isBlocked || false
                }))
            });

        } catch (error) {
            console.error('❌ Error fetching event participants:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch event participants',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Modify participant (block/unblock)
     * POST /api/video-events/:eventId/participants/:userId
     */
    static async modifyParticipant(req: Request, res: Response): Promise<void> {
        try {
            const { eventId, userId } = req.params;
            const { action } = req.body;

            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }

            // Check if user is the creator
            if (videoEvent.created_by?.toString() !== req.user?.id) {
                res.status(403).json({
                    success: false,
                    message: 'You can only modify participants in your own video events'
                });
                return;
            }

            const participant = await Participant.findOne({ 
                roomId: videoEvent.room_id, 
                identity: userId 
            });

            if (!participant) {
                res.status(404).json({
                    success: false,
                    message: 'Participant not found'
                });
                return;
            }

            if (action === 'block') {
                participant.metadata = { ...participant.metadata, isBlocked: true };
                participant.isOnline = false;
                participant.leftAt = new Date();
            } else if (action === 'unblock') {
                participant.metadata = { ...participant.metadata, isBlocked: false };
            } else {
                res.status(400).json({
                    success: false,
                    message: 'Invalid action. Use "block" or "unblock"'
                });
                return;
            }

            await participant.save();

            res.json({
                success: true,
                message: `Participant ${action}ed successfully`,
                data: {
                    userId: participant.identity,
                    isBlocked: participant.metadata?.isBlocked || false,
                    isOnline: participant.isOnline
                }
            });

        } catch (error) {
            console.error('❌ Error modifying participant:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to modify participant',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get event waitlist
     * GET /api/video-events/:eventId/waitlist
     */
    static async getEventWaitlist(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;

            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }

            // For now, return empty waitlist
            // This would be implemented based on your waitlist system
            res.json({
                success: true,
                data: {
                    entries: []
                }
            });

        } catch (error) {
            console.error('❌ Error fetching event waitlist:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch event waitlist',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get blocked users for an event
     * GET /api/video-events/:eventId/blocked-users
     */
    static async getBlockedUsers(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;

            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }

            // Check if user is the creator or has moderator permissions
            if (videoEvent.created_by?.toString() !== req.user?.id && req.user?.role !== 'moderator') {
                res.status(403).json({
                    success: false,
                    message: 'You can only view blocked users for your own video events'
                });
                return;
            }

            const blockedParticipants = await Participant.find({ 
                roomId: videoEvent.room_id,
                'metadata.isBlocked': true
            }).sort({ leftAt: -1 });

            res.json({
                success: true,
                data: blockedParticipants.map(p => ({
                    userId: p.identity,
                    name: p.name,
                    profileImage: p.metadata?.profileImage || null,
                    blockedAt: p.leftAt,
                    wallet: p.metadata?.wallet || 0,
                    joinedAt: p.joinedAt
                }))
            });

        } catch (error) {
            console.error('❌ Error fetching blocked users:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch blocked users',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    static async generateEventToken(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            const { participantName, role = 'participant', joinType = 'video' } = req.body;
            const currentUser = req.user;
            
            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });

            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }

            // Check if event is live
            if (videoEvent.status !== 'live') {
                res.status(400).json({
                    success: false,
                    message: 'Event is not live'
                });
                return;
            }

            // Determine user role and permissions
            const isHost = videoEvent.created_by?.toString() === currentUser?.id;
            const isModerator = role === 'moderator' || isHost || currentUser?.role === 'moderator';
            const isViewer = joinType === 'viewer' || role === 'viewer';

            // Generate role-based token
            const token = await generateRoleBasedToken({
                identity: participantName || currentUser?.name || 'Anonymous',
                room: videoEvent.room_id,
                role: role,
                joinType: joinType,
                metadata: {
                    userId: currentUser?.id,
                    userName: participantName || currentUser?.name,
                    isHost: isHost,
                    isModerator: isModerator,
                    isViewer: isViewer
                }
            });

            const permissions = getParticipantPermissions(isHost, isModerator, isViewer);

            res.json({
                success: true,
                data: {
                    token,
                    url: config.livekitUrl,
                    expiresIn: 3600,
                    roomId: videoEvent.room_id,
                    identity: videoEvent.room_id + '-' + videoEvent.event_name,
                    name: videoEvent.event_name,
                    role: role,
                    joinType: joinType,
                    permissions: permissions
                }
            });
        } catch (error) {
            console.error('❌ Error generating event token:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate event token',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    static async duplicateVideoEvent(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }
            const newVideoEvent = new VideoEvent({
                ...videoEvent,
                _id: undefined,
                room_id: undefined,
                created_at: undefined,
                updated_at: undefined
            });
            await newVideoEvent.save();
            res.json({
                success: true,
                message: 'Video event duplicated successfully',
                data: newVideoEvent
            });
        }
        catch (error) {
            console.error('❌ Error duplicating video event:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to duplicate video event',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    static async deleteVideoEvent(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }
            await videoEvent.deleteOne();
            res.json({
                success: true,
                message: 'Video event deleted successfully'
            }); 
        }
        catch (error) {
            console.error('❌ Error deleting video event:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete video event',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    static async blockUser(req: Request, res: Response): Promise<void> {
        try {
            const { eventId, userId } = req.params;
            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }
            const participant = await Participant.findOne({ _id: new ObjectId(userId), roomId: videoEvent.room_id });
            if (!participant) {
                res.status(404).json({
                    success: false,
                    message: 'Participant not found'
                });
                return;
            }
            participant.metadata = { ...participant.metadata, isBlocked: true };
            await participant.save();
            res.json({
                success: true,
                message: 'User blocked successfully'
            });
            await RedisVideoService.cacheVideoEvent({
                eventId: videoEvent._id?.toString() || '',
                roomId: videoEvent.room_id,
                name: videoEvent.event_name,
                status: videoEvent.status,
                participantCount: videoEvent.current_participants,
                maxParticipants: videoEvent.max_participants,
                hostId: videoEvent.created_by?.toString() || '',
                settings: videoEvent.settings,
                permissions: videoEvent.permissions,
                createdAt: videoEvent.createdAt.getTime()
            });
        }
        catch (error) {
            console.error('❌ Error blocking user:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to block user',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    static async unblockUser(req: Request, res: Response): Promise<void> {
        try {
            const { eventId, userId } = req.params;
            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }
            const participant = await Participant.findOne({ _id: new ObjectId(userId), roomId: videoEvent.room_id });
            if (!participant) {
                res.status(404).json({
                    success: false,
                    message: 'Participant not found'
                });
                return;
            }
            participant.metadata = { ...participant.metadata, isBlocked: false };
            await participant.save();
            res.json({
                success: true,
                message: 'User unblocked successfully'
            });
            await RedisVideoService.cacheVideoEvent({
                eventId: videoEvent._id?.toString() || '',
                roomId: videoEvent.room_id,
                name: videoEvent.event_name,
                status: videoEvent.status,
                participantCount: videoEvent.current_participants,
                maxParticipants: videoEvent.max_participants,
                hostId: videoEvent.created_by?.toString() || '',
                settings: videoEvent.settings,
                permissions: videoEvent.permissions,
                createdAt: videoEvent.createdAt.getTime()
            });
            }
        catch (error) {
            console.error('❌ Error unblocking user:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to unblock user',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Join a video event with role-based access
     * POST /api/video-events/:eventId/join
     */
    static async joinVideoEvent(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            const { userId, userName, role = 'participant', joinType = 'video' } = req.body;
            const currentUser = req.user;

            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }

            // Check if event is live
            if (videoEvent.status !== 'live') {
                res.status(400).json({
                    success: false,
                    message: 'Event is not live'
                });
                return;
            }

            // Determine user role and permissions
            const isHost = videoEvent.created_by?.toString() === (userId || currentUser?.id);
            const isModerator = role === 'moderator' || isHost;
            const isViewer = joinType === 'viewer' || role === 'viewer';

            // Check if user is blocked
            const blockedUser = await Participant.findOne({
                roomId: videoEvent.room_id,
                userId: userId || currentUser?.id,
                'metadata.isBlocked': true
            });

            if (blockedUser) {
                res.status(403).json({
                    success: false,
                    message: 'You are blocked from joining this event'
                });
                return;
            }

            // Check if user is already a participant
            const existingParticipant = await Participant.findOne({
                roomId: videoEvent.room_id,
                userId: userId || currentUser?.id
            });

            if (existingParticipant) {
                // Update existing participant's role if needed
                if (existingParticipant.metadata?.role !== role || existingParticipant.metadata?.joinType !== joinType) {
                    existingParticipant.metadata = {
                        ...existingParticipant.metadata,
                        role: role,
                        joinType: joinType,
                        isHost: isHost,
                        isModerator: isModerator,
                        isViewer: isViewer
                    };
                    await existingParticipant.save();
                }

                res.json({
                    success: true,
                    message: 'Already joined the event',
                    data: { 
                        participant: existingParticipant,
                        role: role,
                        joinType: joinType,
                        permissions: getParticipantPermissions(isHost, isModerator, isViewer)
                    }
                });
                return;
            }

            // Create new participant with role-based metadata
            const newParticipant = new Participant({
                roomId: videoEvent.room_id,
                userId: userId || currentUser?.id,
                name: userName || currentUser?.name || 'Anonymous',
                joinedAt: new Date(),
                isOnline: true,
                metadata: {
                    role: role,
                    joinType: joinType,
                    isHost: isHost,
                    isModerator: isModerator,
                    isViewer: isViewer,
                    isBlocked: false,
                    canVideo: !isViewer,
                    canAudio: !isViewer,
                    canChat: true,
                    canScreenShare: isModerator,
                    canModerate: isModerator
                }
            });

            await newParticipant.save();

            // Update participant count
            videoEvent.current_participants = (videoEvent.current_participants || 0) + 1;
            await videoEvent.save();

            res.json({
                success: true,
                message: 'Successfully joined video event',
                data: { 
                    participant: newParticipant,
                    role: role,
                    joinType: joinType,
                    permissions: getParticipantPermissions(isHost, isModerator, isViewer)
                }
            });

        } catch (error) {
            console.error('❌ Error joining video event:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to join video event',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Join as viewer (chat-only participant)
     * POST /api/video-events/:eventId/join-viewer
     */
    static async joinAsViewer(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            const { userId, userName } = req.body;
            const currentUser = req.user;

            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }

            // Check if event is live
            if (videoEvent.status !== 'live') {
                res.status(400).json({
                    success: false,
                    message: 'Event is not live'
                });
                return;
            }

            // Check if user is blocked
            const blockedUser = await Participant.findOne({
                roomId: videoEvent.room_id,
                userId: userId || currentUser?.id,
                'metadata.isBlocked': true
            });

            if (blockedUser) {
                res.status(403).json({
                    success: false,
                    message: 'You are blocked from joining this event'
                });
                return;
            }

            // Check if user is already a participant
            const existingParticipant = await Participant.findOne({
                roomId: videoEvent.room_id,
                userId: userId || currentUser?.id
            });

            if (existingParticipant) {
                // Update to viewer mode if not already
                if (existingParticipant.metadata?.joinType !== 'viewer') {
                    existingParticipant.metadata = {
                        ...existingParticipant.metadata,
                        joinType: 'viewer',
                        isViewer: true,
                        canVideo: false,
                        canAudio: false,
                        canChat: true
                    };
                    await existingParticipant.save();
                }

                res.json({
                    success: true,
                    message: 'Already joined as viewer',
                    data: { 
                        participant: existingParticipant,
                        role: 'viewer',
                        joinType: 'viewer',
                        permissions: getParticipantPermissions(false, false, true)
                    }
                });
                return;
            }

            // Create new viewer participant
            const newParticipant = new Participant({
                roomId: videoEvent.room_id,
                userId: userId || currentUser?.id,
                name: userName || currentUser?.name || 'Anonymous',
                joinedAt: new Date(),
                isOnline: true,
                metadata: {
                    role: 'viewer',
                    joinType: 'viewer',
                    isHost: false,
                    isModerator: false,
                    isViewer: true,
                    isBlocked: false,
                    canVideo: false,
                    canAudio: false,
                    canChat: true,
                    canScreenShare: false,
                    canModerate: false
                }
            });

            await newParticipant.save();

            // Update participant count
            videoEvent.current_participants = (videoEvent.current_participants || 0) + 1;
            await videoEvent.save();

            res.json({
                success: true,
                message: 'Successfully joined as viewer',
                data: { 
                    participant: newParticipant,
                    role: 'viewer',
                    joinType: 'viewer',
                    permissions: getParticipantPermissions(false, false, true)
                }
            });

        } catch (error) {
            console.error('❌ Error joining as viewer:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to join as viewer',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Leave a video event
     * POST /api/video-events/:eventId/leave
     */
    static async leaveVideoEvent(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            const currentUser = req.user;

            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }

            // Find and remove participant
            const participant = await Participant.findOneAndDelete({
                roomId: videoEvent.room_id,
                userId: currentUser?.id
            });

            if (participant) {
                // Update participant count
                videoEvent.current_participants = Math.max(0, (videoEvent.current_participants || 0) - 1);
                await videoEvent.save();
            }

            res.json({
                success: true,
                message: 'Successfully left video event'
            });

        } catch (error) {
            console.error('❌ Error leaving video event:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to leave video event',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Check if user can access event
     * GET /api/video-events/:eventId/access
     */
    static async checkEventAccess(req: Request, res: Response): Promise<void> {
        try {
            const { eventId } = req.params;
            const currentUser = req.user;

            const videoEvent = await VideoEvent.findOne({ _id: new ObjectId(eventId) });
            if (!videoEvent) {
                res.status(404).json({
                    success: false,
                    message: 'Video event not found'
                });
                return;
            }

            // Check if event is live
            if (videoEvent.status !== 'live') {
                res.status(400).json({
                    success: false,
                    message: 'Event is not live'
                });
                return;
            }

            // Check if user is blocked
            const blockedUser = await Participant.findOne({
                roomId: videoEvent.room_id,
                userId: currentUser?.id,
                'metadata.isBlocked': true
            });

            if (blockedUser) {
                res.status(403).json({
                    success: false,
                    message: 'You are blocked from accessing this event'
                });
                return;
            }

            // Check if event is private and user is not the creator
            if (videoEvent.is_private && videoEvent.created_by?.toString() !== currentUser?.id) {
                res.status(403).json({
                    success: false,
                    message: 'This is a private event. You need an invitation to join.'
                });
                return;
            }

            res.json({
                success: true,
                message: 'Access granted',
                data: { canJoin: true }
            });

        } catch (error) {
            console.error('❌ Error checking event access:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to check event access',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get user's video events
     * GET /api/video-events/user/events
     */
    static async getUserVideoEvents(req: Request, res: Response): Promise<void> {
        try {
            const currentUser = req.user;
            const { page = 1, limit = 10 } = req.query;

            const skip = (Number(page) - 1) * Number(limit);

            const videoEvents = await VideoEvent.find({
                $or: [
                    { created_by: currentUser?.id },
                    { 'participants.userId': currentUser?.id }
                ]
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('created_by', 'name email');

            const total = await VideoEvent.countDocuments({
                $or: [
                    { created_by: currentUser?.id },
                    { 'participants.userId': currentUser?.id }
                ]
            });

            res.json({
                success: true,
                data: videoEvents,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit))
                }
            });

        } catch (error) {
            console.error('❌ Error fetching user video events:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user video events',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}

export default VideoEventController;
