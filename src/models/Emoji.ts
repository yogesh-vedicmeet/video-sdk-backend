import mongoose, { Schema, Document } from 'mongoose';

export interface IEmoji extends Document {
    emojiId: string;
    roomId: string;
    emoji: string;
    senderId: string;
    senderName: string;
    receiverId?: string;
    receiverName?: string;
    message?: string;
    isGlobal: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const EmojiSchema = new Schema<IEmoji>({
    emojiId: { type: String, required: true, unique: true, index: true },
    roomId: { type: String, required: true, index: true },
    emoji: { type: String, required: true },
    senderId: { type: String, required: true, index: true },
    senderName: { type: String, required: true },
    receiverId: { type: String, index: true },
    receiverName: { type: String },
    message: { type: String, maxlength: 100 },
    isGlobal: { type: Boolean, default: false, index: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

EmojiSchema.index({ roomId: 1, createdAt: -1 });
EmojiSchema.index({ senderId: 1, createdAt: -1 });
EmojiSchema.index({ receiverId: 1, createdAt: -1 });
EmojiSchema.index({ emoji: 1, roomId: 1 });

export const Emoji = mongoose.model<IEmoji>('Emoji', EmojiSchema);
export default Emoji;
