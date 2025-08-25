import { Server as SocketIOServer } from 'socket.io';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  messageType: 'text' | 'system' | 'emoji' | 'gift';
  timestamp: Date;
  reactions: Record<string, string>;
  isDeleted?: boolean;
}

interface ChatRoom {
  roomId: string;
  messages: ChatMessage[];
  participants: Set<string>;
  moderators: Set<string>;
  typingUsers: Set<string>;
}

export class ChatService {
  private io: SocketIOServer;
  private chatRooms: Map<string, ChatRoom> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Chat: User connected:', socket.id);

      // Join chat room
      socket.on('join-chat', (data: { roomId: string; userId: string; userName: string; userRole: string }) => {
        this.handleJoinChat(socket, data);
      });

      // Send message
      socket.on('send-message', (data: { roomId: string; message: string; messageType?: string }) => {
        this.handleSendMessage(socket, data);
      });

      // Typing indicator
      socket.on('typing', (data: { roomId: string; userId: string; userName: string; isTyping: boolean }) => {
        this.handleTyping(socket, data);
      });

      // React to message
      socket.on('react-to-message', (data: { roomId: string; messageId: string; reaction: string; userId: string }) => {
        this.handleReactToMessage(socket, data);
      });

      // Delete message
      socket.on('delete-message', (data: { roomId: string; messageId: string; userId: string; userRole: string }) => {
        this.handleDeleteMessage(socket, data);
      });

      // Leave chat
      socket.on('leave-chat', (data: { roomId: string; userId: string; userName: string }) => {
        this.handleLeaveChat(socket, data);
      });

