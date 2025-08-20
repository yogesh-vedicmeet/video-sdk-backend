import { Router } from 'express';
import LiveStreamController from '../controllers/LiveStreamController';
import { validateRequest } from '../middleware/joiValidation';
import { authenticate, rateLimit } from '../middleware/auth';
import {
    createStreamSchema,
    streamIdSchema,
    startStreamSchema,
    joinStreamSchema,
    leaveStreamSchema,
    chatMessageSchema,
    updateStreamSchema,
    streamEventsSchema,
    stopRecordingSchema
} from '../validations/streamValidation';

const router = Router();

// Apply rate limiting and authentication to all stream routes
router.use(rateLimit);
router.use(authenticate);

/**
 * @route   POST /api/streams
 * @desc    Create a new live stream
 * @access  Private
 */
router.post('/', 
    validateRequest(createStreamSchema),
    LiveStreamController.createStream
);

/**
 * @route   GET /api/streams/:streamId
 * @desc    Get stream information
 * @access  Private
 */
router.get('/:streamId', 
    validateRequest(streamIdSchema),
    LiveStreamController.getStream
);

/**
 * @route   PUT /api/streams/:streamId
 * @desc    Update stream configuration
 * @access  Private (Stream owner only)
 */
router.put('/:streamId', 
    validateRequest(updateStreamSchema),
    LiveStreamController.updateStream
);

/**
 * @route   POST /api/streams/:streamId/start
 * @desc    Start a live stream
 * @access  Private (Stream owner only)
 */
router.post('/:streamId/start', 
    validateRequest(startStreamSchema),
    LiveStreamController.startStream
);

/**
 * @route   POST /api/streams/:streamId/stop
 * @desc    Stop a live stream
 * @access  Private (Stream owner only)
 */
router.post('/:streamId/stop', 
    validateRequest(streamIdSchema),
    LiveStreamController.stopStream
);

/**
 * @route   POST /api/streams/:streamId/pause
 * @desc    Pause a live stream
 * @access  Private (Stream owner only)
 */
router.post('/:streamId/pause', 
    validateRequest(streamIdSchema),
    LiveStreamController.pauseStream
);

/**
 * @route   POST /api/streams/:streamId/resume
 * @desc    Resume a paused stream
 * @access  Private (Stream owner only)
 */
router.post('/:streamId/resume', 
    validateRequest(streamIdSchema),
    LiveStreamController.resumeStream
);

/**
 * @route   GET /api/streams/:streamId/stats
 * @desc    Get stream statistics
 * @access  Private
 */
router.get('/:streamId/stats', 
    validateRequest(streamIdSchema),
    LiveStreamController.getStreamStats
);

/**
 * @route   POST /api/streams/:streamId/join
 * @desc    Join stream as viewer
 * @access  Private
 */
router.post('/:streamId/join', 
    validateRequest(joinStreamSchema),
    LiveStreamController.joinStream
);

/**
 * @route   POST /api/streams/:streamId/leave
 * @desc    Leave stream as viewer
 * @access  Private
 */
router.post('/:streamId/leave', 
    validateRequest(leaveStreamSchema),
    LiveStreamController.leaveStream
);

/**
 * @route   POST /api/streams/:streamId/chat
 * @desc    Send chat message
 * @access  Private
 */
router.post('/:streamId/chat', 
    validateRequest(chatMessageSchema),
    LiveStreamController.sendChatMessage
);

/**
 * @route   POST /api/streams/:streamId/recording/start
 * @desc    Start recording stream
 * @access  Private (Stream owner only)
 */
router.post('/:streamId/recording/start', 
    validateRequest(streamIdSchema),
    LiveStreamController.startRecording
);

/**
 * @route   POST /api/streams/:streamId/recording/stop
 * @desc    Stop recording stream
 * @access  Private (Stream owner only)
 */
router.post('/:streamId/recording/stop', 
    validateRequest(stopRecordingSchema),
    LiveStreamController.stopRecording
);

/**
 * @route   GET /api/streams/:streamId/events
 * @desc    Get stream events
 * @access  Private
 */
router.get('/:streamId/events', 
    validateRequest(streamEventsSchema),
    LiveStreamController.getStreamEvents
);

export default router;
