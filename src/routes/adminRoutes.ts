import express from 'express';
import { AdminController } from '../controllers/AdminController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validateRequest } from '../middleware/joiValidation';
import { 
    updateUserSchema, 
    resetPasswordSchema 
} from '../validations/adminValidation';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (admin only)
 * @access  Admin
 */
router.get('/users', AdminController.getAllUsers);

/**
 * @route   GET /api/admin/users/:userId
 * @desc    Get user by ID (admin only)
 * @access  Admin
 */
router.get('/users/:userId', AdminController.getUserById);

/**
 * @route   PUT /api/admin/users/:userId
 * @desc    Update user (admin only)
 * @access  Admin
 */
router.put('/users/:userId', validateRequest(updateUserSchema), AdminController.updateUser);

/**
 * @route   DELETE /api/admin/users/:userId
 * @desc    Delete user (admin only)
 * @access  Admin
 */
router.delete('/users/:userId', AdminController.deleteUser);

/**
 * @route   POST /api/admin/users/:userId/reset-password
 * @desc    Reset user password (admin only)
 * @access  Admin
 */
router.post('/users/:userId/reset-password', validateRequest(resetPasswordSchema), AdminController.resetUserPassword);

/**
 * @route   POST /api/admin/users/:userId/unlock
 * @desc    Unlock user account (admin only)
 * @access  Admin
 */
router.post('/users/:userId/unlock', AdminController.unlockUser);

/**
 * @route   POST /api/admin/users/:userId/promote
 * @desc    Promote user to moderator/admin (admin only)
 * @access  Admin
 */
router.post('/users/:userId/promote', AdminController.promoteUser);

/**
 * @route   POST /api/admin/users/:userId/demote
 * @desc    Demote user (admin only)
 * @access  Admin
 */
router.post('/users/:userId/demote', AdminController.demoteUser);

/**
 * @route   GET /api/admin/stats
 * @desc    Get system statistics (admin only)
 * @access  Admin
 */
router.get('/stats', AdminController.getSystemStats);

export default router;
