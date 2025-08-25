# Role-Based Stream Handling Implementation

This document describes the implementation of role-based access control for video streams, allowing both hosts (moderators) and participants to join the same stream with different permissions and capabilities.

## Overview

The system now supports multiple participant types in the same video stream:
- **Host/Moderator**: Full control with video, audio, screen sharing, and moderation capabilities
- **Regular Participant**: Standard video call participant with video/audio capabilities
- **Viewer**: Chat-only participant who can watch but not share video/audio

## Architecture

### Participant Roles

#### 1. Host/Moderator
- **Permissions**: Full control over the stream
- **Capabilities**:
  - Video and audio publishing
  - Screen sharing
  - Participant moderation (block/unblock)
  - End stream
  - View all participants
  - Chat messaging

#### 2. Regular Participant
- **Permissions**: Standard video call participant
- **Capabilities**:
  - Video and audio publishing
  - Chat messaging
  - View participant list
  - Cannot moderate or end stream

#### 3. Viewer (Chat-Only)
- **Permissions**: Limited to viewing and chatting
- **Capabilities**:
  - Watch stream (no video/audio publishing)
  - Chat messaging
  - View participant list
  - Cannot share screen or moderate

## Backend Implementation

### Enhanced VideoEventController

#### New Methods Added:

1. **`joinVideoEvent()`** - Enhanced with role-based access
   - Supports `role` and `joinType` parameters
   - Determines permissions based on user role
   - Creates participant with appropriate metadata

2. **`joinAsViewer()`** - Dedicated viewer join method
   - Creates chat-only participants
   - No video/audio publishing permissions
   - Optimized for view-only experience

3. **`generateEventToken()`** - Role-based token generation
   - Generates different tokens based on role
   - Host/Moderator: Full permissions token
   - Viewer: Limited permissions token
   - Regular Participant: Standard permissions token

### Participant Metadata Structure

```typescript
interface ParticipantMetadata {
  role: 'host' | 'moderator' | 'participant' | 'viewer';
  joinType: 'video' | 'viewer';
  isHost: boolean;
  isModerator: boolean;
  isViewer: boolean;
  isBlocked: boolean;
  canVideo: boolean;
  canAudio: boolean;
  canChat: boolean;
  canScreenShare: boolean;
  canModerate: boolean;
}
```

### Permission Helper Function

```typescript
const getParticipantPermissions = (isHost: boolean, isModerator: boolean, isViewer: boolean) => {
  return {
    canVideo: !isViewer,
    canAudio: !isViewer,
    canChat: true,
    canScreenShare: isModerator,
    canModerate: isModerator,
    canEndEvent: isHost,
    canBlockUsers: isModerator,
    canViewParticipantList: true,
    canSendMessages: true,
    canReceiveMessages: true,
    isHost,
    isModerator,
    isViewer
  };
};
```

## API Endpoints

### New/Enhanced Endpoints:

1. **`POST /api/video-events/:eventId/join`**
   - Enhanced with role-based parameters
   - Supports `role` and `joinType` in request body
   - Returns participant data with permissions

2. **`POST /api/video-events/:eventId/join-viewer`**
   - Dedicated endpoint for viewer joining
   - Creates chat-only participants
   - Optimized for view-only experience

3. **`POST /api/video-events/:eventId/token`**
   - Enhanced with role-based token generation
   - Returns appropriate LiveKit token based on role
   - Includes permission metadata

### Request/Response Examples:

#### Join as Regular Participant:
```json
POST /api/video-events/123/join
{
  "userId": "user123",
  "userName": "John Doe",
  "role": "participant",
  "joinType": "video"
}

Response:
{
  "success": true,
  "data": {
    "participant": {...},
    "role": "participant",
    "joinType": "video",
    "permissions": {
      "canVideo": true,
      "canAudio": true,
      "canChat": true,
      "canScreenShare": false,
      "canModerate": false
    }
  }
}
```

#### Join as Viewer:
```json
POST /api/video-events/123/join-viewer
{
  "userId": "user456",
  "userName": "Jane Smith"
}

Response:
{
  "success": true,
  "data": {
    "participant": {...},
    "role": "viewer",
    "joinType": "viewer",
    "permissions": {
      "canVideo": false,
      "canAudio": false,
      "canChat": true,
      "canScreenShare": false,
      "canModerate": false
    }
  }
}
```

## Frontend Integration

### Enhanced Video Controller

Added new method for viewer joining:
```javascript
// Join as viewer (chat-only participant)
joinAsViewer: async (eventId, userData = {}) => {
  try {
    const api = await createApiInstance();
    const response = await api.post(`/video-events/${eventId}/join-viewer`, userData);
    return response.data;
  } catch (error) {
    console.error('Error joining as viewer:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to join as viewer',
    };
  }
}
```

### Live Stream Participant Screen

Updated to use viewer join endpoint:
```javascript
// Join as viewer first
const joinResponse = await videoController.joinAsViewer(streamId, {
  userId: user?._id,
  userName: user?.name || user?.accountName,
});

if (!joinResponse.success) {
  throw new Error(joinResponse.message || 'Failed to join stream');
}
```

## LiveKit Integration

### Token Generation by Role

1. **Host/Moderator Token**:
   - Full publishing permissions
   - Can publish video, audio, and screen share
   - Can moderate participants

2. **Regular Participant Token**:
   - Standard publishing permissions
   - Can publish video and audio
   - Cannot moderate

3. **Viewer Token**:
   - No publishing permissions
   - Can only subscribe to streams
   - Optimized for viewing experience

### Room Configuration

The same LiveKit room supports all participant types:
- Host publishes video/audio streams
- Regular participants can publish their streams
- Viewers only subscribe to streams
- All participants can use chat functionality

## Benefits

### 1. **Scalability**
- Viewers consume fewer resources
- More participants can join as viewers
- Better performance for large streams

### 2. **User Experience**
- Lower barrier to entry for viewers
- No camera/microphone pressure
- Focused on content consumption

### 3. **Flexibility**
- Users can choose participation level
- Hosts can control access levels
- Supports various use cases

### 4. **Resource Optimization**
- Viewers don't publish streams
- Reduced bandwidth usage
- Better server performance

## Security Considerations

### 1. **Role Validation**
- Server-side role verification
- Token-based permission enforcement
- Participant metadata validation

### 2. **Access Control**
- Host-only moderation features
- Blocked user prevention
- Private event protection

### 3. **Token Security**
- Role-specific token generation
- Time-limited tokens
- Secure token transmission

## Testing Scenarios

### 1. **Host Joining**
- [ ] Host can join with full permissions
- [ ] Host can moderate participants
- [ ] Host can end stream

### 2. **Regular Participant Joining**
- [ ] Participant can join with video/audio
- [ ] Participant can chat
- [ ] Participant cannot moderate

### 3. **Viewer Joining**
- [ ] Viewer can join without video/audio
- [ ] Viewer can chat
- [ ] Viewer cannot publish streams

### 4. **Mixed Participation**
- [ ] Host, participants, and viewers in same room
- [ ] Proper permission enforcement
- [ ] Chat works for all types

## Future Enhancements

### 1. **Advanced Roles**
- Co-moderator role
- Guest speaker role
- Premium viewer role

### 2. **Dynamic Role Changes**
- Promote viewer to participant
- Demote participant to viewer
- Temporary moderator assignment

### 3. **Analytics**
- Role-based participation tracking
- Viewer engagement metrics
- Stream performance analytics

---

**Note**: This implementation provides a flexible foundation for role-based stream participation while maintaining security and performance optimization.
