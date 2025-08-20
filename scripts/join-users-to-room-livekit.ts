import mongoose from 'mongoose';
import { config } from '../src/config/config';
import { Room } from '../src/models/Room';
import { Participant } from '../src/models/Participant';
import { User } from '../src/models/User';
import { generateJoinToken } from '../src/services/liveket';
import RedisVideoService from '../src/services/redis-enhanced';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import { Room as LiveKitRoom, RoomEvent, RemoteParticipant, LocalParticipant, RoomConnectOptions } from 'livekit-client';

interface JoinUserOptions {
    roomId: string;
    userIds?: string[];
    userCount?: number;
    delayMs?: number;
    role?: 'host' | 'moderator' | 'participant' | 'viewer';
    keepConnected?: boolean; // Whether to keep connections alive
    connectionTimeout?: number; // How long to keep connections (in seconds)
}

interface VirtualParticipant {
    room: LiveKitRoom;
    user: any;
    participantId: string;
    identity: string;
    token: string;
    isConnected: boolean;
    connectionStartTime: number;
}

class LiveKitRoomJoiner {
    private static virtualParticipants: Map<string, VirtualParticipant> = new Map();
    private static isShuttingDown = false;

    private static async connectToDatabase() {
        try {
            await mongoose.connect(config.mongoUri);
            console.log('✅ Connected to MongoDB');
        } catch (error) {
            console.error('❌ Failed to connect to MongoDB:', error);
            process.exit(1);
        }
    }

    private static async disconnectFromDatabase() {
        try {
            await mongoose.disconnect();
            console.log('✅ Disconnected from MongoDB');
        } catch (error) {
            console.error('❌ Error disconnecting from MongoDB:', error);
        }
    }

    private static async validateRoom(roomId: string): Promise<any> {
        try {
            // Try to find room by ObjectId first
            let room = await Room.findOne({ _id: new ObjectId(roomId) });
            
            if (!room) {
                // Try to find by roomId string
                room = await Room.findOne({ roomId });
            }

            if (!room) {
                throw new Error(`Room not found with ID: ${roomId}`);
            }

            if (!room.isActive) {
                throw new Error(`Room is not active: ${roomId}`);
            }

            console.log(`✅ Room validated: ${room.name} (${room.currentParticipants}/${room.maxParticipants} participants)`);
            return room;
        } catch (error) {
            console.error('❌ Room validation failed:', error);
            throw error;
        }
    }

    private static async getUsersToJoin(userIds?: string[], userCount?: number): Promise<any[]> {
        try {
            let users: any[] = [];

            if (userIds && userIds.length > 0) {
                // Use specific user IDs
                users = await User.find({ _id: { $in: userIds.map(id => new ObjectId(id)) } });
                console.log(`✅ Found ${users.length} users with specified IDs`);
            } else if (userCount && userCount > 0) {
                // Get random users up to the specified count
                users = await User.aggregate([
                    { $sample: { size: userCount } }
                ]);
                console.log(`✅ Found ${users.length} random users`);
            } else {
                // Get all users
                users = await User.find({});
                console.log(`✅ Found ${users.length} total users`);
            }

            if (users.length === 0) {
                throw new Error('No users found to join the room');
            }

            return users;
        } catch (error) {
            console.error('❌ Failed to get users:', error);
            throw error;
        }
    }

