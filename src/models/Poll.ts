import mongoose, { Schema, Document } from 'mongoose';

export interface IPollOption {
    id: string;
    text: string;
    votes: number;
    voters: string[];
}

export interface IPoll extends Document {
    pollId: string;
    roomId: string;
    question: string;
    options: IPollOption[];
    createdBy: string;
    isActive: boolean;
    isMultipleChoice: boolean;
    duration?: number;
    expiresAt?: Date;
    totalVotes: number;
    createdAt: Date;
    updatedAt: Date;
    
    // Instance methods
    vote(optionId: string, voterId: string): Promise<IPoll>;
    getResults(): any;
}

const PollOptionSchema = new Schema<IPollOption>({
    id: { type: String, required: true },
    text: { type: String, required: true, maxlength: 200 },
    votes: { type: Number, default: 0, min: 0 },
    voters: [{ type: String }]
});

const PollSchema = new Schema<IPoll>({
    pollId: { type: String, required: true, unique: true, index: true },
    roomId: { type: String, required: true, index: true },
    question: { type: String, required: true, maxlength: 500 },
    options: {
        type: [PollOptionSchema],
        validate: {
            validator: function(options: IPollOption[]) {
                return options.length >= 2 && options.length <= 10;
            },
            message: 'Poll must have between 2 and 10 options'
        }
    },
    createdBy: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isMultipleChoice: { type: Boolean, default: false },
    duration: { type: Number, min: 30, max: 3600 },
    expiresAt: { type: Date, index: true },
    totalVotes: { type: Number, default: 0, min: 0 }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

PollSchema.virtual('status').get(function() {
    if (!this.isActive) return 'ended';
    if (this.expiresAt && new Date() > this.expiresAt) return 'expired';
    return 'active';
});

PollSchema.index({ roomId: 1, isActive: 1 });
PollSchema.index({ createdBy: 1, createdAt: -1 });

PollSchema.pre('save', function(next) {
    if (this.duration && !this.expiresAt) {
        this.expiresAt = new Date(Date.now() + this.duration * 1000);
    }
    this.totalVotes = this.options.reduce((sum, option) => sum + option.votes, 0);
    next();
});

PollSchema.methods.vote = function(optionId: string, voterId: string) {
    const option = this.options.find((opt: IPollOption) => opt.id === optionId);
    if (!option) throw new Error('Invalid option');
    
    if (this.expiresAt && new Date() > this.expiresAt) {
        throw new Error('Poll has expired');
    }
    
    if (!this.isMultipleChoice) {
        this.options.forEach((opt: IPollOption) => {
            const voterIndex = opt.voters.indexOf(voterId);
            if (voterIndex > -1) {
                opt.voters.splice(voterIndex, 1);
                opt.votes--;
            }
        });
    }
    
    if (!option.voters.includes(voterId)) {
        option.voters.push(voterId);
        option.votes++;
    }
    
    return this.save();
};

PollSchema.methods.getResults = function() {
    return {
        pollId: this.pollId,
        question: this.question,
        options: this.options.map((option: IPollOption) => ({
            id: option.id,
            text: option.text,
            votes: option.votes,
            percentage: this.totalVotes > 0 ? Math.round((option.votes / this.totalVotes) * 100) : 0
        })),
        totalVotes: this.totalVotes,
        status: this.status
    };
};

export const Poll = mongoose.model<IPoll>('Poll', PollSchema);
export default Poll;
