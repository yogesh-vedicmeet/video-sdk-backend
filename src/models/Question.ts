import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestion extends Document {
    questionId: string;
    roomId: string;
    question: string;
    askedBy: string;
    askedByName: string;
    isAnswered: boolean;
    isHighlighted: boolean;
    upvotes: number;
    downvotes: number;
    voters: {
        upvoters: string[];
        downvoters: string[];
    };
    answeredBy?: string;
    answeredByName?: string;
    answer?: string;
    answeredAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    
    // Virtual fields
    score: number;
    status: string;
    
    // Instance methods
    upvote(userId: string): Promise<IQuestion>;
    downvote(userId: string): Promise<IQuestion>;
    answerQuestion(answer: string, answeredBy: string, answeredByName: string): Promise<IQuestion>;
    highlight(): Promise<IQuestion>;
    unhighlight(): Promise<IQuestion>;
}

const QuestionSchema = new Schema<IQuestion>({
    questionId: { type: String, required: true, unique: true, index: true },
    roomId: { type: String, required: true, index: true },
    question: { type: String, required: true, maxlength: 1000 },
    askedBy: { type: String, required: true, index: true },
    askedByName: { type: String, required: true },
    isAnswered: { type: Boolean, default: false, index: true },
    isHighlighted: { type: Boolean, default: false, index: true },
    upvotes: { type: Number, default: 0, min: 0 },
    downvotes: { type: Number, default: 0, min: 0 },
    voters: {
        upvoters: [{ type: String }],
        downvoters: [{ type: String }]
    },
    answeredBy: { type: String },
    answeredByName: { type: String },
    answer: { type: String, maxlength: 2000 },
    answeredAt: { type: Date }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

QuestionSchema.virtual('score').get(function() {
    return this.upvotes - this.downvotes;
});

QuestionSchema.virtual('status').get(function() {
    if (this.isAnswered) return 'answered';
    if (this.isHighlighted) return 'highlighted';
    return 'pending';
});

QuestionSchema.index({ roomId: 1, isAnswered: 1, upvotes: -1 });
QuestionSchema.index({ roomId: 1, isHighlighted: 1 });
QuestionSchema.index({ askedBy: 1, createdAt: -1 });

QuestionSchema.methods.upvote = function(userId: string) {
    if (this.voters.upvoters.includes(userId)) {
        // Remove upvote
        const index = this.voters.upvoters.indexOf(userId);
        this.voters.upvoters.splice(index, 1);
        this.upvotes--;
    } else {
        // Add upvote
        this.voters.upvoters.push(userId);
        this.upvotes++;
        
        // Remove downvote if exists
        const downvoteIndex = this.voters.downvoters.indexOf(userId);
        if (downvoteIndex > -1) {
            this.voters.downvoters.splice(downvoteIndex, 1);
            this.downvotes--;
        }
    }
    return this.save();
};

QuestionSchema.methods.downvote = function(userId: string) {
    if (this.voters.downvoters.includes(userId)) {
        // Remove downvote
        const index = this.voters.downvoters.indexOf(userId);
        this.voters.downvoters.splice(index, 1);
        this.downvotes--;
    } else {
        // Add downvote
        this.voters.downvoters.push(userId);
        this.downvotes++;
        
        // Remove upvote if exists
        const upvoteIndex = this.voters.upvoters.indexOf(userId);
        if (upvoteIndex > -1) {
            this.voters.upvoters.splice(upvoteIndex, 1);
            this.upvotes--;
        }
    }
    return this.save();
};

QuestionSchema.methods.answerQuestion = function(answer: string, answeredBy: string, answeredByName: string) {
    this.answer = answer;
    this.answeredBy = answeredBy;
    this.answeredByName = answeredByName;
    this.answeredAt = new Date();
    this.isAnswered = true;
    return this.save();
};

QuestionSchema.methods.highlight = function() {
    this.isHighlighted = true;
    return this.save();
};

QuestionSchema.methods.unhighlight = function() {
    this.isHighlighted = false;
    return this.save();
};

export const Question = mongoose.model<IQuestion>('Question', QuestionSchema);
export default Question;
