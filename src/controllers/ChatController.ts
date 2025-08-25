import { Request, Response } from 'express';
import { ChatService } from '../services/chatService';

class ChatController {
  private chatService: ChatService;

  constructor(chatService: ChatService) {
    this.chatService = chatService;
  }

  // Get chat room info
  public getChatRoom = async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const chatRoom = await this.chatService.getChatRoom(roomId);

      if (!chatRoom) {
        return res.status(404).json({
          success: false,
          message: 'Chat room not found'
        });
      }

      res.json({
        success: true,
        data: chatRoom
      });
    } catch (error) {
      console.error('ChatController: Error getting chat room:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  // Get active chat rooms
  public getActiveChatRooms = async (req: Request, res: Response) => {
    try {
      const chatRooms = await this.chatService.getActiveChatRooms();

      res.json({
        success: true,
        data: chatRooms
      });
    } catch (error) {
      console.error('ChatController: Error getting active chat rooms:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  // Close chat room (admin only)
  public closeChatRoom = async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const user = req.user as any;

      // Check if user is admin
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      await this.chatService.closeChatRoom(roomId);

      res.json({
        success: true,
        message: 'Chat room closed successfully'
      });
    } catch (error) {
      console.error('ChatController: Error closing chat room:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  // Send system message
  public sendSystemMessage = async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const { message, senderName } = req.body;
      const user = req.user as any;

      // Check if user is moderator or admin
      if (user.role !== 'admin' && user.role !== 'moderator') {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Message is required'
        });
      }

      await this.chatService.broadcastSystemMessage(
        roomId,
        message.trim(),
        senderName || user.name || 'System'
      );

      res.json({
        success: true,
        message: 'System message sent successfully'
      });
    } catch (error) {
      console.error('ChatController: Error sending system message:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  // Get chat statistics
  public getChatStats = async (req: Request, res: Response) => {
    try {
      const { roomId } = req.params;
      const chatRoom = await this.chatService.getChatRoom(roomId);

      if (!chatRoom) {
        return res.status(404).json({
          success: false,
          message: 'Chat room not found'
        });
      }

      const stats = {
        roomId: chatRoom.roomId,
        participants: Array.from(chatRoom.participants).length,
        moderators: Array.from(chatRoom.moderators).length,
        isActive: true,
        createdAt: new Date(),
        lastMessageAt: new Date()
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('ChatController: Error getting chat stats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}

export default ChatController;
