import mongoose, { Schema, Document } from 'mongoose';

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

const RoomSchema = new Schema<IRoom>({
    roomId: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true,
        validate: {
            validator: function(v: string) {
                return v.length >= 3 && v.length <= 50;
            },
            message: 'Room ID must be between 3 and 50 characters'
        }
    },
    name: { 
        type: String, 
        required: true,
        validate: {
            validator: function(v: string) {
                return v.length >= 1 && v.length <= 100;
            },
            message: 'Room name must be between 1 and 100 characters'
        }
    },
    description: { 
        type: String,
        maxlength: 500,
        message: 'Description cannot exceed 500 characters'
    },
    createdBy: { 
        type: String, 
        required: true,
        index: true
    },
    isActive: { 
        type: Boolean, 
        default: true,
        index: true
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
    currentParticipants: { 
        type: Number, 
        default: 0,
        min: 0,
        validate: {
            validator: function(v: number) {
                return v >= 0;
            },
            message: 'Current participants cannot be negative'
        }
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
    },
    lastActivityAt: { 
        type: Date, 
        default: Date.now,
        index: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for room status
RoomSchema.virtual('status').get(function() {
    if (!this.isActive) return 'inactive';
    if (this.currentParticipants >= this.maxParticipants) return 'full';
    if (this.currentParticipants > 0) return 'active';
    return 'empty';
});

// Virtual for room age
RoomSchema.virtual('age').get(function() {
    return Date.now() - this.createdAt.getTime();
});

// Indexes for better query performance
RoomSchema.index({ createdAt: -1 });
RoomSchema.index({ lastActivityAt: -1 });
RoomSchema.index({ 'settings.recordingEnabled': 1 });
RoomSchema.index({ currentParticipants: 1 });

// Pre-save middleware
RoomSchema.pre('save', function(next) {
    // Ensure current participants doesn't exceed max participants
    if (this.currentParticipants > this.maxParticipants) {
        this.currentParticipants = this.maxParticipants;
    }
    
    // Update last activity on save
    this.lastActivityAt = new Date();
    next();
});

// Static methods
RoomSchema.statics.findActiveRooms = function() {
    return this.find({ isActive: true }).sort({ lastActivityAt: -1 });
};

RoomSchema.statics.findRoomsByCreator = function(createdBy: string) {
    return this.find({ createdBy }).sort({ createdAt: -1 });
};

RoomSchema.statics.findRoomsWithParticipants = function(minParticipants: number = 1) {
    return this.find({ 
        isActive: true, 
        currentParticipants: { $gte: minParticipants } 
    }).sort({ currentParticipants: -1 });
};

// Instance methods
RoomSchema.methods.incrementParticipants = function() {
    if (this.currentParticipants < this.maxParticipants) {
        this.currentParticipants += 1;
        return this.save();
    }
    throw new Error('Room is at maximum capacity');
};

RoomSchema.methods.decrementParticipants = function() {
    if (this.currentParticipants > 0) {
        this.currentParticipants -= 1;
        return this.save();
    }
    throw new Error('No participants to remove');
};

RoomSchema.methods.updateActivity = function() {
    this.lastActivityAt = new Date();
    return this.save();
};

RoomSchema.methods.deactivate = function() {
    this.isActive = false;
    this.currentParticipants = 0;
    return this.save();
};

// Export the model
export const Room = mongoose.model<IRoom>('Room', RoomSchema);
export default Room;
