import mongoose from 'mongoose';
import { config } from '../src/config/config';
import { Room } from '../src/models/Room';
import { Participant } from '../src/models/Participant';
import { User } from '../src/models/User';
import RedisVideoService from '../src/services/redis-enhanced';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';

interface VirtualParticipantOptions {
    roomId: string;
    userIds?: string[];
    userCount?: number;
    delayMs?: number;
    role?: 'host' | 'moderator' | 'participant' | 'viewer';
    isVirtual?: boolean; // Mark as virtual participant
    keepAlive?: boolean; // Keep them "online" for a period
    keepAliveDuration?: number; // How long to keep them online (in seconds)
}

class VirtualParticipantManager {
    private static keepAliveIntervals: Map<string, NodeJS.Timeout> = new Map();

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

    private static async getUsersToAdd(userIds?: string[], userCount?: number): Promise<any[]> {
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
                throw new Error('No users found to add to the room');
            }

            return users;
        } catch (error) {
            console.error('❌ Failed to get users:', error);
            throw error;
        }
    }

    private static async addVirtualParticipant(
        room: any, 
        user: any, 
        role: string = 'participant',
        isVirtual: boolean = true
    ): Promise<{ success: boolean; participantId?: string; error?: string }> {
        try {
            const participantId = uuidv4();
            const identity = `virtual-${user._id}-${participantId}`;

            // Check if user is already in the room
            const existingParticipant = await Participant.findOne({
                roomId: room._id,
                userId: user._id,
                isOnline: true
            });

            if (existingParticipant) {
                console.log(`⚠️  User ${user.name} (${user.email}) is already in the room`);
                return { success: false, error: 'User already in room' };
            }

            // Create participant in database with virtual flag
            const participant = new Participant({
                participantId,
                roomId: room._id,
                userId: user._id,
                identity,
                name: user.name,
                email: user.email,
                role,
                isOnline: true,
                isVirtual: isVirtual, // Mark as virtual participant
                joinedAt: new Date(),
                metadata: {
                    isVirtual: isVirtual,
                    addedBy: 'backend-script',
                    addedAt: new Date().toISOString()
                }
            });

            await participant.save();

            // Cache participant in Redis with virtual flag
            const participantCache: any = {
                participantId,
                roomId: room.roomId,
                identity,
                name: user.name,
                role,
                isOnline: true,
                isVirtual: isVirtual,
                isMuted: false,
                isVideoEnabled: false, // Virtual participants don't have video
                isScreenSharing: false,
                joinedAt: Date.now(),
                lastActivityAt: Date.now(),
                metadata: {
                    email: user.email,
                    isVirtual: isVirtual,
                    addedBy: 'backend-script',
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

            console.log(`✅ Virtual participant ${user.name} (${user.email}) added to room as ${role}`);
            return { success: true, participantId };
        } catch (error) {
            console.error(`❌ Failed to add virtual participant ${user.name}:`, error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    private static async setupKeepAlive(participantId: string, room: any, duration: number): Promise<void> {
        // Set up periodic activity updates to keep the participant "alive"
        const interval = setInterval(async () => {
            try {
                // Update last activity in Redis
                await RedisVideoService.updateParticipantActivity(participantId);
                
                // Update room activity
                await RedisVideoService.updateRoomActivity(room.roomId);
                
                console.log(`💓 Virtual participant ${participantId} keep-alive ping`);
            } catch (error) {
                console.error(`❌ Keep-alive error for participant ${participantId}:`, error);
            }
        }, 30000); // Update every 30 seconds

        // Store the interval for cleanup
        this.keepAliveIntervals.set(participantId, interval);

        // Set timeout to remove the participant after the specified duration
        setTimeout(async () => {
            await this.removeVirtualParticipant(participantId, room);
        }, duration * 1000);
    }

    private static async removeVirtualParticipant(participantId: string, room: any): Promise<void> {
        try {
            // Clear keep-alive interval
            const interval = this.keepAliveIntervals.get(participantId);
            if (interval) {
                clearInterval(interval);
                this.keepAliveIntervals.delete(participantId);
            }

            // Update database
            await Participant.findOneAndUpdate(
                { participantId },
                { isOnline: false, leftAt: new Date() }
            );

            // Update room participant count
            await Room.findByIdAndUpdate(room._id, {
                $inc: { currentParticipants: -1 },
                lastActivityAt: new Date()
            });

            // Remove from Redis cache
            await RedisVideoService.removeParticipant(participantId, room.roomId);
            await RedisVideoService.decrementRoomParticipants(room.roomId);

            console.log(`🧹 Removed virtual participant ${participantId}`);
        } catch (error) {
            console.error(`❌ Error removing virtual participant ${participantId}:`, error);
        }
    }

    private static setupGracefulShutdown(room: any) {
        // Handle process termination
        const cleanup = async () => {
            console.log('\n🛑 Shutting down gracefully...');
            
            // Clear all keep-alive intervals
            for (const [participantId, interval] of this.keepAliveIntervals.entries()) {
                clearInterval(interval);
                await this.removeVirtualParticipant(participantId, room);
            }
            
            console.log('✅ All virtual participants removed');
            process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('SIGQUIT', cleanup);
    }

    public static async addVirtualParticipants(options: VirtualParticipantOptions): Promise<void> {
        console.log('🚀 Starting virtual participant addition process...');
        console.log('Options:', JSON.stringify(options, null, 2));

        let room: any = null;

        try {
            // Connect to database
            await this.connectToDatabase();

            // Validate room
            room = await this.validateRoom(options.roomId);

            // Get users to add
            const users = await this.getUsersToAdd(options.userIds, options.userCount);

            // Check if we have enough space in the room
            const availableSlots = room.maxParticipants - room.currentParticipants;
            if (users.length > availableSlots) {
                console.log(`⚠️  Warning: Only ${availableSlots} slots available, but ${users.length} users to add`);
                users.splice(availableSlots);
            }

            console.log(`\n📋 Adding ${users.length} virtual participants to room: ${room.name}`);
            console.log('=' .repeat(50));

            let successCount = 0;
            let failureCount = 0;
            const addedParticipantIds: string[] = [];

            // Setup graceful shutdown
            this.setupGracefulShutdown(room);

            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const delay = options.delayMs || 1000; // Default 1 second delay

                console.log(`\n👤 [${i + 1}/${users.length}] Adding virtual participant: ${user.name} (${user.email})`);

                // Add virtual participant
                const result = await this.addVirtualParticipant(
                    room, 
                    user, 
                    options.role || 'participant',
                    options.isVirtual !== false
                );

                if (result.success && result.participantId) {
                    successCount++;
                    addedParticipantIds.push(result.participantId);

                    // Setup keep-alive if requested
                    if (options.keepAlive !== false) {
                        const duration = options.keepAliveDuration || 3600; // Default 1 hour
                        await this.setupKeepAlive(result.participantId, room, duration);
                        console.log(`⏰ Virtual participant will stay online for ${duration} seconds`);
                    }
                } else {
                    failureCount++;
                    console.log(`❌ Failed to add virtual participant ${user.name}: ${result.error}`);
                }

                // Add delay between additions (except for the last user)
                if (i < users.length - 1 && delay > 0) {
                    console.log(`⏳ Waiting ${delay}ms before next addition...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            console.log('\n' + '=' .repeat(50));
            console.log('📊 Addition Summary:');
            console.log(`✅ Successful additions: ${successCount}`);
            console.log(`❌ Failed additions: ${failureCount}`);
            console.log(`👥 Virtual participants added: ${addedParticipantIds.length}`);

            // Get final room stats
            const updatedRoom = await Room.findById(room._id);
            if (updatedRoom) {
                console.log(`🏠 Room: ${updatedRoom.name}`);
                console.log(`👥 Current participants: ${updatedRoom.currentParticipants}/${updatedRoom.maxParticipants}`);
            }

            // Keep the process alive if keep-alive is enabled
            if (options.keepAlive !== false) {
                const duration = options.keepAliveDuration || 3600;
                console.log(`\n⏰ Virtual participants will stay online for ${duration} seconds...`);
                console.log('Press Ctrl+C to remove all virtual participants and exit');
                
                // Keep the process alive
                await new Promise(() => {}); // This will keep the process running indefinitely
            } else {
                console.log('\n✅ Virtual participants added successfully. They will remain in the room.');
            }

        } catch (error) {
            console.error('❌ Virtual participant addition process failed:', error);
            process.exit(1);
        } finally {
            await this.disconnectFromDatabase();
        }
    }

    // Utility method to remove all virtual participants from a room
    public static async removeAllVirtualParticipants(roomId: string): Promise<void> {
        try {
            await this.connectToDatabase();
            
            const room = await this.validateRoom(roomId);
            
            // Find all virtual participants in the room
            const virtualParticipants = await Participant.find({
                roomId: room._id,
                isVirtual: true,
                isOnline: true
            });

            console.log(`🧹 Removing ${virtualParticipants.length} virtual participants from room: ${room.name}`);

            for (const participant of virtualParticipants) {
                await this.removeVirtualParticipant(participant.participantId, room);
            }

            console.log('✅ All virtual participants removed');
        } catch (error) {
            console.error('❌ Failed to remove virtual participants:', error);
        } finally {
            await this.disconnectFromDatabase();
        }
    }
}

// CLI argument parsing
function parseArguments(): VirtualParticipantOptions {
    const args = process.argv.slice(2);
    const options: VirtualParticipantOptions = {
        roomId: '',
        delayMs: 1000,
        isVirtual: true,
        keepAlive: true,
        keepAliveDuration: 3600
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
            case '--keepAlive':
                if (nextArg) {
                    options.keepAlive = nextArg.toLowerCase() === 'true';
                    i++;
                }
                break;
            case '--duration':
                if (nextArg) {
                    options.keepAliveDuration = parseInt(nextArg);
                    i++;
                }
                break;
            case '--remove':
                if (nextArg) {
                    // Special case for removing virtual participants
                    VirtualParticipantManager.removeAllVirtualParticipants(nextArg);
                    process.exit(0);
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
🚀 Virtual Participant Manager

This script adds virtual participants to a room that will show up in your app without requiring real device connections.

Usage: npm run add-virtual-participants -- [options]

Options:
  --roomId, -r <roomId>           Room ID to add participants to (required)
  --userIds, -u <id1,id2,id3>     Comma-separated list of user IDs to add
  --userCount, -c <number>        Number of random users to add
  --delay, -d <milliseconds>      Delay between additions (default: 1000ms)
  --role <role>                   Role for users (host|moderator|participant|viewer, default: participant)
  --keepAlive <boolean>           Keep participants online (default: true)
  --duration <seconds>            How long to keep participants online (default: 3600)
  --remove <roomId>               Remove all virtual participants from a room
  --help, -h                      Show this help message

Examples:
  # Add 5 random virtual participants for 1 hour
  npm run add-virtual-participants -- --roomId 507f1f77bcf86cd799439011 --userCount 5

  # Add specific users as virtual participants
  npm run add-virtual-participants -- --roomId 507f1f77bcf86cd799439011 --userIds 507f1f77bcf86cd799439012,507f1f77bcf86cd799439013

  # Add virtual participants for 30 minutes
  npm run add-virtual-participants -- --roomId 507f1f77bcf86cd799439011 --userCount 10 --duration 1800

  # Add virtual participants without keep-alive (they stay permanently)
  npm run add-virtual-participants -- --roomId 507f1f77bcf86cd799439011 --userCount 3 --keepAlive false

  # Remove all virtual participants from a room
  npm run add-virtual-participants -- --remove 507f1f77bcf86cd799439011

  # Add all users as virtual participants
  npm run add-virtual-participants -- --roomId 507f1f77bcf86cd799439011
`);
}

// Main execution
if (require.main === module) {
    try {
        const options = parseArguments();
        VirtualParticipantManager.addVirtualParticipants(options);
    } catch (error) {
        console.error('❌ Script execution failed:', error);
        process.exit(1);
    }
}

export { VirtualParticipantManager, VirtualParticipantOptions };
