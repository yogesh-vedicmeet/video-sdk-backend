import { Router } from 'express';
import RoomController from '../controllers/RoomController';
import { validateRequest } from '../middleware/joiValidation';
import { authenticate, rateLimit, requireUser, requireOwnership } from '../middleware/auth';
import {
    createRoomSchema,
    updateRoomSchema,
    roomIdSchema,
    roomQuerySchema,
    generateTokenSchema,
    roomStatsSchema
} from '../validations/roomValidation';

const router = Router();

// Apply rate limiting to all room routes
router.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
}));

// Apply authentication to protected routes
router.use(authenticate);

/**
 * @route   POST /api/rooms
 * @desc    Create a new room
 * @access  Private
 */
router.post('/', 
    validateRequest(createRoomSchema),
    RoomController.createRoom
);

/**
 * @route   GET /api/rooms
 * @desc    Get all rooms with pagination and filters
 * @access  Private
 */
router.get('/', 
    validateRequest(roomQuerySchema),
    RoomController.getRooms
);

/**
 * @route   GET /api/rooms/:roomId
 * @desc    Get a specific room by ID
 * @access  Private
 */
router.get('/:roomId', 
    validateRequest(roomIdSchema),
    RoomController.getRoom
);

/**
 * @route   PUT /api/rooms/:roomId
 * @desc    Update a room
 * @access  Private (Room creator only)
 */
router.put('/:roomId', 
    validateRequest(updateRoomSchema),
    requireOwnership('createdBy'),
    RoomController.updateRoom
);

/**
 * @route   DELETE /api/rooms/:roomId
 * @desc    Delete a room
 * @access  Private (Room creator only)
 */
router.delete('/:roomId', 
    validateRequest(roomIdSchema),
    requireOwnership('createdBy'),
    RoomController.deleteRoom
);

/**
 * @route   POST /api/rooms/:roomId/token
 * @desc    Generate join token for a room
 * @access  Private
 */
router.post('/:roomId/token', 
    // validateRequest(generateTokenSchema),
    RoomController.generateToken
);

/**
 * @route   GET /api/rooms/:roomId/stats
 * @desc    Get room statistics
 * @access  Private
 */
router.get('/:roomId/stats', 
    validateRequest(roomStatsSchema),
    RoomController.getRoomStats
);

/**
 * @route   POST /api/rooms/:roomId/join-random-users
 * @desc    Join random users to a room (for testing/demo)
 * @access  Private
 */
router.post('/:roomId/join-random-users', 
    validateRequest(roomIdSchema),
    RoomController.joinRandomUsers
);

/**
 * @route   POST /api/rooms/:roomId/join-as-user
 * @desc    Join as a different user to a room
 * @access  Private
 */
router.post('/:roomId/join-as-user', 
    validateRequest(roomIdSchema),
    RoomController.joinAsUser
);

export default router;
