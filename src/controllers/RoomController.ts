import { Request, Response } from 'express';
import { Room, IRoom } from '../models/Room';
import { Participant } from '../models/Participant';
import { Session } from '../models/Session';
import { User } from '../models/User';
import { 
    generateJoinToken, 
    createRoomIfNotExists, 
    deleteRoom as deleteLiveKitRoom,
    getRoomStats 
} from '../services/liveket';
import RedisVideoService from '../services/redis-enhanced';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import { config } from '../config/config';

export class RoomController {
    
    /**
     * Create a new room
     * POST /api/rooms
     */
    static async createRoom(req: Request, res: Response): Promise<void> {
        try {
            const {
                name,
                description,
                maxParticipants = 20,
                settings = {},
                metadata = {}
            } = req.body;

            console.log('createRoom', req?.user);
            const createdBy = req.user?.id || req.body.createdBy;

            if (!createdBy) {
                res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
                return;
            }

            // Validate required fields
            if (!name || name.trim().length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Room name is required'
                });
                return;
            }

            const roomId = uuidv4();

            // Create room in LiveKit
            const livekitRoom = await createRoomIfNotExists(roomId, {
                name,
                maxParticipants
            });

            // Create room in database
            const room = new Room({
                roomId,
                name: name.trim(),
                description: description?.trim(),
                createdBy,
                maxParticipants,
                settings: {
                    recordingEnabled: settings.recordingEnabled ?? true,
                    chatEnabled: settings.chatEnabled ?? true,
                    screenShareEnabled: settings.screenShareEnabled ?? true,
                    waitingRoomEnabled: settings.waitingRoomEnabled ?? false,
                    moderatorApprovalRequired: settings.moderatorApprovalRequired ?? false
                },
                metadata
            });

            await room.save();

            // Cache room in Redis
            await RedisVideoService.cacheRoom({
                roomId,
                name: room.name,
                isActive: room.isActive,
                participantCount: room.currentParticipants,
                maxParticipants: room.maxParticipants,
                hostId: room.createdBy,
                settings: room.settings,
                metadata: room.metadata,
                lastActivityAt: Date.now(),
                createdAt: Date.now()
            });

