import mongoose from 'mongoose';
import { config } from '../src/config/config';
import { Room } from '../src/models/Room';
import { Participant } from '../src/models/Participant';
import { User } from '../src/models/User';
import { generateJoinToken } from '../src/services/liveket';
import RedisVideoService from '../src/services/redis-enhanced';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';

interface JoinUserOptions {
    roomId: string;
    userIds?: string[];
    userCount?: number;
    delayMs?: number;
    role?: 'host' | 'moderator' | 'participant' | 'viewer';
}

class RoomJoiner {
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

            if (room.currentParticipants >= room.maxParticipants) {
                throw new Error(`Room is at maximum capacity (${room.currentParticipants}/${room.maxParticipants})`);
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

    private static async joinUserToRoom(
        room: any, 
        user: any, 
        role: string = 'participant'
    ): Promise<{ success: boolean; participantId?: string; error?: string }> {
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
                return { success: false, error: 'User already in room' };
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
            const participantCache:any = {
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

            console.log(`✅ User ${user.name} (${user.email}) joined room as ${role}`);
            return { success: true, participantId };
        } catch (error) {
            console.error(`❌ Failed to join user ${user.name}:`, error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    public static async joinUsersToRoom(options: JoinUserOptions): Promise<void> {
        console.log('🚀 Starting room joining process...');
        console.log('Options:', JSON.stringify(options, null, 2));

        try {
            // Connect to database
            await this.connectToDatabase();

            // Validate room
            const room = await this.validateRoom(options.roomId);

            // Get users to join
            const users = await this.getUsersToJoin(options.userIds, options.userCount);

            // Check if we have enough space in the room
            const availableSlots = room.maxParticipants - room.currentParticipants;
            if (users.length > availableSlots) {
                console.log(`⚠️  Warning: Only ${availableSlots} slots available, but ${users.length} users to join`);
                users.splice(availableSlots);
            }

            console.log(`\n📋 Joining ${users.length} users to room: ${room.name}`);
            console.log('=' .repeat(50));

            let successCount = 0;
            let failureCount = 0;

            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const delay = options.delayMs || 1000; // Default 1 second delay

                console.log(`\n👤 [${i + 1}/${users.length}] Joining user: ${user.name} (${user.email})`);

                const result = await this.joinUserToRoom(room, user, options.role || 'participant');

                if (result.success) {
                    successCount++;
                } else {
                    failureCount++;
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
            console.log(`📈 Total users in room: ${room.currentParticipants + successCount}`);

            // Get final room stats
            const updatedRoom = await Room.findById(room._id);
            if (updatedRoom) {
                console.log(`🏠 Room: ${updatedRoom.name}`);
                console.log(`👥 Current participants: ${updatedRoom.currentParticipants}/${updatedRoom.maxParticipants}`);
            }

        } catch (error) {
            console.error('❌ Room joining process failed:', error);
            process.exit(1);
        } finally {
            await this.disconnectFromDatabase();
        }
    }
}

// CLI argument parsing
function parseArguments(): JoinUserOptions {
    const args = process.argv.slice(2);
    const options: JoinUserOptions = {
        roomId: '68a460df2c5f471c834cd54c',
        delayMs: 1000,
        userCount: 10,
        role: 'participant',
        userIds: ['68a458a4c638d2df2730f88b',
            '68a458a4c638d2df2730f88c',
            '68a458a4c638d2df2730f88d',
            '68a458a4c638d2df2730f88e',
            '68a458a4c638d2df2730f88f',
            '68a458a4c638d2df2730f890',
            '68a458a4c638d2df2730f891',
            '68a458a4c638d2df2730f892',
            '68a458a4c638d2df2730f893',
            '68a458a4c638d2df2730f894',
            '68a458a4c638d2df2730f895',
            '68a458a4c638d2df2730f896',
            '68a458a4c638d2df2730f897',
            '68a458a4c638d2df2730f898',
        ]
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
🚀 Room Joiner Script

Usage: npm run join-users -- [options]

Options:
  --roomId, -r <roomId>           Room ID to join users to (required)
  --userIds, -u <id1,id2,id3>     Comma-separated list of user IDs to join
  --userCount, -c <number>        Number of random users to join
  --delay, -d <milliseconds>      Delay between joins (default: 1000ms)
  --role <role>                   Role for users (host|moderator|participant|viewer, default: participant)
  --help, -h                      Show this help message

Examples:
  # Join 5 random users to a room
  npm run join-users -- --roomId 507f1f77bcf86cd799439011 --userCount 5

  # Join specific users to a room
  npm run join-users -- --roomId 507f1f77bcf86cd799439011 --userIds 507f1f77bcf86cd799439012,507f1f77bcf86cd799439013

  # Join users with custom delay and role
  npm run join-users -- --roomId 507f1f77bcf86cd799439011 --userCount 3 --delay 2000 --role moderator

  # Join all users to a room
  npm run join-users -- --roomId 507f1f77bcf86cd799439011
`);
}

// Main execution
if (require.main === module) {
    try {
        const options = parseArguments();
        RoomJoiner.joinUsersToRoom(options);
    } catch (error) {
        console.error('❌ Script execution failed:', error);
        process.exit(1);
    }
}

export { RoomJoiner, JoinUserOptions };
