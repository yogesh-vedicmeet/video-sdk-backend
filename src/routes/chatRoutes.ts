import { Router } from 'express';
import { validateRequest } from '../middleware/joiValidation';
import { chatValidation } from '../validations/chatValidation';
import { authenticate } from '../middleware/auth';
import ChatController from '../controllers/ChatController';

const router = Router();

let chatController: ChatController;

// Function to set chat controller (called from main app)
export const setChatController = (controller: ChatController) => {
  chatController = controller;
};

// Apply authentication middleware to all routes
router.use(authenticate);

// Get chat room info
router.get('/room/:roomId', (req, res) => {
  if (!chatController) {
    return res.status(500).json({ success: false, message: 'Chat controller not initialized' });
  }
  return chatController.getChatRoom(req, res);
});

// Get active chat rooms
router.get('/rooms', (req, res) => {
  if (!chatController) {
    return res.status(500).json({ success: false, message: 'Chat controller not initialized' });
  }
  return chatController.getActiveChatRooms(req, res);
});

// Get chat statistics
router.get('/room/:roomId/stats', (req, res) => {
  if (!chatController) {
    return res.status(500).json({ success: false, message: 'Chat controller not initialized' });
  }
  return chatController.getChatStats(req, res);
});

// Send system message
router.post(
  '/room/:roomId/system-message',
  validateRequest(chatValidation.sendSystemMessage),
  (req, res) => {
    if (!chatController) {
      return res.status(500).json({ success: false, message: 'Chat controller not initialized' });
    }
    return chatController.sendSystemMessage(req, res);
  }
);

// Close chat room (admin only)
router.delete('/room/:roomId', (req, res) => {
  if (!chatController) {
    return res.status(500).json({ success: false, message: 'Chat controller not initialized' });
  }
  return chatController.closeChatRoom(req, res);
});

export default router;
