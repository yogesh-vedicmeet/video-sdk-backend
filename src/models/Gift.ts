import mongoose, { Schema, Document } from 'mongoose';

export interface IGift extends Document {
    giftId: string;
    roomId: string;
    giftType: string;
    giftName: string;
    giftValue: number;
    senderId: string;
    senderName: string;
    receiverId: string;
    receiverName: string;
    message?: string;
    isProcessed: boolean;
    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const GiftSchema = new Schema<IGift>({
    giftId: { type: String, required: true, unique: true, index: true },
    roomId: { type: String, required: true, index: true },
    giftType: { type: String, required: true, index: true },
    giftName: { type: String, required: true },
    giftValue: { type: Number, required: true, min: 0 },
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, required: true },
    receiverId: { type: String, required: true, index: true },
    receiverName: { type: String, required: true },
    message: { type: String, maxlength: 200 },
    isProcessed: { type: Boolean, default: false, index: true },
    processedAt: { type: Date }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

GiftSchema.virtual('status').get(function() {
    return this.isProcessed ? 'processed' : 'pending';
});

GiftSchema.index({ roomId: 1, createdAt: -1 });
GiftSchema.index({ senderId: 1, createdAt: -1 });
GiftSchema.index({ receiverId: 1, createdAt: -1 });
GiftSchema.index({ giftType: 1, giftValue: -1 });

GiftSchema.methods.process = function() {
    this.isProcessed = true;
    this.processedAt = new Date();
    return this.save();
};

export const Gift = mongoose.model<IGift>('Gift', GiftSchema);
export default Gift;
