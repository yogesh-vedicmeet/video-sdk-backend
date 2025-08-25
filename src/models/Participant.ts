import mongoose, { Schema, Document } from 'mongoose';

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
    isVirtual?: boolean; // Flag to identify virtual participants
    metadata: Record<string, any>;
    joinedAt: Date;
    leftAt?: Date;
    lastActivityAt: Date;
    isBlocked: boolean;
}

const ParticipantSchema = new Schema<IParticipant>({
    participantId: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true,
        validate: {
            validator: function(v: string) {
                return v.length >= 3 && v.length <= 50;
            },
            message: 'Participant ID must be between 3 and 50 characters'
        }
    },
    roomId: { 
        type: String, 
        required: true, 
        index: true,
        ref: 'Room'
    },
    identity: { 
        type: String, 
        required: true,
        validate: {
            validator: function(v: string) {
                return v.length >= 1 && v.length <= 100;
            },
            message: 'Identity must be between 1 and 100 characters'
        }
    },
    name: { 
        type: String, 
        required: true,
        validate: {
            validator: function(v: string) {
                return v.length >= 1 && v.length <= 100;
            },
            message: 'Name must be between 1 and 100 characters'
        }
    },
    email: { 
        type: String,
        validate: {
            validator: function(v: string) {
                if (!v) return true; // Optional field
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(v);
            },
            message: 'Please provide a valid email address'
        }
    },
    role: { 
        type: String, 
        enum: ['host', 'moderator', 'participant', 'viewer'], 
        default: 'participant',
        required: true
    },
    isOnline: { 
        type: Boolean, 
        default: true,
        index: true
    },
    isMuted: { 
        type: Boolean, 
        default: false
    },
    isVideoEnabled: { 
        type: Boolean, 
        default: true
    },
    isScreenSharing: { 
        type: Boolean, 
        default: false
    },
    isVirtual: { 
        type: Boolean, 
        default: false,
        index: true
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
    },
    leftAt: { 
        type: Date 
    },
    lastActivityAt: { 
        type: Date, 
        default: Date.now,
        index: true
    },
    isBlocked: { 
        type: Boolean, 
        default: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for session duration
ParticipantSchema.virtual('sessionDuration').get(function() {
    if (this.leftAt) {
        return this.leftAt.getTime() - this.joinedAt.getTime();
    }
    return Date.now() - this.joinedAt.getTime();
});

// Virtual for participant status
ParticipantSchema.virtual('status').get(function() {
    if (!this.isOnline) return 'offline';
    if (this.isScreenSharing) return 'screen-sharing';
    if (this.isMuted && !this.isVideoEnabled) return 'muted-video-off';
    if (this.isMuted) return 'muted';
    if (!this.isVideoEnabled) return 'video-off';
    return 'active';
});

// Indexes for better query performance
ParticipantSchema.index({ roomId: 1, isOnline: 1 });
ParticipantSchema.index({ role: 1 });
ParticipantSchema.index({ joinedAt: -1 });
ParticipantSchema.index({ lastActivityAt: -1 });
ParticipantSchema.index({ identity: 1, roomId: 1 }, { unique: true });

// Pre-save middleware
ParticipantSchema.pre('save', function(next) {
    // Update last activity on save
    this.lastActivityAt = new Date();
    
    // If participant is offline, set leftAt
    if (!this.isOnline && !this.leftAt) {
        this.leftAt = new Date();
    }
    
    next();
});

// Static methods
ParticipantSchema.statics.findOnlineParticipants = function(roomId: string) {
    return this.find({ roomId, isOnline: true }).sort({ joinedAt: 1 });
};

ParticipantSchema.statics.findByRole = function(roomId: string, role: string) {
    return this.find({ roomId, role, isOnline: true }).sort({ joinedAt: 1 });
};

ParticipantSchema.statics.findInactiveParticipants = function(hoursInactive: number = 24) {
    const cutoffTime = new Date(Date.now() - (hoursInactive * 60 * 60 * 1000));
    return this.find({ 
        lastActivityAt: { $lt: cutoffTime },
        isOnline: true 
    });
};

ParticipantSchema.statics.getRoomParticipantCount = function(roomId: string) {
    return this.countDocuments({ roomId, isOnline: true });
};

// Instance methods
ParticipantSchema.methods.join = function() {
    this.isOnline = true;
    this.joinedAt = new Date();
    this.leftAt = undefined;
    return this.save();
};

ParticipantSchema.methods.leave = function() {
    this.isOnline = false;
    this.leftAt = new Date();
    this.isScreenSharing = false;
    this.isBlocked = false;
    this.metadata = { ...this.metadata, isBlocked: false };
    return this.save();
};

ParticipantSchema.methods.mute = function() {
    this.isMuted = true;
    this.metadata = { ...this.metadata, isMuted: true };
    return this.save();
};

ParticipantSchema.methods.unmute = function() {
    this.isMuted = false;
    this.metadata = { ...this.metadata, isMuted: false };
    return this.save();
};

ParticipantSchema.methods.enableVideo = function() {
    this.isVideoEnabled = true;
    this.metadata = { ...this.metadata, isVideoEnabled: true };
    return this.save();
};

ParticipantSchema.methods.disableVideo = function() {
    this.isVideoEnabled = false;
    this.metadata = { ...this.metadata, isVideoEnabled: false };
    return this.save();
};

ParticipantSchema.methods.startScreenShare = function() {
    this.isScreenSharing = true;
    this.metadata = { ...this.metadata, isScreenSharing: true };
    return this.save();
};

ParticipantSchema.methods.stopScreenShare = function() {
    this.isScreenSharing = false;
    this.metadata = { ...this.metadata, isScreenSharing: false };
    return this.save();
};

ParticipantSchema.methods.updateActivity = function() {
    this.lastActivityAt = new Date();
    this.metadata = { ...this.metadata, lastActivityAt: this.lastActivityAt };
    return this.save();
};

ParticipantSchema.methods.changeRole = function(newRole: string) {
    if (['host', 'moderator', 'participant', 'viewer'].includes(newRole)) {
        this.role = newRole as any;
        this.metadata = { ...this.metadata, role: this.role };
            return this.save();
    }
    throw new Error('Invalid role');
};

// Export the model
export const Participant = mongoose.model<IParticipant>('Participant', ParticipantSchema);
export default Participant;
