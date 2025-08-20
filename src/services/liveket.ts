import { 
    AccessToken, 
    RoomServiceClient, 
    VideoGrant, 
    Room, 
    ParticipantInfo,
    DataPacket_Kind,
    WebhookReceiver,
    WebhookEvent
} from 'livekit-server-sdk';
import { config } from '../config/config';

// Configuration
const API_KEY = config.livekitApiKey;
const API_SECRET = config.livekitApiSecret;
const LK_URL = config.livekitUrl;

// Initialize clients
const roomService = new RoomServiceClient(LK_URL, API_KEY, API_SECRET);

// Types and interfaces
export interface ParticipantData {
    identity: string;
    name?: string;
    metadata?: Record<string, any>;
    permissions?: {
        canPublish: boolean;
        canSubscribe: boolean;
        canPublishData: boolean;
        canUpdateMetadata: boolean;
    };
}

export interface RoomOptions {
    name: string;
    emptyTimeout?: number;
    maxParticipants?: number;
    nodeId?: string;
    metadata?: string;
}

export interface TokenOptions {
    identity: string;
    room: string;
    metadata?: Record<string, any>;
    grants?: VideoGrant;
    ttl?: number; // Token time to live in seconds
}

/**
 * Generate a join token for a participant
 */
export async function generateJoinToken({ 
    identity, 
    room, 
    metadata = {}, 
    grants = {},
    ttl = 3600 
}: TokenOptions): Promise<string> {
    try {
        const at = new AccessToken(API_KEY, API_SECRET, { 
            identity,
            ttl 
        });

        // Add room grant
        at.addGrant({ 
            roomJoin: true, 
            room,
            ...grants
        });

        // Add metadata
        if (Object.keys(metadata).length > 0) {
            at.metadata = JSON.stringify(metadata);
        }

        const token = await at.toJwt();
        console.log(`🎫 Generated token for ${identity} in room ${room}`);
        return token;
    } catch (error) {
        console.error('❌ Failed to generate join token:', error);
        throw error;
    }
}

/**
 * Create a room if it doesn't exist
 */
export async function createRoomIfNotExists(room: string, options?: Partial<RoomOptions>): Promise<Room | null> {
    try {
        const roomOptions = {
            name: room,
            emptyTimeout: 10 * 60, // 10 minutes
            maxParticipants: 20,
            ...options
        };

        const createdRoom = await roomService.createRoom({ name: room });
        console.log(`🏠 Created room: ${room}`);
        return createdRoom;
    } catch (error: any) {
        // Room might already exist, which is fine
        if (error.message?.includes('ALREADY_EXISTS') || error.message?.includes('already exists')) {
            console.log(`🏠 Room ${room} already exists`);
            return null;
        }
        console.error(`❌ Failed to create room ${room}:`, error);
        throw error;
    }
}

/**
 * Delete a room
 */
export async function deleteRoom(roomName: string): Promise<boolean> {
    try {
        await roomService.deleteRoom(roomName);
        console.log(`🗑️ Deleted room: ${roomName}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to delete room ${roomName}:`, error);
        return false;
    }
}

/**
 * List all rooms
 */
export async function listRooms(): Promise<Room[]> {
    try {
        const rooms = await roomService.listRooms();
        console.log(`📋 Found ${rooms.length} rooms`);
        return rooms;
    } catch (error) {
        console.error('❌ Failed to list rooms:', error);
        throw error;
    }
}

/**
 * Get room information
 */
export async function getRoom(roomName: string): Promise<Room | null> {
    try {
        const rooms = await roomService.listRooms();
        const room = rooms.find(r => r.name === roomName);
        console.log(`📋 Retrieved room info for: ${roomName}`);
        return room || null;
    } catch (error) {
        console.error(`❌ Failed to get room ${roomName}:`, error);
        return null;
    }
}

/**
 * List participants in a room
 */
export async function listParticipants(roomName: string): Promise<ParticipantInfo[]> {
    try {
        const participants = await roomService.listParticipants(roomName);
        console.log(`👥 Found ${participants.length} participants in room ${roomName}`);
        return participants;
    } catch (error) {
        console.error(`❌ Failed to list participants in room ${roomName}:`, error);
        throw error;
    }
}

/**
 * Get participant information
 */
export async function getParticipant(roomName: string, identity: string): Promise<ParticipantInfo | null> {
    try {
        const participant = await roomService.getParticipant(roomName, identity);
        console.log(`👤 Retrieved participant info for ${identity} in room ${roomName}`);
        return participant;
    } catch (error) {
        console.error(`❌ Failed to get participant ${identity} in room ${roomName}:`, error);
        return null;
    }
}

/**
 * Remove a participant from a room
 */
export async function removeParticipant(roomName: string, identity: string): Promise<boolean> {
    try {
        await roomService.removeParticipant(roomName, identity);
        console.log(`🚪 Removed participant ${identity} from room ${roomName}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to remove participant ${identity} from room ${roomName}:`, error);
        return false;
    }
}

/**
 * Mute a participant's audio
 */