      // Disconnect
      socket.on('disconnect', () => {
        console.log('Chat: User disconnected:', socket.id);
        this.handleUserDisconnect(socket);
      });
    });
  }

  private handleJoinChat(socket: any, data: { roomId: string; userId: string; userName: string; userRole: string }) {
    const { roomId, userId, userName, userRole } = data;
    
    // Join socket room
    socket.join(roomId);
    
    // Get or create chat room
    let chatRoom = this.chatRooms.get(roomId);
    if (!chatRoom) {
      chatRoom = {
        roomId,
        messages: [],
        participants: new Set(),
        moderators: new Set(),
        typingUsers: new Set()
      };
      this.chatRooms.set(roomId, chatRoom);
    }

    // Add user to room
    chatRoom.participants.add(userId);
    if (userRole === 'moderator' || userRole === 'host') {
      chatRoom.moderators.add(userId);
    }

    // Send recent messages to user
    const recentMessages = chatRoom.messages.slice(-50); // Last 50 messages
    socket.emit('chat-joined', {
      roomId,
      recentMessages,
      participants: chatRoom.participants.size,
      moderators: Array.from(chatRoom.moderators)
    });

    // Notify other users
    socket.to(roomId).emit('user-joined-chat', {
      userId,
      userName,
      userRole
    });

    console.log(`Chat: User ${userName} joined room ${roomId}`);
  }

  private handleSendMessage(socket: any, data: { roomId: string; message: string; messageType?: string }) {
    const { roomId, message, messageType = 'text' } = data;
    const chatRoom = this.chatRooms.get(roomId);
    
    if (!chatRoom) {
      socket.emit('chat-error', { message: 'Chat room not found' });
      return;
    }

    const chatMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      senderId: socket.userId || 'anonymous',
      senderName: socket.userName || 'Anonymous',
      senderRole: socket.userRole || 'participant',
      message: message.trim(),
      messageType: messageType as 'text' | 'system' | 'emoji' | 'gift',
      timestamp: new Date(),
      reactions: {}
    };

    // Add message to room
    chatRoom.messages.push(chatMessage);
    
    // Keep only last 100 messages
    if (chatRoom.messages.length > 100) {
      chatRoom.messages = chatRoom.messages.slice(-100);
    }

    // Broadcast to all users in room
    this.io.to(roomId).emit('new-message', chatMessage);
    
    console.log(`Chat: Message sent in room ${roomId}:`, chatMessage.message);
  }

  private handleTyping(socket: any, data: { roomId: string; userId: string; userName: string; isTyping: boolean }) {
    const { roomId, userId, userName, isTyping } = data;
    const chatRoom = this.chatRooms.get(roomId);
    
    if (!chatRoom) return;

    if (isTyping) {
      chatRoom.typingUsers.add(userId);
    } else {
      chatRoom.typingUsers.delete(userId);
    }

    // Broadcast typing status
    socket.to(roomId).emit('user-typing', {
      userId,
      userName,
      isTyping,
      typingUsers: Array.from(chatRoom.typingUsers)
    });
  }

  private handleReactToMessage(socket: any, data: { roomId: string; messageId: string; reaction: string; userId: string }) {
    const { roomId, messageId, reaction, userId } = data;
    const chatRoom = this.chatRooms.get(roomId);
    
    if (!chatRoom) return;

    const message = chatRoom.messages.find(msg => msg.id === messageId);
    if (!message) return;

    // Update reactions
    if (message.reactions[userId]) {
      delete message.reactions[userId];
    } else {
      message.reactions[userId] = reaction;
    }

    // Broadcast reaction update
    this.io.to(roomId).emit('message-reaction-updated', {
      messageId,
      reactions: message.reactions
    });
  }

  private handleDeleteMessage(socket: any, data: { roomId: string; messageId: string; userId: string; userRole: string }) {
    const { roomId, messageId, userId, userRole } = data;
    const chatRoom = this.chatRooms.get(roomId);
    
    if (!chatRoom) return;

    const message = chatRoom.messages.find(msg => msg.id === messageId);
    if (!message) return;

    // Check permissions
    const canDelete = message.senderId === userId || userRole === 'moderator' || userRole === 'host';
    if (!canDelete) {
      socket.emit('chat-error', { message: 'Permission denied' });
      return;
    }

    // Mark message as deleted
    message.isDeleted = true;

    // Broadcast deletion
    this.io.to(roomId).emit('message-deleted', { messageId });
  }

  private handleLeaveChat(socket: any, data: { roomId: string; userId: string; userName: string }) {
    const { roomId, userId, userName } = data;
    const chatRoom = this.chatRooms.get(roomId);
    
    if (chatRoom) {
      chatRoom.participants.delete(userId);
      chatRoom.moderators.delete(userId);
      chatRoom.typingUsers.delete(userId);

      // Notify other users
      socket.to(roomId).emit('user-left-chat', {
        userId,
        userName
      });

      // Remove room if empty
      if (chatRoom.participants.size === 0) {
        this.chatRooms.delete(roomId);
      }
    }

    socket.leave(roomId);
    console.log(`Chat: User ${userName} left room ${roomId}`);
  }

  private handleUserDisconnect(socket: any) {
    // Remove user from all rooms they were in
    this.chatRooms.forEach((chatRoom, roomId) => {
      if (chatRoom.participants.has(socket.userId)) {
        this.handleLeaveChat(socket, {
          roomId,
          userId: socket.userId,
          userName: socket.userName || 'Anonymous'
        });
      }
    });
  }

  // Public methods for REST API
  public getChatRoom(roomId: string) {
    return this.chatRooms.get(roomId);
  }

  public getActiveChatRooms() {
    return Array.from(this.chatRooms.keys());
  }

  public closeChatRoom(roomId: string) {
    const chatRoom = this.chatRooms.get(roomId);
    if (chatRoom) {
      this.io.to(roomId).emit('chat-room-closed', { roomId });
      this.chatRooms.delete(roomId);
    }
  }

  public broadcastSystemMessage(roomId: string, message: string, senderName: string) {
    const chatRoom = this.chatRooms.get(roomId);
    if (!chatRoom) return;

    const systemMessage: ChatMessage = {
      id: `sys_${Date.now()}`,
      senderId: 'system',
      senderName: senderName,
      senderRole: 'moderator',
      message,
      messageType: 'system',
      timestamp: new Date(),
      reactions: {}
    };

    chatRoom.messages.push(systemMessage);
    this.io.to(roomId).emit('new-message', systemMessage);
  }
}