            res.status(201).json({
                success: true,
                message: 'Room created successfully',
                data: {
                    roomId: room.roomId,
                    _id: room._id,
                    name: room.name,
                    description: room.description,
                    maxParticipants: room.maxParticipants,
                    settings: room.settings,
                    status: (room as any).status,
                    createdAt: room.createdAt
                }
            });

        } catch (error) {
            console.error('❌ Error creating room:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create room',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get all rooms with pagination and filters
     * GET /api/rooms
     */
    static async getRooms(req: Request, res: Response): Promise<void> {
        try {
            const {
                page = 1,
                limit = 10,
                status,
                createdBy,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = req.query;

            const pageNum = parseInt(page as string);
            const limitNum = parseInt(limit as string);
            const skip = (pageNum - 1) * limitNum;

            // Build filter
            const filter: any = {};
            
            if (status) {
                if (status === 'active') {
                    filter.isActive = true;
                } else if (status === 'inactive') {
                    filter.isActive = false;
                }
            }

            if (createdBy) {
                filter.createdBy = createdBy;
            }

            if (search) {
                filter.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            // Build sort
            const sort: any = {};
            sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

            // Execute query
            const rooms = await Room.find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .lean();

            const total = await Room.countDocuments(filter);

            // Get additional stats for each room
            const roomsWithStats = await Promise.all(
                rooms.map(async (room) => {
                    const participantCount = await Participant.countDocuments({
                        roomId: room.roomId,
                        isOnline: true
                    });

                    const activeSessions = await Session.countDocuments({
                        roomId: room.roomId,
                        status: 'active'
                    });

                    return {
                        ...room,
                        participantCount,
                        activeSessions
                    };
                })
            );

            res.json({
                success: true,
                data: {
                    rooms: roomsWithStats,
                    pagination: {
                        page: pageNum,
                        limit: limitNum,
                        total,
                        pages: Math.ceil(total / limitNum)
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error fetching rooms:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch rooms',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get a specific room by ID
     * GET /api/rooms/:roomId
     */
    static async getRoom(req: Request, res: Response): Promise<void> {
        try {
            const { roomId } = req.params;

            // Try to get from cache first
            let room = await RedisVideoService.getCachedRoom(roomId);

            if (!room) {
                // Get from database
                const dbRoom = await Room.findOne({ _id: new ObjectId(roomId) });
                
                if (!dbRoom) {
                    res.status(404).json({
                        success: false,
                        message: 'Room not found'
                    });
                    return;
                }

                room = {
                    roomId: dbRoom.roomId,
                    name: dbRoom.name,
                    isActive: dbRoom.isActive,
                    participantCount: dbRoom.currentParticipants,
                    maxParticipants: dbRoom.maxParticipants,
                    hostId: dbRoom.createdBy,
                    settings: dbRoom.settings,
                    metadata: dbRoom.metadata,
                    lastActivityAt: dbRoom.lastActivityAt.getTime(),
                    createdAt: dbRoom.createdAt.getTime()
                };

                // Cache the room
                await RedisVideoService.cacheRoom(room);
            }

            // Get LiveKit room stats
            const livekitStats = await getRoomStats(roomId);

            // Get participants
            const participants = await Participant.find({ roomId, isOnline: true }).sort({ joinedAt: 1 });

            // Get active sessions
            const activeSessions = await Session.find({ roomId, status: 'active' }).sort({ startTime: -1 });

            res.json({
                success: true,
                data: {
                    room,
                    livekitStats,
                    participants: participants.length,
                    activeSessions: activeSessions.length
                }
            });

        } catch (error) {
            console.error('❌ Error fetching room:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch room',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Update a room
     * PUT /api/rooms/:roomId
     */
    static async updateRoom(req: Request, res: Response): Promise<void> {
        try {
            const { roomId } = req.params;
            const updates = req.body;

            // Check if room exists
            const room = await Room.findOne({ roomId });
            if (!room) {
                res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
                return;
            }

            // Check permissions (only creator can update)
            const userId = req.user?.id || req.body.userId;
            if (room.createdBy !== userId) {
                res.status(403).json({
                    success: false,
                    message: 'You can only update rooms you created'
                });
                return;
            }

            // Update allowed fields
            const allowedUpdates = ['name', 'description', 'maxParticipants', 'settings', 'metadata'];
            const filteredUpdates: any = {};

            allowedUpdates.forEach(field => {
                if (updates[field] !== undefined) {
                    filteredUpdates[field] = updates[field];
                }
            });

            // Update room
            Object.assign(room, filteredUpdates);
            await room.save();

            // Update cache
            await RedisVideoService.cacheRoom({
                roomId: room.roomId,
                name: room.name,
                isActive: room.isActive,
                participantCount: room.currentParticipants,
                maxParticipants: room.maxParticipants,
                hostId: room.createdBy,
                settings: room.settings,
                metadata: room.metadata,
                lastActivityAt: Date.now(),
                createdAt: room.createdAt.getTime()
            });

            res.json({
                success: true,
                message: 'Room updated successfully',
                data: {
                    roomId: room.roomId,
                    name: room.name,
                    description: room.description,
                    maxParticipants: room.maxParticipants,
                    settings: room.settings,
                    status: (room as any).status,
                    updatedAt: room.updatedAt
                }
            });

        } catch (error) {
            console.error('❌ Error updating room:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update room',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Delete a room
     * DELETE /api/rooms/:roomId
     */
    static async deleteRoom(req: Request, res: Response): Promise<void> {
        try {
            const { roomId } = req.params;

            // Check if room exists
            const room = await Room.findOne({ roomId });
            if (!room) {
                res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
                return;
            }

            // Check permissions
            const userId = req.user?.id || req.body.userId;
            if (room.createdBy !== userId) {
                res.status(403).json({
                    success: false,
                    message: 'You can only delete rooms you created'
                });
                return;
            }

            // Check if room has active participants
            const activeParticipants = await Participant.countDocuments({
                roomId,
                isOnline: true
            });

            if (activeParticipants > 0) {
                res.status(400).json({
                    success: false,
                    message: 'Cannot delete room with active participants'
                });
                return;
            }

            // Delete from LiveKit
            await deleteLiveKitRoom(roomId);

            // Delete from database
            await Room.deleteOne({ roomId });

            // Remove from cache
            await RedisVideoService.deleteCache(`room:${roomId}`);

            // Delete related data
            await Participant.deleteMany({ roomId });
            await Session.deleteMany({ roomId });

            res.json({
                success: true,
                message: 'Room deleted successfully'
            });

        } catch (error) {
            console.error('❌ Error deleting room:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete room',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Generate join token for a room
     * POST /api/rooms/:roomId/token
     */
    static async generateToken(req: Request, res: Response): Promise<void> {
        try {

            const { roomId } = req.params;
            const { identity, participantName } = req.body;
            const  user  = req.user as any;
            const name = participantName || user?.name || 'Anonymous';
            const email = user?.email;
            const role = user?.role || 'participant';

    
            // Check if room exists and is active
            const room = await Room.findOne({ _id: new ObjectId(roomId), isActive: true });
            if (!room) {
                res.status(404).json({
                    success: false,
                    message: 'Room not found or inactive'
                });
                return;
            }

            // Check if room is full
            if (room.currentParticipants >= room.maxParticipants) {
                res.status(400).json({
                    success: false,
                    message: 'Room is at maximum capacity'
                });
                return;
            }

            // Generate token
            const token = await generateJoinToken({
                identity: identity || roomId,
                room: roomId,
                metadata: {
                    name,
                    email,
                    role
                }
            });

            res.json({
                success: true,
                data: {
                    token,
                    roomId: room.roomId,
                    identity: identity || roomId,
                    name,
                    role,
                    url: config.livekitUrl,
                    expiresIn: 3600 // 1 hour
                }
            });

        } catch (error) {
            console.error('❌ Error generating token:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate token',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get room statistics
     * GET /api/rooms/:roomId/stats
     */
    static async getRoomStats(req: Request, res: Response): Promise<void> {
        try {
            const { roomId } = req.params;

            // Get room
            const room = await Room.findOne({ roomId });
            if (!room) {
                res.status(404).json({
                    success: false,
                    message: 'Room not found'
                });
                return;
            }

            // Get LiveKit stats
            const livekitStats = await getRoomStats(roomId);

            // Get participant count
            const participantCount = await Participant.countDocuments({ roomId, isOnline: true });

            // Get session stats
            const totalSessions = await Session.countDocuments({ roomId });
            const activeSessions = await Session.countDocuments({ roomId, status: 'active' });
            const endedSessions = await Session.countDocuments({ roomId, status: 'ended' });

            // Get recent sessions
            const recentSessions = await Session.find({ roomId }).sort({ startTime: -1 }).limit(5);

            res.json({
                success: true,
                data: {
                    room: {
                        roomId: room.roomId,
                        name: room.name,
                        status: (room as any).status,
                        participantCount,
                        maxParticipants: room.maxParticipants
                    },
                    livekit: livekitStats,
                    sessions: {
                        total: totalSessions,
                        active: activeSessions,
                        ended: endedSessions,
                        recent: recentSessions
                    }
                }
            });

        } catch (error) {
            console.error('❌ Error fetching room stats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch room statistics',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Join random users to a room (for testing/demo purposes)
     * POST /api/rooms/:roomId/join-random-users
     */
    static async joinRandomUsers(req: Request, res: Response): Promise<void> {
        try {
            const { roomId } = req.params;
            const { count = 1, role = 'participant', delayMs = 1000 } = req.body;

            // Validate count
            if (count < 1 || count > 20) {
                res.status(400).json({
                    success: false,
                    message: 'Count must be between 1 and 20'
                });
                return;
            }

            // Check if room exists and is active
            const room = await Room.findOne({ _id: new ObjectId(roomId), isActive: true });
            if (!room) {
                res.status(404).json({
                    success: false,
                    message: 'Room not found or inactive'
                });
                return;
            }

            // Check if room has capacity
            if (room.currentParticipants >= room.maxParticipants) {
                res.status(400).json({
                    success: false,
                    message: 'Room is at maximum capacity'
                });
                return;
            }

            // Get random users
            const users = await User.aggregate([
                { $sample: { size: Math.min(count, room.maxParticipants - room.currentParticipants) } }
            ]);

            if (users.length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'No users available to join'
                });
                return;
            }

            const joinedUsers = [];
            let successCount = 0;

            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const participantId = uuidv4();
                const identity = `virtual-${user._id}-${participantId}`;

                // Check if user is already in the room
                const existingParticipant = await Participant.findOne({
                    roomId: room._id,
                    userId: user._id,
                    isOnline: true
                });

                if (existingParticipant) {
                    console.log(`⚠️  User ${user.name} is already in the room`);
                    continue;
                }

                // Create participant in database
                const participant = new Participant({
                    participantId,
                    roomId: room._id,
                    userId: user._id,
                    identity,
                    name: user.name,
                    email: user.email,
                    role,
                    isOnline: true,
                    isVirtual: true, // Mark as virtual participant
                    joinedAt: new Date(),
                    metadata: {
                        isVirtual: true,
                        addedBy: 'api-endpoint',
                        addedAt: new Date().toISOString()
                    }
                });

                await participant.save();

                // Cache participant in Redis
                const participantCache: any = {
                    participantId,
                    roomId: room.roomId,
                    identity,
                    name: user.name,
                    role,
                    isOnline: true,
                    isVirtual: true,
                    isMuted: false,
                    isVideoEnabled: false,
                    isScreenSharing: false,
                    joinedAt: Date.now(),
                    lastActivityAt: Date.now(),
                    metadata: {
                        email: user.email,
                        isVirtual: true,
                        addedBy: 'api-endpoint',
                        addedAt: new Date().toISOString()
                    }
                };

                await RedisVideoService.cacheParticipant(participantCache);

                // Update room participant count
                await Room.findByIdAndUpdate(room._id, {
                    $inc: { currentParticipants: 1 },
                    lastActivityAt: new Date()
                });

                await RedisVideoService.incrementRoomParticipants(room.roomId);
                await RedisVideoService.updateRoomActivity(room.roomId);

                joinedUsers.push({
                    participantId,
                    name: user.name,
                    email: user.email,
                    role
                });

                successCount++;

                // Add delay between joins
                if (i < users.length - 1 && delayMs > 0) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }

            res.json({
                success: true,
                message: `Successfully joined ${successCount} random users to the room`,
                data: {
                    roomId: room.roomId,
                    roomName: room.name,
                    joinedUsers,
                    totalParticipants: room.currentParticipants + successCount,
                    maxParticipants: room.maxParticipants
                }
            });

        } catch (error) {
            console.error('❌ Error joining random users:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to join random users',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Join as a different user to a room
     * POST /api/rooms/:roomId/join-as-user
     */
    static async joinAsUser(req: Request, res: Response): Promise<void> {
        try {
            const { roomId } = req.params;
            const { name, email, role = 'participant' } = req.body;

            // Validate required fields
            if (!name || name.trim().length === 0) {
                res.status(400).json({
                    success: false,
                    message: 'Name is required'
                });
                return;
            }

            // Check if room exists and is active
            const room = await Room.findOne({ _id: new ObjectId(roomId), isActive: true });
            if (!room) {
                res.status(404).json({
                    success: false,
                    message: 'Room not found or inactive'
                });
                return;
            }

            // Check if room is full
            if (room.currentParticipants >= room.maxParticipants) {
                res.status(400).json({
                    success: false,
                    message: 'Room is at maximum capacity'
                });
                return;
            }

            // Generate unique identity for the user
            const identity = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Generate token
            const token = await generateJoinToken({
                identity,
                room: roomId,
                metadata: {
                    name: name.trim(),
                    email: email?.trim(),
                    role
                }
            });

            res.json({
                success: true,
                data: {
                    token,
                    roomId: room.roomId,
                    identity,
                    name: name.trim(),
                    email: email?.trim(),
                    role,
                    url: config.livekitUrl,
                    expiresIn: 3600 // 1 hour
                }
            });

        } catch (error) {
            console.error('❌ Error joining as user:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to join as user',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}

export default RoomController;
