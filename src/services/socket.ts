import { Server } from "socket.io";

class Socket {
    private static instance: Socket;
    private namespaces: Map<string, Server> = new Map();

    constructor() {
        if (Socket.instance) {
            return Socket.instance;
        }
        Socket.instance = this;
    }

    setNamespace(namespace: Server, name: string) {
        this.namespaces.set(name, namespace);
    }

    getNamespace(name: string) {
        return this.namespaces.get(name);
    }

    emitToAll(eventName: string, data: any, namespaceName: string) {
        const namespace = this.namespaces.get(namespaceName);
        if (namespace) {
            namespace.emit(eventName, data);
        }
    }
}

// Create and export singleton instance
const socket = new Socket();
// Remove Object.freeze to allow property modifications
// Object.freeze was causing the error: Cannot assign to read only property 'appNamespace'

export default socket;
