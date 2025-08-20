import { Socket, Server as SocketIOServer } from 'socket.io';

export default async (io: SocketIOServer) => {
    const appNameSpace = io.of('/app');
    appNameSpace.on('connection', (socket: Socket) => {
        console.log('app namespace connected');
    });
}