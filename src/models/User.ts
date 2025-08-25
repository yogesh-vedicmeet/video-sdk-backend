import mongoose, { Schema, Document } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

export interface IUser extends Document {
    userId: string;
    email: string;
    phone: string;
    name: string;
    password: string;
    avatar?: string;
    role: 'admin' | 'moderator' | 'user';
    isActive: boolean;
    isEmailVerified: boolean;
    emailVerificationToken?: string;
    emailVerificationExpires?: Date;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    lastLoginAt?: Date;
    loginAttempts: number;
    lockUntil?: Date;
    refreshTokens: string[];
    twoFactorSecret?: string;
    twoFactorEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
    
    // Virtual properties
    isLocked: boolean;
    
    // Instance methods
    comparePassword(candidatePassword: string): Promise<boolean>;
    generateEmailVerificationToken(): string;
    generatePasswordResetToken(): string;
    incrementLoginAttempts(): Promise<void>;
    resetLoginAttempts(): Promise<void>;
}

const UserSchema = new Schema<IUser>({
    userId: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true,
        validate: {
            validator: function(v: string) {
                return v.length >= 3 && v.length <= 50;
            },
            message: 'User ID must be between 3 and 50 characters'
        }
    },
    email: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function(v: string) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(v);
            },
            message: 'Please provide a valid email address'
        }
    },
    name: { 
        type: String, 
        required: true,
        trim: true,
        validate: {
            validator: function(v: string) {
                return v.length >= 2 && v.length <= 100;
            },
            message: 'Name must be between 2 and 100 characters'
        }
    },
    password: { 
        type: String, 
        required: true,
        minlength: [8, 'Password must be at least 8 characters long']
    },
    avatar: { 
        type: String,
        validate: {
            validator: function(v: string) {
                if (!v) return true; // Optional field
                const urlRegex = /^https?:\/\/.+$/;
                return urlRegex.test(v);
            },
            message: 'Avatar must be a valid URL'
        }
    },
    role: { 
        type: String, 
        enum: ['admin', 'moderator', 'user'], 
        default: 'user',
        index: true
    },
    isActive: { 
        type: Boolean, 
        default: true,
        index: true
    },
    isEmailVerified: { 
        type: Boolean, 
        default: false,
        index: true
    },
    emailVerificationToken: { 
        type: String 
    },
    emailVerificationExpires: { 
        type: Date 
    },
    passwordResetToken: { 
        type: String 
    },
    passwordResetExpires: { 
        type: Date 
    },
    lastLoginAt: { 
        type: Date 
    },
    loginAttempts: { 
        type: Number, 
        default: 0 
    },
    lockUntil: { 
        type: Date 
    },
    refreshTokens: [{ 
        type: String 
    }],
    twoFactorSecret: { 
        type: String 
    },
    twoFactorEnabled: { 
        type: Boolean, 
        default: false 
    }
}, {
    timestamps: true,
            toJSON: { 
            virtuals: true,
            transform: function(doc, ret: any) {
                ret.password = undefined;
                ret.emailVerificationToken = undefined;
                ret.emailVerificationExpires = undefined;
                ret.passwordResetToken = undefined;
                ret.passwordResetExpires = undefined;
                ret.refreshTokens = undefined;
                ret.twoFactorSecret = undefined;
                ret.loginAttempts = undefined;
                ret.lockUntil = undefined;
                return ret;
            }
        },
    toObject: { virtuals: true }
});

// Virtual for checking if account is locked
UserSchema.virtual('isLocked').get(function() {
    return !!(this.lockUntil && this.lockUntil > new Date());
});

// Indexes
UserSchema.index({ email: 1, isActive: 1 });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ emailVerificationToken: 1 });
UserSchema.index({ passwordResetToken: 1 });

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error as Error);
    }
});

// Instance method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate email verification token
UserSchema.methods.generateEmailVerificationToken = function(): string {
    const token = crypto.randomBytes(32).toString('hex');
    this.emailVerificationToken = token;
    this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return token;
};

// Instance method to generate password reset token
UserSchema.methods.generatePasswordResetToken = function(): string {
    const token = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = token;
    this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    return token;
};



    // Instance method to increment login attempts
    UserSchema.methods.incrementLoginAttempts = async function(): Promise<void> {
        // If we have a previous lock that has expired, restart at 1
        if (this.lockUntil && this.lockUntil < new Date()) {
            await this.updateOne({
                $unset: { lockUntil: 1 },
                $set: { loginAttempts: 1 }
            });
            return;
        }
        
        const updates: any = { $inc: { loginAttempts: 1 } };
        
        // Lock account after 5 failed attempts for 2 hours
        if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
            updates.$set = { lockUntil: new Date(Date.now() + 2 * 60 * 60 * 1000) };
        }
        
        await this.updateOne(updates);
    };

// Instance method to reset login attempts
UserSchema.methods.resetLoginAttempts = async function(): Promise<void> {
    await this.updateOne({
        $unset: { loginAttempts: 1, lockUntil: 1 },
        $set: { lastLoginAt: new Date() }
    });
};

export const User = mongoose.model<IUser>('User', UserSchema);
export default User;
