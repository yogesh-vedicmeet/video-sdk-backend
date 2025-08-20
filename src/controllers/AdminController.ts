import { Request, Response } from 'express';
import { User, IUser } from '../models/User';
import { Room } from '../models/Room';
import { Poll } from '../models/Poll';

export class AdminController {
    
    /**
     * Get all users (admin only)
     * GET /api/admin/users
     */
    static async getAllUsers(req: Request, res: Response): Promise<void> {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const search = req.query.search as string;
            const role = req.query.role as string;
            const isActive = req.query.isActive as string;

            const skip = (page - 1) * limit;
            
            // Build filter
            const filter: any = {};
            if (search) {
                filter.$or = [
                    { email: { $regex: search, $options: 'i' } },
                    { name: { $regex: search, $options: 'i' } },
                    { userId: { $regex: search, $options: 'i' } }
                ];
            }
            if (role) filter.role = role;
            if (isActive !== undefined) filter.isActive = isActive === 'true';

            const users = await User.find(filter)
                .select('-password -refreshTokens -emailVerificationToken -passwordResetToken')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            const total = await User.countDocuments(filter);

            res.json({
                success: true,
                data: {
                    users,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit)
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get all users error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get users',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get user by ID (admin only)
     * GET /api/admin/users/:userId
     */
    static async getUserById(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;

            const user = await User.findOne({ userId })
                .select('-password -refreshTokens -emailVerificationToken -passwordResetToken');

            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }

            res.json({
                success: true,
                data: { user }
            });

        } catch (error) {
            console.error('❌ Get user by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get user',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Update user (admin only)
     * PUT /api/admin/users/:userId
     */
    static async updateUser(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;
            const { name, email, role, isActive, isEmailVerified } = req.body;

            const user = await User.findOne({ userId });
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }

            // Check if email is already taken by another user
            if (email && email !== user.email) {
                const existingUser = await User.findOne({ email });
                if (existingUser) {
                    res.status(409).json({
                        success: false,
                        message: 'Email already taken'
                    });
                    return;
                }
            }

            // Update fields
            if (name) user.name = name;
            if (email) user.email = email;
            if (role) user.role = role;
            if (isActive !== undefined) user.isActive = isActive;
            if (isEmailVerified !== undefined) user.isEmailVerified = isEmailVerified;

            await user.save();

            res.json({
                success: true,
                message: 'User updated successfully',
                data: {
                    user: {
                        userId: user.userId,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        isActive: user.isActive,
                        isEmailVerified: user.isEmailVerified,
                        createdAt: user.createdAt
                    }
                }
            });

        } catch (error) {
            console.error('❌ Update user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update user',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Delete user (admin only)
     * DELETE /api/admin/users/:userId
     */
    static async deleteUser(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;

            const user = await User.findOne({ userId });
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }

            // Prevent deleting the last admin
            if (user.role === 'admin') {
                const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
                if (adminCount <= 1) {
                    res.status(400).json({
                        success: false,
                        message: 'Cannot delete the last admin user'
                    });
                    return;
                }
            }

            // Soft delete - set isActive to false
            user.isActive = false;
            await user.save();

            res.json({
                success: true,
                message: 'User deleted successfully'
            });

        } catch (error) {
            console.error('❌ Delete user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete user',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get system statistics (admin only)
     * GET /api/admin/stats
     */
    static async getSystemStats(req: Request, res: Response): Promise<void> {
        try {
            const [
                totalUsers,
                activeUsers,
                totalRooms,
                activeRooms,
                totalPolls,
                activePolls,
                verifiedUsers,
                adminUsers,
                moderatorUsers
            ] = await Promise.all([
                User.countDocuments(),
                User.countDocuments({ isActive: true }),
                Room.countDocuments(),
                Room.countDocuments({ isActive: true }),
                Poll.countDocuments(),
                Poll.countDocuments({ isActive: true }),
                User.countDocuments({ isEmailVerified: true }),
                User.countDocuments({ role: 'admin', isActive: true }),
                User.countDocuments({ role: 'moderator', isActive: true })
            ]);

            // Get recent activity
            const recentUsers = await User.find({ isActive: true })
                .sort({ lastLoginAt: -1 })
                .limit(5)
                .select('userId name email lastLoginAt');

            const recentRooms = await Room.find({ isActive: true })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('roomId name createdBy createdAt');

            res.json({
                success: true,
                data: {
                    overview: {
                        totalUsers,
                        activeUsers,
                        totalRooms,
                        activeRooms,
                        totalPolls,
                        activePolls,
                        verifiedUsers,
                        adminUsers,
                        moderatorUsers
                    },
                    recentActivity: {
                        recentUsers,
                        recentRooms
                    }
                }
            });

        } catch (error) {
            console.error('❌ Get system stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get system statistics',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Reset user password (admin only)
     * POST /api/admin/users/:userId/reset-password
     */
    static async resetUserPassword(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;
            const { newPassword } = req.body;

            const user = await User.findOne({ userId });
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }

            // Update password
            user.password = newPassword;
            user.loginAttempts = 0;
            user.lockUntil = undefined;
            await user.save();

            res.json({
                success: true,
                message: 'User password reset successfully'
            });

        } catch (error) {
            console.error('❌ Reset user password error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to reset user password',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Unlock user account (admin only)
     * POST /api/admin/users/:userId/unlock
     */
    static async unlockUser(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;

            const user = await User.findOne({ userId });
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }

            // Unlock account
            user.loginAttempts = 0;
            user.lockUntil = undefined;
            await user.save();

            res.json({
                success: true,
                message: 'User account unlocked successfully'
            });

        } catch (error) {
            console.error('❌ Unlock user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to unlock user account',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Promote user to moderator (admin only)
     * POST /api/admin/users/:userId/promote
     */
    static async promoteUser(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;

            const user = await User.findOne({ userId });
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }

            if (user.role === 'admin') {
                res.status(400).json({
                    success: false,
                    message: 'User is already an admin'
                });
                return;
            }

            // Promote user
            user.role = user.role === 'user' ? 'moderator' : 'admin';
            await user.save();

            res.json({
                success: true,
                message: `User promoted to ${user.role} successfully`,
                data: {
                    user: {
                        userId: user.userId,
                        email: user.email,
                        name: user.name,
                        role: user.role
                    }
                }
            });

        } catch (error) {
            console.error('❌ Promote user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to promote user',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Demote user (admin only)
     * POST /api/admin/users/:userId/demote
     */
    static async demoteUser(req: Request, res: Response): Promise<void> {
        try {
            const { userId } = req.params;

            const user = await User.findOne({ userId });
            if (!user) {
                res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
                return;
            }

            if (user.role === 'user') {
                res.status(400).json({
                    success: false,
                    message: 'User is already a regular user'
                });
                return;
            }

            // Prevent demoting the last admin
            if (user.role === 'admin') {
                const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
                if (adminCount <= 1) {
                    res.status(400).json({
                        success: false,
                        message: 'Cannot demote the last admin user'
                    });
                    return;
                }
            }

            // Demote user
            user.role = user.role === 'admin' ? 'moderator' : 'user';
            await user.save();

            res.json({
                success: true,
                message: `User demoted to ${user.role} successfully`,
                data: {
                    user: {
                        userId: user.userId,
                        email: user.email,
                        name: user.name,
                        role: user.role
                    }
                }
            });

        } catch (error) {
            console.error('❌ Demote user error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to demote user',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
