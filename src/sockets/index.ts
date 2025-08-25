import { Server as SocketIOServer } from 'socket.io';
import appNamespace from './namespaces/app';
import interactiveNamespace from './namespaces/interactive';
import { ChatService } from '../services/chatService';

export default (io: SocketIOServer) => {

    // app namespace - "/app"  
    appNamespace(io);

    // interactive namespace - "/interactive"
    interactiveNamespace(io);

    // Initialize chat service
    const chatService = new ChatService(io);

    return chatService;
}