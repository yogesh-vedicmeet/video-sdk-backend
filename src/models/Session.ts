import mongoose, { Schema, Document } from 'mongoose';

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

const SessionSchema = new Schema<ISession>({
    sessionId: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true,
        validate: {
            validator: function(v: string) {
                return v.length >= 3 && v.length <= 50;
            },
            message: 'Session ID must be between 3 and 50 characters'
        }
    },
    roomId: { 
        type: String, 
        required: true, 
        index: true,
        ref: 'Room'
    },
    hostId: { 
        type: String, 
        required: true,
        index: true,
        ref: 'Participant'
    },
    title: { 
        type: String, 
        required: true,
        validate: {
            validator: function(v: string) {
                return v.length >= 1 && v.length <= 200;
            },
            message: 'Title must be between 1 and 200 characters'
        }
    },
    description: { 
        type: String,
        maxlength: 1000,
        message: 'Description cannot exceed 1000 characters'
    },
    startTime: { 
        type: Date, 
        required: true,
        default: Date.now,
        index: true
    },
    endTime: { 
        type: Date,
        index: true,
        validate: {
            validator: function(v: Date) {
                if (!v) return true; // Optional field
                return v > this.startTime;
            },
            message: 'End time must be after start time'
        }
    },
    duration: { 
        type: Number, 
        default: 0,
        min: 0,
        validate: {
            validator: function(v: number) {
                return v >= 0;
            },
            message: 'Duration cannot be negative'
        }
    },
    participantCount: { 
        type: Number, 
        default: 0,
        min: 0,
        validate: {
            validator: function(v: number) {
                return v >= 0;
            },
            message: 'Participant count cannot be negative'
        }
    },
    maxParticipants: { 
        type: Number, 
        default: 20,
        min: 1,
        max: 100,
        validate: {
            validator: function(v: number) {
                return v >= 1 && v <= 100;
            },
            message: 'Max participants must be between 1 and 100'
        }
    },
    isRecording: { 
        type: Boolean, 
        default: false
    },
    recordingUrl: { 
        type: String,
        validate: {
            validator: function(v: string) {
                if (!v) return true; // Optional field
                const urlRegex = /^https?:\/\/.+/;
                return urlRegex.test(v);
            },
            message: 'Please provide a valid URL'
        }
    },
    status: { 
        type: String, 
        enum: ['scheduled', 'active', 'ended', 'cancelled'], 
        default: 'scheduled',
        required: true,
        index: true
    },
    settings: {
        recordingEnabled: { type: Boolean, default: true },
        chatEnabled: { type: Boolean, default: true },
        screenShareEnabled: { type: Boolean, default: true },
        waitingRoomEnabled: { type: Boolean, default: false },
        moderatorApprovalRequired: { type: Boolean, default: false }
    },
    metadata: { 
        type: Schema.Types.Mixed, 
        default: {},
        validate: {
            validator: function(v: any) {
                return typeof v === 'object' && v !== null;
            },
            message: 'Metadata must be an object'
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for session duration in minutes
SessionSchema.virtual('durationMinutes').get(function() {
    return Math.floor(this.duration / 60);
});

// Virtual for session duration in hours
SessionSchema.virtual('durationHours').get(function() {
    return Math.floor(this.duration / 3600);
});

// Virtual for session status
SessionSchema.virtual('isActive').get(function() {
    return this.status === 'active';
});

// Virtual for session progress
SessionSchema.virtual('progress').get(function() {
    if (this.status === 'ended' || this.status === 'cancelled') {
        return 100;
    }
    if (this.status === 'scheduled') {
        return 0;
    }
    // For active sessions, calculate based on start time
    const elapsed = Date.now() - this.startTime.getTime();
    const total = this.duration || elapsed;
    return Math.min(100, Math.floor((elapsed / total) * 100));
});

// Indexes for better query performance
SessionSchema.index({ roomId: 1, status: 1 });
SessionSchema.index({ hostId: 1 });
SessionSchema.index({ startTime: -1 });
SessionSchema.index({ createdAt: -1 });
SessionSchema.index({ status: 1, startTime: -1 });

// Pre-save middleware
SessionSchema.pre('save', function(next) {
    // Calculate duration if end time is set
    if (this.endTime && this.startTime) {
        this.duration = Math.floor((this.endTime.getTime() - this.startTime.getTime()) / 1000);
    }
    
    // Ensure participant count doesn't exceed max
    if (this.participantCount > this.maxParticipants) {
        this.participantCount = this.maxParticipants;
    }
    
    next();
});

// Static methods
SessionSchema.statics.findActiveSessions = function() {
    return this.find({ status: 'active' }).sort({ startTime: -1 });
};

SessionSchema.statics.findSessionsByRoom = function(roomId: string) {
    return this.find({ roomId }).sort({ startTime: -1 });
};

SessionSchema.statics.findSessionsByHost = function(hostId: string) {
    return this.find({ hostId }).sort({ startTime: -1 });
};

SessionSchema.statics.findScheduledSessions = function() {
    return this.find({ status: 'scheduled' }).sort({ startTime: 1 });
};

SessionSchema.statics.findEndedSessions = function(daysBack: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    return this.find({ 
        status: 'ended',
        endTime: { $gte: cutoffDate }
    }).sort({ endTime: -1 });
};

// Instance methods
SessionSchema.methods.start = function() {
    this.status = 'active';
    this.startTime = new Date();
    return this.save();
};

SessionSchema.methods.end = function() {
    this.status = 'ended';
    this.endTime = new Date();
    this.duration = Math.floor((this.endTime.getTime() - this.startTime.getTime()) / 1000);
    return this.save();
};

SessionSchema.methods.cancel = function() {
    this.status = 'cancelled';
    this.endTime = new Date();
    return this.save();
};

SessionSchema.methods.updateParticipantCount = function(count: number) {
    if (count >= 0 && count <= this.maxParticipants) {
        this.participantCount = count;
        return this.save();
    }
    throw new Error('Invalid participant count');
};

SessionSchema.methods.startRecording = function() {
    if (this.settings.recordingEnabled) {
        this.isRecording = true;
        return this.save();
    }
    throw new Error('Recording is not enabled for this session');
};

SessionSchema.methods.stopRecording = function(recordingUrl?: string) {
    this.isRecording = false;
    if (recordingUrl) {
        this.recordingUrl = recordingUrl;
    }
    return this.save();
};

SessionSchema.methods.updateSettings = function(newSettings: Partial<ISession['settings']>) {
    this.settings = { ...this.settings, ...newSettings };
    return this.save();
};

// Export the model
export const Session = mongoose.model<ISession>('Session', SessionSchema);
export default Session;
