import { Router } from 'express';
import VideoEventController from '../controllers/VideoEventController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);


// Video Event routes
router.post('/', VideoEventController.createVideoEvent);
router.get('/', VideoEventController.getVideoEvents);
router.get('/:eventId', VideoEventController.getVideoEvent);
router.put('/:eventId', VideoEventController.updateVideoEvent);
router.post('/:eventId/close', VideoEventController.closeVideoEvent);
router.post('/:eventId/duplicate', VideoEventController.duplicateVideoEvent);
router.delete('/:eventId', VideoEventController.deleteVideoEvent);  

// Participant management
router.get('/:eventId/participants', VideoEventController.getEventParticipants);
router.post('/:eventId/participants/:userId', VideoEventController.modifyParticipant);
router.get('/:eventId/blocked-users', VideoEventController.getBlockedUsers);
router.post('/:eventId/blocked-users/:userId', VideoEventController.blockUser);
router.delete('/:eventId/blocked-users/:userId', VideoEventController.unblockUser);

// Waitlist management
router.get('/:eventId/waitlist', VideoEventController.getEventWaitlist);
router.post('/:eventId/token', VideoEventController.generateEventToken);

// User participation
router.post('/:eventId/join', VideoEventController.joinVideoEvent);
router.post('/:eventId/join-viewer', VideoEventController.joinAsViewer);
router.post('/:eventId/leave', VideoEventController.leaveVideoEvent);
router.get('/:eventId/access', VideoEventController.checkEventAccess);
router.get('/user/events', VideoEventController.getUserVideoEvents);

export default router;
