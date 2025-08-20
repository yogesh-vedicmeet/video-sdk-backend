import { Server as SocketIOServer } from 'socket.io';
import appNamespace from './namespaces/app';
import interactiveNamespace from './namespaces/interactive';

export default (io: SocketIOServer) => {

    // app namespace - "/app"  
    appNamespace(io);

    // interactive namespace - "/interactive"
    interactiveNamespace(io);

}