import mongoose, { Document, Schema } from 'mongoose';

export interface IVideoEvent extends Document {
    event_name: string;
    greeting_message: string;
    expected_duration: number;
    max_participants: number;
    is_private: boolean;
    status: 'draft' | 'live' | 'ended' | 'cancelled';
    created_by: mongoose.Types.ObjectId;
    room_id: string;
    current_participants: number;
    started_at?: Date;
    ended_at?: Date;
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
    metadata: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

const VideoEventSchema = new Schema<IVideoEvent>({
    event_name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    greeting_message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    expected_duration: {
        type: Number,
        required: true,
        min: 5,
        max: 480 // 8 hours max
    },
    max_participants: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    is_private: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['draft', 'live', 'ended', 'cancelled'],
        default: 'draft'
    },
    created_by: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    room_id: {
        type: String,
        required: true,
        unique: true
    },
    current_participants: {
        type: Number,
        default: 0,
        min: 0
    },
    started_at: {
        type: Date
    },
    ended_at: {
        type: Date
    },
    settings: {
        allowChat: {
            type: Boolean,
            default: true
        },
        allowScreenShare: {
            type: Boolean,
            default: true
        },
        allowRecording: {
            type: Boolean,
            default: false
        },
        requireApproval: {
            type: Boolean,
            default: false
        },
        autoRecord: {
            type: Boolean,
            default: false
        }
    },
    permissions: {
        canJoin: {
            enabled: {
                type: Boolean,
                default: true
            },
            onlySubscribers: {
                type: Boolean,
                default: false
            },
            minWalletBalance: {
                type: Number,
                default: 0
            }
        },
        canChat: {
            enabled: {
                type: Boolean,
                default: true
            },
            onlySubscribers: {
                type: Boolean,
                default: false
            },
            minWalletBalance: {
                type: Number,
                default: 0
            }
        },
        canVideo: {
            enabled: {
                type: Boolean,
                default: true
            },
            onlySubscribers: {
                type: Boolean,
                default: false
            },
            minWalletBalance: {
                type: Number,
                default: 0
            }
        },
        canAudio: {
            enabled: {
                type: Boolean,
                default: true
            },
            onlySubscribers: {
                type: Boolean,
                default: false
            },
            minWalletBalance: {
                type: Number,
                default: 0
            }
        }
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Indexes
VideoEventSchema.index({ created_by: 1, status: 1 });
VideoEventSchema.index({ status: 1, started_at: -1 });
VideoEventSchema.index({ room_id: 1 }, { unique: true });

// Virtual for duration
VideoEventSchema.virtual('duration').get(function() {
    if (this.started_at && this.ended_at) {
        return Math.floor((this.ended_at.getTime() - this.started_at.getTime()) / 1000);
    }
    return 0;
});

// Methods
VideoEventSchema.methods.startEvent = function() {
    this.status = 'live';
    this.started_at = new Date();
    return this.save();
};

VideoEventSchema.methods.endEvent = function() {
    this.status = 'ended';
    this.ended_at = new Date();
    return this.save();
};

VideoEventSchema.methods.addParticipant = function() {
    if (this.current_participants < this.max_participants) {
        this.current_participants += 1;
        return this.save();
    }
    throw new Error('Room is full');
};

VideoEventSchema.methods.removeParticipant = function() {
    if (this.current_participants > 0) {
        this.current_participants -= 1;
        return this.save();
    }
    return this.save();
};

// Statics
VideoEventSchema.statics.findByStatus = function(status: string) {
    return this.find({ status });
};

VideoEventSchema.statics.findByCreator = function(creatorId: string) {
    return this.find({ created_by: creatorId });
};

VideoEventSchema.statics.findActiveEvents = function() {
    return this.find({ status: 'live' });
};

export const VideoEvent = mongoose.model<IVideoEvent>('VideoEvent', VideoEventSchema);
export default VideoEvent;