export async function muteParticipantAudio(roomName: string, identity: string, muted: boolean): Promise<boolean> {
    try {
        await roomService.mutePublishedTrack(roomName, identity, 'audio', muted);
        console.log(`🔇 ${muted ? 'Muted' : 'Unmuted'} audio for participant ${identity} in room ${roomName}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to mute audio for participant ${identity} in room ${roomName}:`, error);
        return false;
    }
}

/**
 * Mute a participant's video
 */
export async function muteParticipantVideo(roomName: string, identity: string, muted: boolean): Promise<boolean> {
    try {
        await roomService.mutePublishedTrack(roomName, identity, 'video', muted);
        console.log(`📹 ${muted ? 'Muted' : 'Unmuted'} video for participant ${identity} in room ${roomName}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to mute video for participant ${identity} in room ${roomName}:`, error);
        return false;
    }
}

/**
 * Send data to participants in a room
 */
export async function sendData(
    roomName: string, 
    data: Uint8Array, 
    topic?: string, 
    participantIdentities?: string[]
): Promise<boolean> {
    try {
        await roomService.sendData(roomName, data, DataPacket_Kind.RELIABLE, {
            topic,
            destinationIdentities: participantIdentities
        });
        console.log(`📤 Sent data to room ${roomName}${topic ? ` on topic ${topic}` : ''}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send data to room ${roomName}:`, error);
        return false;
    }
}

/**
 * Update participant metadata
 */
export async function updateParticipantMetadata(
    roomName: string, 
    identity: string, 
    metadata: string
): Promise<boolean> {
    try {
        await roomService.updateParticipant(roomName, identity, metadata);
        console.log(`📝 Updated metadata for participant ${identity} in room ${roomName}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to update metadata for participant ${identity} in room ${roomName}:`, error);
        return false;
    }
}

/**
 * Get room statistics
 */
export async function getRoomStats(roomName: string): Promise<{
    room: Room | null;
    participants: ParticipantInfo[];
    participantCount: number;
    isActive: boolean;
}> {
    try {
        const [room, participants] = await Promise.all([
            getRoom(roomName),
            listParticipants(roomName)
        ]);

        const stats = {
            room,
            participants,
            participantCount: participants.length,
            isActive: room !== null && participants.length > 0
        };

        console.log(`📊 Room stats for ${roomName}:`, {
            participantCount: stats.participantCount,
            isActive: stats.isActive
        });

        return stats;
    } catch (error) {
        console.error(`❌ Failed to get room stats for ${roomName}:`, error);
        throw error;
    }
}

/**
 * Validate webhook signature
 */
export async function validateWebhookSignature(
    body: string, 
    auth: string, 
    url: string
): Promise<WebhookEvent | null> {
    try {
        const receiver = new WebhookReceiver(API_KEY, API_SECRET);
        const event = await receiver.receive(body, auth);
        console.log(`🔐 Validated webhook signature for event: ${event.event}`);
        return event;
    } catch (error) {
        console.error('❌ Failed to validate webhook signature:', error);
        return null;
    }
}

/**
 * Generate a temporary token for a participant
 */
export async function generateTemporaryToken(
    identity: string, 
    room: string, 
    durationMinutes: number = 60
): Promise<string> {
    return await generateJoinToken({
        identity,
        room,
        ttl: durationMinutes * 60
    });
}

/**
 * Generate a moderator token with full permissions
 */
export async function generateModeratorToken(identity: string, room: string): Promise<string> {
    return await generateJoinToken({
        identity,
        room,
        grants: {
            roomJoin: true,
            room: room,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
            canUpdateOwnMetadata: true
        }
    });
}

/**
 * Generate a viewer token with limited permissions
 */
export async function generateViewerToken(identity: string, room: string): Promise<string> {
    return await generateJoinToken({
        identity,
        room,
        grants: {
            roomJoin: true,
            room: room,
            canPublish: false,
            canSubscribe: true,
            canPublishData: false,
            canUpdateOwnMetadata: false
        }
    });
}

/**
 * Clean up inactive rooms
 */
export async function cleanupInactiveRooms(maxEmptyTime: number = 3600): Promise<number> {
    try {
        const rooms = await listRooms();
        const now = Date.now();
        let cleanedCount = 0;

        for (const room of rooms) {
            // For now, we'll clean up rooms that have no participants
            const participants = await listParticipants(room.name);
            if (participants.length === 0) {
                await deleteRoom(room.name);
                cleanedCount++;
            }
        }

        console.log(`🧹 Cleaned up ${cleanedCount} inactive rooms`);
        return cleanedCount;
    } catch (error) {
        console.error('❌ Failed to cleanup inactive rooms:', error);
        return 0;
    }
}

// Export all functions and types
export {
    roomService
};

// Default export for convenience
export default {
    generateJoinToken,
    createRoomIfNotExists,
    deleteRoom,
    listRooms,
    getRoom,
    listParticipants,
    getParticipant,
    removeParticipant,
    muteParticipantAudio,
    muteParticipantVideo,
    sendData,
    updateParticipantMetadata,
    getRoomStats,
    validateWebhookSignature,
    generateTemporaryToken,
    generateModeratorToken,
    generateViewerToken,
    cleanupInactiveRooms
};