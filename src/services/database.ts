import mongoose, { Schema, Document, Model } from 'mongoose';
import { config } from '../config/config';

// Connect to MongoDB
mongoose.connect(config.mongoUri, {
    dbName: config.mongoDbName,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
});

// Database connection event handlers
mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connected successfully');
});

mongoose.connection.on('error', (error) => {
    console.error('❌ MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
    console.log('🔌 MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed through app termination');
    process.exit(0);
});

// Interfaces
export interface IRoom extends Document {
    roomId: string;
    name: string;
    description?: string;
    createdBy: string;
    isActive: boolean;
    maxParticipants: number;
    currentParticipants: number;
    settings: {
        recordingEnabled: boolean;
        chatEnabled: boolean;
        screenShareEnabled: boolean;
        waitingRoomEnabled: boolean;
        moderatorApprovalRequired: boolean;
    };
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
    lastActivityAt: Date;
}

export interface IParticipant extends Document {
    participantId: string;
    roomId: string;
    identity: string;
    name: string;
    email?: string;
    role: 'host' | 'moderator' | 'participant' | 'viewer';
    isOnline: boolean;
    isMuted: boolean;
    isVideoEnabled: boolean;
    isScreenSharing: boolean;
    metadata: Record<string, any>;
    joinedAt: Date;
    leftAt?: Date;
    lastActivityAt: Date;
}

export interface ISession extends Document {
    sessionId: string;
    roomId: string;
    hostId: string;
    title: string;
    description?: string;
    startTime: Date;
    endTime?: Date;
    duration: number; // in seconds
    participantCount: number;
    maxParticipants: number;
    isRecording: boolean;
    recordingUrl?: string;
    status: 'scheduled' | 'active' | 'ended' | 'cancelled';
    settings: {
        recordingEnabled: boolean;
        chatEnabled: boolean;
        screenShareEnabled: boolean;
        waitingRoomEnabled: boolean;
        moderatorApprovalRequired: boolean;
    };
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export interface IRecording extends Document {
    recordingId: string;
    sessionId: string;
    roomId: string;
    fileName: string;
    filePath: string;
    fileSize: number; // in bytes
    duration: number; // in seconds
    format: 'mp4' | 'webm' | 'avi';
    quality: 'low' | 'medium' | 'high';
    status: 'processing' | 'completed' | 'failed';
    downloadUrl?: string;
    thumbnailUrl?: string;
    metadata: Record<string, any>;
    createdAt: Date;
    completedAt?: Date;
}

export interface IAnalytics extends Document {
    eventId: string;
    sessionId?: string;
    roomId: string;
    participantId?: string;
    eventType: 'join' | 'leave' | 'mute' | 'unmute' | 'screen_share_start' | 'screen_share_stop' | 'recording_start' | 'recording_stop' | 'chat_message' | 'error';
    eventData: Record<string, any>;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
}

export interface IUser extends Document {
    userId: string;
    email: string;
    name: string;
    avatar?: string;
    role: 'admin' | 'moderator' | 'user';
    isActive: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Schemas
const RoomSchema = new Schema<IRoom>({
    roomId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    createdBy: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    maxParticipants: { type: Number, default: 20 },
    currentParticipants: { type: Number, default: 0 },
    settings: {
        recordingEnabled: { type: Boolean, default: true },
        chatEnabled: { type: Boolean, default: true },
        screenShareEnabled: { type: Boolean, default: true },
        waitingRoomEnabled: { type: Boolean, default: false },
        moderatorApprovalRequired: { type: Boolean, default: false }
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
    lastActivityAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const ParticipantSchema = new Schema<IParticipant>({
    participantId: { type: String, required: true, unique: true, index: true },
    roomId: { type: String, required: true, index: true },
    identity: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String },
    role: { type: String, enum: ['host', 'moderator', 'participant', 'viewer'], default: 'participant' },
    isOnline: { type: Boolean, default: true },
    isMuted: { type: Boolean, default: false },
    isVideoEnabled: { type: Boolean, default: true },
    isScreenSharing: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
    leftAt: { type: Date },
    lastActivityAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

const SessionSchema = new Schema<ISession>({
    sessionId: { type: String, required: true, unique: true, index: true },
    roomId: { type: String, required: true, index: true },
    hostId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number, default: 0 },
    participantCount: { type: Number, default: 0 },
    maxParticipants: { type: Number, default: 20 },
    isRecording: { type: Boolean, default: false },
    recordingUrl: { type: String },
    status: { type: String, enum: ['scheduled', 'active', 'ended', 'cancelled'], default: 'scheduled' },
    settings: {
        recordingEnabled: { type: Boolean, default: true },
        chatEnabled: { type: Boolean, default: true },
        screenShareEnabled: { type: Boolean, default: true },
        waitingRoomEnabled: { type: Boolean, default: false },
        moderatorApprovalRequired: { type: Boolean, default: false }
    },
    metadata: { type: Schema.Types.Mixed, default: {} }
}, {
    timestamps: true
});

const RecordingSchema = new Schema<IRecording>({
    recordingId: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true, index: true },
    roomId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    format: { type: String, enum: ['mp4', 'webm', 'avi'], default: 'mp4' },
    quality: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    downloadUrl: { type: String },
    thumbnailUrl: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
    completedAt: { type: Date }
}, {
    timestamps: true
});

const AnalyticsSchema = new Schema<IAnalytics>({
    eventId: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, index: true },
    roomId: { type: String, required: true, index: true },
    participantId: { type: String, index: true },
    eventType: { 
        type: String, 
        enum: ['join', 'leave', 'mute', 'unmute', 'screen_share_start', 'screen_share_stop', 'recording_start', 'recording_stop', 'chat_message', 'error'],
        required: true 
    },
    eventData: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true },
    ipAddress: { type: String },
    userAgent: { type: String }
}, {
    timestamps: true
});

const UserSchema = new Schema<IUser>({
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatar: { type: String },
    role: { type: String, enum: ['admin', 'moderator', 'user'], default: 'user' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date }
}, {
    timestamps: true
});

// Create models
export const Room = mongoose.model<IRoom>('Room', RoomSchema);
export const Participant = mongoose.model<IParticipant>('Participant', ParticipantSchema);
export const Session = mongoose.model<ISession>('Session', SessionSchema);
export const Recording = mongoose.model<IRecording>('Recording', RecordingSchema);
export const Analytics = mongoose.model<IAnalytics>('Analytics', AnalyticsSchema);
export const User = mongoose.model<IUser>('User', UserSchema);

// Database service class
export class DatabaseService {
    
    // Room operations
    static async createRoom(roomData: Partial<IRoom>): Promise<IRoom> {
        try {
            const room = new Room(roomData);
            await room.save();
            console.log(`🏠 Created room in database: ${room.roomId}`);
            return room;
        } catch (error) {
            console.error('❌ Failed to create room in database:', error);
            throw error;
        }
    }

    static async getRoom(roomId: string): Promise<IRoom | null> {
        try {
            const room = await Room.findOne({ roomId });
            return room;
        } catch (error) {
            console.error(`❌ Failed to get room ${roomId}:`, error);
            return null;
        }
    }

    static async updateRoom(roomId: string, updates: Partial<IRoom>): Promise<IRoom | null> {
        try {
            const room = await Room.findOneAndUpdate(
                { roomId },
                { ...updates, updatedAt: new Date() },
                { new: true }
            );
            console.log(`📝 Updated room in database: ${roomId}`);
            return room;
        } catch (error) {
            console.error(`❌ Failed to update room ${roomId}:`, error);
            return null;
        }
    }

    static async deleteRoom(roomId: string): Promise<boolean> {
        try {
            await Room.deleteOne({ roomId });
            console.log(`🗑️ Deleted room from database: ${roomId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to delete room ${roomId}:`, error);
            return false;
        }
    }

    static async listRooms(filter: any = {}): Promise<IRoom[]> {
        try {
            const rooms = await Room.find(filter).sort({ createdAt: -1 });
            return rooms;
        } catch (error) {
            console.error('❌ Failed to list rooms:', error);
            return [];
        }
    }

    // Participant operations
    static async addParticipant(participantData: Partial<IParticipant>): Promise<IParticipant> {
        try {
            const participant = new Participant(participantData);
            await participant.save();
            console.log(`👤 Added participant to database: ${participant.participantId}`);
            return participant;
        } catch (error) {
            console.error('❌ Failed to add participant to database:', error);
            throw error;
        }
    }

    static async getParticipant(participantId: string): Promise<IParticipant | null> {
        try {
            const participant = await Participant.findOne({ participantId });
            return participant;
        } catch (error) {
            console.error(`❌ Failed to get participant ${participantId}:`, error);
            return null;
        }
    }

    static async updateParticipant(participantId: string, updates: Partial<IParticipant>): Promise<IParticipant | null> {
        try {
            const participant = await Participant.findOneAndUpdate(
                { participantId },
                { ...updates, updatedAt: new Date() },
                { new: true }
            );
            return participant;
        } catch (error) {
            console.error(`❌ Failed to update participant ${participantId}:`, error);
            return null;
        }
    }

    static async removeParticipant(participantId: string): Promise<boolean> {
        try {
            await Participant.deleteOne({ participantId });
            console.log(`🚪 Removed participant from database: ${participantId}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to remove participant ${participantId}:`, error);
            return false;
        }
    }

    static async getRoomParticipants(roomId: string): Promise<IParticipant[]> {
        try {
            const participants = await Participant.find({ roomId, isOnline: true });
            return participants;
        } catch (error) {
            console.error(`❌ Failed to get participants for room ${roomId}:`, error);
            return [];
        }
    }

    // Session operations
    static async createSession(sessionData: Partial<ISession>): Promise<ISession> {
        try {
            const session = new Session(sessionData);
            await session.save();
            console.log(`📅 Created session in database: ${session.sessionId}`);
            return session;
        } catch (error) {
            console.error('❌ Failed to create session in database:', error);
            throw error;
        }
    }

    static async getSession(sessionId: string): Promise<ISession | null> {
        try {
            const session = await Session.findOne({ sessionId });
            return session;
        } catch (error) {
            console.error(`❌ Failed to get session ${sessionId}:`, error);
            return null;
        }
    }

    static async updateSession(sessionId: string, updates: Partial<ISession>): Promise<ISession | null> {
        try {
            const session = await Session.findOneAndUpdate(
                { sessionId },
                { ...updates, updatedAt: new Date() },
                { new: true }
            );
            return session;
        } catch (error) {
            console.error(`❌ Failed to update session ${sessionId}:`, error);
            return null;
        }
    }

    static async endSession(sessionId: string): Promise<boolean> {
        try {
            const session = await Session.findOneAndUpdate(
                { sessionId },
                { 
                    status: 'ended',
                    endTime: new Date(),
                    updatedAt: new Date()
                },
                { new: true }
            );
            
            if (session) {
                // Calculate duration
                const duration = Math.floor((session.endTime!.getTime() - session.startTime.getTime()) / 1000);
                await Session.updateOne({ sessionId }, { duration });
                console.log(`⏹️ Ended session: ${sessionId} (duration: ${duration}s)`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Failed to end session ${sessionId}:`, error);
            return false;
        }
    }

    // Recording operations
    static async createRecording(recordingData: Partial<IRecording>): Promise<IRecording> {
        try {
            const recording = new Recording(recordingData);
            await recording.save();
            console.log(`🎥 Created recording in database: ${recording.recordingId}`);
            return recording;
        } catch (error) {
            console.error('❌ Failed to create recording in database:', error);
            throw error;
        }
    }

    static async updateRecording(recordingId: string, updates: Partial<IRecording>): Promise<IRecording | null> {
        try {
            const recording = await Recording.findOneAndUpdate(
                { recordingId },
                { ...updates, updatedAt: new Date() },
                { new: true }
            );
            return recording;
        } catch (error) {
            console.error(`❌ Failed to update recording ${recordingId}:`, error);
            return null;
        }
    }

    static async getRecording(recordingId: string): Promise<IRecording | null> {
        try {
            const recording = await Recording.findOne({ recordingId });
            return recording;
        } catch (error) {
            console.error(`❌ Failed to get recording ${recordingId}:`, error);
            return null;
        }
    }

    static async listRecordings(filter: any = {}): Promise<IRecording[]> {
        try {
            const recordings = await Recording.find(filter).sort({ createdAt: -1 });
            return recordings;
        } catch (error) {
            console.error('❌ Failed to list recordings:', error);
            return [];
        }
    }

    // Analytics operations
    static async logEvent(eventData: Partial<IAnalytics>): Promise<IAnalytics> {
        try {
            const event = new Analytics(eventData);
            await event.save();
            return event;
        } catch (error) {
            console.error('❌ Failed to log analytics event:', error);
            throw error;
        }
    }

    static async getAnalytics(filter: any = {}, limit: number = 100): Promise<IAnalytics[]> {
        try {
            const events = await Analytics.find(filter)
                .sort({ timestamp: -1 })
                .limit(limit);
            return events;
        } catch (error) {
            console.error('❌ Failed to get analytics:', error);
            return [];
        }
    }

    // User operations
    static async createUser(userData: Partial<IUser>): Promise<IUser> {
        try {
            const user = new User(userData);
            await user.save();
            console.log(`👤 Created user in database: ${user.userId}`);
            return user;
        } catch (error) {
            console.error('❌ Failed to create user in database:', error);
            throw error;
        }
    }

    static async getUser(userId: string): Promise<IUser | null> {
        try {
            const user = await User.findOne({ userId });
            return user;
        } catch (error) {
            console.error(`❌ Failed to get user ${userId}:`, error);
            return null;
        }
    }

    static async getUserByEmail(email: string): Promise<IUser | null> {
        try {
            const user = await User.findOne({ email });
            return user;
        } catch (error) {
            console.error(`❌ Failed to get user by email ${email}:`, error);
            return null;
        }
    }

    static async updateUser(userId: string, updates: Partial<IUser>): Promise<IUser | null> {
        try {
            const user = await User.findOneAndUpdate(
                { userId },
                { ...updates, updatedAt: new Date() },
                { new: true }
            );
            return user;
        } catch (error) {
            console.error(`❌ Failed to update user ${userId}:`, error);
            return null;
        }
    }

    // Utility functions
    static async getDatabaseStats(): Promise<{
        rooms: number;
        participants: number;
        sessions: number;
        recordings: number;
        analytics: number;
        users: number;
    }> {
        try {
            const [rooms, participants, sessions, recordings, analytics, users] = await Promise.all([
                Room.countDocuments(),
                Participant.countDocuments(),
                Session.countDocuments(),
                Recording.countDocuments(),
                Analytics.countDocuments(),
                User.countDocuments()
            ]);

            return {
                rooms,
                participants,
                sessions,
                recordings,
                analytics,
                users
            };
        } catch (error) {
            console.error('❌ Failed to get database stats:', error);
            return {
                rooms: 0,
                participants: 0,
                sessions: 0,
                recordings: 0,
                analytics: 0,
                users: 0
            };
        }
    }

    static async cleanupOldData(daysToKeep: number = 30): Promise<{
        roomsDeleted: number;
        participantsDeleted: number;
        sessionsDeleted: number;
        recordingsDeleted: number;
        analyticsDeleted: number;
    }> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            const [roomsDeleted, participantsDeleted, sessionsDeleted, recordingsDeleted, analyticsDeleted] = await Promise.all([
                Room.deleteMany({ updatedAt: { $lt: cutoffDate }, isActive: false }),
                Participant.deleteMany({ updatedAt: { $lt: cutoffDate }, isOnline: false }),
                Session.deleteMany({ updatedAt: { $lt: cutoffDate }, status: 'ended' }),
                Recording.deleteMany({ updatedAt: { $lt: cutoffDate }, status: 'completed' }),
                Analytics.deleteMany({ timestamp: { $lt: cutoffDate } })
            ]);

            console.log(`🧹 Cleaned up old data:`, {
                roomsDeleted: roomsDeleted.deletedCount,
                participantsDeleted: participantsDeleted.deletedCount,
                sessionsDeleted: sessionsDeleted.deletedCount,
                recordingsDeleted: recordingsDeleted.deletedCount,
                analyticsDeleted: analyticsDeleted.deletedCount
            });

            return {
                roomsDeleted: roomsDeleted.deletedCount,
                participantsDeleted: participantsDeleted.deletedCount,
                sessionsDeleted: sessionsDeleted.deletedCount,
                recordingsDeleted: recordingsDeleted.deletedCount,
                analyticsDeleted: analyticsDeleted.deletedCount
            };
        } catch (error) {
            console.error('❌ Failed to cleanup old data:', error);
            return {
                roomsDeleted: 0,
                participantsDeleted: 0,
                sessionsDeleted: 0,
                recordingsDeleted: 0,
                analyticsDeleted: 0
            };
        }
    }
}

// Export default instance
export default DatabaseService;
