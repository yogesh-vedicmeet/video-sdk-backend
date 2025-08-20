import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser } from '../models/User';
import { config } from '../config/config';

interface JWTPayload {
    id: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
}

export class AuthController {
    
    /**
     * Register a new user
     * POST /api/auth/register
     */
    static async register(req: Request, res: Response): Promise<void> {
        try {
            const { email, name, password, userId } = req.body;

            console.log('register', req.body);

            // Check if user already exists
            const existingUser = await User.findOne({ 
                $or: [{ email }, { userId }] 
            });

            if (existingUser) {
                res.status(409).json({
                    success: false,
                    message: existingUser.email === email 
                        ? 'Email already registered' 
                        : 'User ID already taken'
                });
                return;
            }

            // Create new user
            const user = new User({
                email,
                name,
                password,
                userId,
                emailVerificationToken: crypto.randomBytes(32).toString('hex'),
                emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            });

            await user.save();

            // Generate tokens
            const accessToken = AuthController.generateAccessToken(user);
            const refreshToken = AuthController.generateRefreshToken(user);

            // Add refresh token to user
            user.refreshTokens.push(refreshToken);
            await user.save();

            // TODO: Send email verification email
            console.log(`📧 Email verification token for ${email}: ${user.emailVerificationToken}`);

            res.status(201).json({
                success: true,
                message: 'User registered successfully. Please check your email to verify your account.',
                data: {
                    user: {
                        userId: user.userId,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        isEmailVerified: user.isEmailVerified
                    },
                    accessToken,
                    refreshToken,
                    expiresIn: 3600 // 1 hour
                }
            });

        } catch (error) {
            console.error('❌ Registration error:', error);
            res.status(500).json({
                success: false,
                message: 'Registration failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Login user
     * POST /api/auth/login
     */
    static async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;

            // Find user by email
            const user = await User.findOne({ email, isActive: true });
            if (!user) {
                res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
                return;
            }
            // Check if account is locked
            if (user.isLocked) {
                res.status(423).json({
                    success: false,
                    message: 'Account is temporarily locked due to too many failed login attempts'
                });
                return;
            }

            // Verify password
            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                await user.incrementLoginAttempts();
                res.status(401).json({
                    success: false,
                    message: 'Invalid credentials'
                });
                return;
            }

            // Reset login attempts on successful login
            await user.resetLoginAttempts();

            // Generate tokens
            const accessToken = AuthController.generateAccessToken(user);
            const refreshToken = AuthController.generateRefreshToken(user);

            // Add refresh token to user
            user.refreshTokens.push(refreshToken);
            await user.save();

            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        userId: user.userId,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        isEmailVerified: user.isEmailVerified,
                        avatar: user.avatar
                    },
                    accessToken,
                    refreshToken,
                    expiresIn: 3600 // 1 hour
                }
            });

        } catch (error) {
            console.error('❌ Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Login failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Logout user
     * POST /api/auth/logout
     */
    static async logout(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body;
            const userId = req.user?.id;

            if (refreshToken && userId) {
                // Remove refresh token from user
                await User.updateOne(
                    { _id: userId },
                    { $pull: { refreshTokens: refreshToken } }
                );
            }

            res.json({
                success: true,
                message: 'Logout successful'
            });

        } catch (error) {
            console.error('❌ Logout error:', error);
            res.status(500).json({
                success: false,
                message: 'Logout failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Refresh access token
     * POST /api/auth/refresh
     */
    static async refreshToken(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                res.status(400).json({
                    success: false,
                    message: 'Refresh token is required'
                });
                return;
            }

            // Verify refresh token
            const decoded = jwt.verify(refreshToken, config.jwtSecret || 'your-secret-key') as JWTPayload;
            
            // Find user
            const user = await User.findOne({ 
                _id: decoded.id, 
                isActive: true,
                refreshTokens: refreshToken 
            });

            if (!user) {
                res.status(401).json({
                    success: false,
                    message: 'Invalid refresh token'
                });
                return;
            }

            // Generate new tokens
            const newAccessToken = AuthController.generateAccessToken(user);
            const newRefreshToken = AuthController.generateRefreshToken(user);

            // Update refresh tokens
            user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
            user.refreshTokens.push(newRefreshToken);
            await user.save();

            res.json({
                success: true,
                message: 'Token refreshed successfully',
                data: {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    expiresIn: 3600 // 1 hour
                }
            });

        } catch (error) {
            console.error('❌ Token refresh error:', error);
            res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }
    }

    /**
     * Verify email
     * GET /api/auth/verify-email/:token
     */
    static async verifyEmail(req: Request, res: Response): Promise<void> {
        try {
            const { token } = req.params;

            const user = await User.findOne({
                emailVerificationToken: token,
                emailVerificationExpires: { $gt: new Date() }
            });

            if (!user) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid or expired verification token'
                });
                return;
            }

            // Verify email
            user.isEmailVerified = true;
            user.emailVerificationToken = undefined;
            user.emailVerificationExpires = undefined;
            await user.save();

            res.json({
                success: true,
                message: 'Email verified successfully'
            });

        } catch (error) {
            console.error('❌ Email verification error:', error);
            res.status(500).json({
                success: false,
                message: 'Email verification failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Request password reset
     * POST /api/auth/forgot-password
     */
    static async forgotPassword(req: Request, res: Response): Promise<void> {
        try {
            const { email } = req.body;

            const user = await User.findOne({ email, isActive: true });
            if (!user) {
                // Don't reveal if email exists or not
                res.json({
                    success: true,
                    message: 'If the email exists, a password reset link has been sent'
                });
                return;
            }

            // Generate password reset token
            const resetToken = user.generatePasswordResetToken();
            await user.save();

            // TODO: Send password reset email
            console.log(`📧 Password reset token for ${email}: ${resetToken}`);

            res.json({
                success: true,
                message: 'If the email exists, a password reset link has been sent'
            });

        } catch (error) {
            console.error('❌ Forgot password error:', error);
            res.status(500).json({
                success: false,
                message: 'Password reset request failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Reset password
     * POST /api/auth/reset-password
     */
    static async resetPassword(req: Request, res: Response): Promise<void> {
        try {
            const { token, newPassword } = req.body;

            const user = await User.findOne({
                passwordResetToken: token,
                passwordResetExpires: { $gt: new Date() }
            });

            if (!user) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid or expired reset token'
                });
                return;
            }

            // Update password
            user.password = newPassword;
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            user.loginAttempts = 0;
            user.lockUntil = undefined;
            await user.save();

            res.json({
                success: true,
                message: 'Password reset successfully'
            });

        } catch (error) {
            console.error('❌ Password reset error:', error);
            res.status(500).json({
                success: false,
                message: 'Password reset failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Change password (authenticated user)
     * POST /api/auth/change-password
     */
    static async changePassword(req: Request, res: Response): Promise<void> {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
                return;
            }

            const user = await User.findById(userId);
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }

            // Verify current password
            const isCurrentPasswordValid = await user.comparePassword(currentPassword);
            if (!isCurrentPasswordValid) {
                res.status(400).json({
                    success: false,
                    message: 'Current password is incorrect'
                });
                return;
            }

            // Update password
            user.password = newPassword;
            await user.save();

            res.json({
                success: true,
                message: 'Password changed successfully'
            });

        } catch (error) {
            console.error('❌ Change password error:', error);
            res.status(500).json({
                success: false,
                message: 'Password change failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get current user profile
     * GET /api/auth/me
     */
    static async getProfile(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
                return;
            }

            const user = await User.findById(userId);
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }

            res.json({
                success: true,
                data: {
                    user: {
                        userId: user.userId,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        isEmailVerified: user.isEmailVerified,
                        avatar: user.avatar,
                        createdAt: user.createdAt
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get profile error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get profile',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Update user profile
     * PUT /api/auth/profile
     */
    static async updateProfile(req: Request, res: Response): Promise<void> {
        try {
            const { name, avatar } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
                return;
            }

            const user = await User.findById(userId);
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }

            // Update fields
            if (name) user.name = name;
            if (avatar) user.avatar = avatar;

            await user.save();

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: {
                    user: {
                        userId: user.userId,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        isEmailVerified: user.isEmailVerified,
                        avatar: user.avatar
                    }
                }
            });

        } catch (error) {
            console.error('❌ Update profile error:', error);
            res.status(500).json({
                success: false,
                message: 'Profile update failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Generate access token
     */
    private static generateAccessToken(user: IUser): string {
        return jwt.sign(
            {
                id: user._id,
                email: user.email,
                role: user.role
            },
            config.jwtSecret || 'your-secret-key',
            { expiresIn: '1h' }
        );
    }

    /**
     * Generate refresh token
     */
    private static generateRefreshToken(user: IUser): string {
        return jwt.sign(
            {
                id: user._id,
                email: user.email,
                role: user.role
            },
            config.jwtSecret || 'your-secret-key',
            { expiresIn: '7d' }
        );
    }
}