    private static async createVirtualParticipant(
        room: any, 
        user: any, 
        role: string = 'participant'
    ): Promise<VirtualParticipant | null> {
        try {
            const participantId = uuidv4();
            const identity = `${user._id}-${participantId}`;

            // Check if user is already in the room
            const existingParticipant = await Participant.findOne({
                roomId: room._id,
                userId: user._id,
                isOnline: true
            });

            if (existingParticipant) {
                console.log(`⚠️  User ${user.name} (${user.email}) is already in the room`);
                return null;
            }

            // Generate LiveKit token
            const token = await generateJoinToken({
                identity,
                room: room.roomId,
                metadata: {
                    name: user.name,
                    email: user.email,
                    role
                }
            });

            // Create LiveKit room instance
            const liveKitRoom = new LiveKitRoom();
            
            // Set up event listeners for the virtual participant
            this.setupVirtualParticipantEvents(liveKitRoom, user, participantId);

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
                joinedAt: new Date()
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
                isMuted: false,
                isVideoEnabled: true,
                isScreenSharing: false,
                joinedAt: Date.now(),
                lastActivityAt: Date.now(),
                metadata: {
                    email: user.email
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

            const virtualParticipant: VirtualParticipant = {
                room: liveKitRoom,
                user,
                participantId,
                identity,
                token,
                isConnected: false,
                connectionStartTime: Date.now()
            };

            return virtualParticipant;
        } catch (error) {
            console.error(`❌ Failed to create virtual participant for ${user.name}:`, error);
            return null;
        }
    }

    private static setupVirtualParticipantEvents(liveKitRoom: LiveKitRoom, user: any, participantId: string) {
        // Handle connection events
        liveKitRoom.on(RoomEvent.Connected, () => {
            console.log(`✅ Virtual participant ${user.name} connected to LiveKit`);
            const virtualParticipant = this.virtualParticipants.get(participantId);
            if (virtualParticipant) {
                virtualParticipant.isConnected = true;
            }
        });

        liveKitRoom.on(RoomEvent.Disconnected, (reason) => {
            console.log(`🔌 Virtual participant ${user.name} disconnected: ${reason}`);
            const virtualParticipant = this.virtualParticipants.get(participantId);
            if (virtualParticipant) {
                virtualParticipant.isConnected = false;
            }
        });

        liveKitRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
            console.log(`👥 Virtual participant ${user.name} sees new participant: ${participant.identity}`);
        });

        liveKitRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
            console.log(`👋 Virtual participant ${user.name} sees participant leave: ${participant.identity}`);
        });

        // Handle errors
        liveKitRoom.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
            if (participant instanceof LocalParticipant) {
                console.log(`📊 Virtual participant ${user.name} connection quality: ${quality}`);
            }
        });

        liveKitRoom.on(RoomEvent.MediaDevicesError, (error) => {
            console.log(`🎥 Virtual participant ${user.name} media error: ${error.message}`);
        });
    }

    private static async connectVirtualParticipant(virtualParticipant: VirtualParticipant, room: any): Promise<boolean> {
        try {
            const connectionOptions: RoomConnectOptions = {
                autoSubscribe: true,
                adaptiveStream: true,
                dynacast: true,
                stopLocalTrackOnUnpublish: true,
            };

            console.log(`🔗 Connecting virtual participant ${virtualParticipant.user.name} to LiveKit...`);
            
            await virtualParticipant.room.connect(config.livekitUrl, virtualParticipant.token, connectionOptions);
            
            console.log(`✅ Virtual participant ${virtualParticipant.user.name} successfully connected to LiveKit`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to connect virtual participant ${virtualParticipant.user.name}:`, error);
            return false;
        }
    }

    private static async disconnectVirtualParticipant(virtualParticipant: VirtualParticipant): Promise<void> {
        try {
            if (virtualParticipant.isConnected) {
                await virtualParticipant.room.disconnect();
                console.log(`🔌 Disconnected virtual participant ${virtualParticipant.user.name}`);
            }
        } catch (error) {
            console.error(`❌ Error disconnecting virtual participant ${virtualParticipant.user.name}:`, error);
        }
    }

    private static async cleanupVirtualParticipant(virtualParticipant: VirtualParticipant, room: any): Promise<void> {
        try {
            // Disconnect from LiveKit
            await this.disconnectVirtualParticipant(virtualParticipant);

            // Update database
            await Participant.findOneAndUpdate(
                { participantId: virtualParticipant.participantId },
                { isOnline: false, leftAt: new Date() }
            );

            // Update room participant count
            await Room.findByIdAndUpdate(room._id, {
                $inc: { currentParticipants: -1 },
                lastActivityAt: new Date()
            });

            // Remove from Redis cache
            await RedisVideoService.removeParticipant(virtualParticipant.participantId);
            await RedisVideoService.decrementRoomParticipants(room.roomId);

            // Remove from virtual participants map
            this.virtualParticipants.delete(virtualParticipant.participantId);

            console.log(`🧹 Cleaned up virtual participant ${virtualParticipant.user.name}`);
        } catch (error) {
            console.error(`❌ Error cleaning up virtual participant ${virtualParticipant.user.name}:`, error);
        }
    }

    private static setupGracefulShutdown(room: any) {
        // Handle process termination
        const cleanup = async () => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;
            
            console.log('\n🛑 Shutting down gracefully...');
            
            // Disconnect all virtual participants
            const disconnectPromises = Array.from(this.virtualParticipants.values()).map(
                virtualParticipant => this.cleanupVirtualParticipant(virtualParticipant, room)
            );
            
            await Promise.all(disconnectPromises);
            
            console.log('✅ All virtual participants disconnected');
            process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('SIGQUIT', cleanup);
    }

    public static async joinUsersToRoom(options: JoinUserOptions): Promise<void> {
        console.log('🚀 Starting LiveKit room joining process...');
        console.log('Options:', JSON.stringify(options, null, 2));

        let room: any = null;

        try {
            // Connect to database
            await this.connectToDatabase();

            // Validate room
            room = await this.validateRoom(options.roomId);

            // Get users to join
            const users = await this.getUsersToJoin(options.userIds, options.userCount);

            // Check if we have enough space in the room
            const availableSlots = room.maxParticipants - room.currentParticipants;
            if (users.length > availableSlots) {
                console.log(`⚠️  Warning: Only ${availableSlots} slots available, but ${users.length} users to join`);
                users.splice(availableSlots);
            }

            console.log(`\n📋 Joining ${users.length} users to LiveKit room: ${room.name}`);
            console.log('=' .repeat(50));

            let successCount = 0;
            let failureCount = 0;

            // Setup graceful shutdown
            this.setupGracefulShutdown(room);

            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const delay = options.delayMs || 1000; // Default 1 second delay

                console.log(`\n👤 [${i + 1}/${users.length}] Creating virtual participant: ${user.name} (${user.email})`);

                // Create virtual participant
                const virtualParticipant = await this.createVirtualParticipant(room, user, options.role || 'participant');

                if (!virtualParticipant) {
                    failureCount++;
                    continue;
                }

                // Connect to LiveKit
                const connected = await this.connectVirtualParticipant(virtualParticipant, room);

                if (connected) {
                    // Store virtual participant
                    this.virtualParticipants.set(virtualParticipant.participantId, virtualParticipant);
                    successCount++;
                    console.log(`✅ Virtual participant ${user.name} joined and connected to LiveKit`);
                } else {
                    failureCount++;
                    console.log(`❌ Failed to connect virtual participant ${user.name} to LiveKit`);
                }

                // Add delay between joins (except for the last user)
                if (i < users.length - 1 && delay > 0) {
                    console.log(`⏳ Waiting ${delay}ms before next join...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            console.log('\n' + '=' .repeat(50));
            console.log('📊 Join Summary:');
            console.log(`✅ Successful joins: ${successCount}`);
            console.log(`❌ Failed joins: ${failureCount}`);
            console.log(`🔗 Active LiveKit connections: ${this.virtualParticipants.size}`);

            // Get final room stats
            const updatedRoom = await Room.findById(room._id);
            if (updatedRoom) {
                console.log(`🏠 Room: ${updatedRoom.name}`);
                console.log(`👥 Current participants: ${updatedRoom.currentParticipants}/${updatedRoom.maxParticipants}`);
            }

            // Keep connections alive if requested
            if (options.keepConnected !== false) {
                const timeout = options.connectionTimeout || 300; // Default 5 minutes
                console.log(`\n⏰ Keeping connections alive for ${timeout} seconds...`);
                console.log('Press Ctrl+C to disconnect all participants and exit');
                
                // Set timeout to disconnect all participants
                setTimeout(async () => {
                    console.log(`\n⏰ Connection timeout reached (${timeout}s), disconnecting all participants...`);
                    await this.disconnectAllParticipants(room);
                    await this.disconnectFromDatabase();
                    process.exit(0);
                }, timeout * 1000);

                // Keep the process alive
                await new Promise(() => {}); // This will keep the process running indefinitely
            } else {
                // Disconnect immediately
                await this.disconnectAllParticipants(room);
            }

        } catch (error) {
            console.error('❌ LiveKit room joining process failed:', error);
            if (room) {
                await this.disconnectAllParticipants(room);
            }
            process.exit(1);
        } finally {
            await this.disconnectFromDatabase();
        }
    }

    private static async disconnectAllParticipants(room: any): Promise<void> {
        console.log('\n🔌 Disconnecting all virtual participants...');
        
        const disconnectPromises = Array.from(this.virtualParticipants.values()).map(
            virtualParticipant => this.cleanupVirtualParticipant(virtualParticipant, room)
        );
        
        await Promise.all(disconnectPromises);
        
        console.log('✅ All virtual participants disconnected');
    }
}

// CLI argument parsing
function parseArguments(): JoinUserOptions {
    const args = process.argv.slice(2);
    const options: JoinUserOptions = {
        roomId: '',
        delayMs: 1000,
        keepConnected: true,
        connectionTimeout: 300
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const nextArg = args[i + 1];

        switch (arg) {
            case '--roomId':
            case '-r':
                if (nextArg) {
                    options.roomId = nextArg;
                    i++;
                }
                break;
            case '--userIds':
            case '-u':
                if (nextArg) {
                    options.userIds = nextArg.split(',').map(id => id.trim());
                    i++;
                }
                break;
            case '--userCount':
            case '-c':
                if (nextArg) {
                    options.userCount = parseInt(nextArg);
                    i++;
                }
                break;
            case '--delay':
            case '-d':
                if (nextArg) {
                    options.delayMs = parseInt(nextArg);
                    i++;
                }
                break;
            case '--role':
                if (nextArg) {
                    options.role = nextArg as 'host' | 'moderator' | 'participant' | 'viewer';
                    i++;
                }
                break;
            case '--keepConnected':
                if (nextArg) {
                    options.keepConnected = nextArg.toLowerCase() === 'true';
                    i++;
                }
                break;
            case '--timeout':
            case '-t':
                if (nextArg) {
                    options.connectionTimeout = parseInt(nextArg);
                    i++;
                }
                break;
            case '--help':
            case '-h':
                showHelp();
                process.exit(0);
                break;
        }
    }

    if (!options.roomId) {
        console.error('❌ Room ID is required. Use --roomId or -r');
        showHelp();
        process.exit(1);
    }

    return options;
}

function showHelp(): void {
    console.log(`
🚀 LiveKit Room Joiner Script

This script creates virtual participants that actually connect to LiveKit and show up in your app.

Usage: npm run join-users-livekit -- [options]

Options:
  --roomId, -r <roomId>           Room ID to join users to (required)
  --userIds, -u <id1,id2,id3>     Comma-separated list of user IDs to join
  --userCount, -c <number>        Number of random users to join
  --delay, -d <milliseconds>      Delay between joins (default: 1000ms)
  --role <role>                   Role for users (host|moderator|participant|viewer, default: participant)
  --keepConnected <boolean>       Keep connections alive (default: true)
  --timeout, -t <seconds>         Connection timeout in seconds (default: 300)
  --help, -h                      Show this help message

Examples:
  # Join 5 random users and keep them connected for 5 minutes
  npm run join-users-livekit -- --roomId 507f1f77bcf86cd799439011 --userCount 5

  # Join specific users with custom delay
  npm run join-users-livekit -- --roomId 507f1f77bcf86cd799439011 --userIds 507f1f77bcf86cd799439012,507f1f77bcf86cd799439013 --delay 2000

  # Join users and disconnect immediately
  npm run join-users-livekit -- --roomId 507f1f77bcf86cd799439011 --userCount 3 --keepConnected false

  # Join users with custom timeout
  npm run join-users-livekit -- --roomId 507f1f77bcf86cd799439011 --userCount 10 --timeout 600

  # Join all users to a room
  npm run join-users-livekit -- --roomId 507f1f77bcf86cd799439011
`);
}

// Main execution
if (require.main === module) {
    try {
        const options = parseArguments();
        LiveKitRoomJoiner.joinUsersToRoom(options);
    } catch (error) {
        console.error('❌ Script execution failed:', error);
        process.exit(1);
    }
}

export { LiveKitRoomJoiner, JoinUserOptions };
