# Interactive Live Streaming Features

This document describes the interactive features added to the Video SDK backend to enhance live streaming experiences with polls, Q&A, gifts, and emojis while maintaining smooth streaming performance.

## 🎯 Features Overview

### 1. Real-time Polls & Q&A
- **Live Polls**: Create and vote on polls during live streams
- **Q&A System**: Ask questions, upvote/downvote, and get answers
- **Real-time Updates**: Instant results and question updates

### 2. Gift System
- **Virtual Gifts**: Send gifts to streamers or other participants
- **Gift Types**: Different gift categories with varying values
- **Gift Messages**: Optional messages with gifts

### 3. Emoji Reactions
- **Real-time Emojis**: Send emoji reactions during streams
- **Global & Targeted**: Send to everyone or specific users
- **Emoji Messages**: Optional text with emoji reactions

### 4. Performance Optimization
- **Message Batching**: Reduces network overhead
- **Rate Limiting**: Prevents spam and abuse
- **Caching**: Fast data retrieval for smooth experience
- **Throttling**: Optimizes update frequency

## 🏗️ Architecture

### Database Models

#### Poll Model (`models/Poll.ts`)
```typescript
interface IPoll {
    pollId: string;
    roomId: string;
    question: string;
    options: IPollOption[];
    createdBy: string;
    isActive: boolean;
    isMultipleChoice: boolean;
    duration?: number;
    expiresAt?: Date;
    totalVotes: number;
}
```

#### Question Model (`models/Question.ts`)
```typescript
interface IQuestion {
    questionId: string;
    roomId: string;
    question: string;
    askedBy: string;
    askedByName: string;
    isAnswered: boolean;
    isHighlighted: boolean;
    upvotes: number;
    downvotes: number;
    voters: { upvoters: string[]; downvoters: string[] };
    answeredBy?: string;
    answeredByName?: string;
    answer?: string;
    answeredAt?: Date;
}
```

#### Gift Model (`models/Gift.ts`)
```typescript
interface IGift {
    giftId: string;
    roomId: string;
    giftType: string;
    giftName: string;
    giftValue: number;
    senderId: string;
    senderName: string;
    receiverId: string;
    receiverName: string;
    message?: string;
    isProcessed: boolean;
    processedAt?: Date;
}
```

#### Emoji Model (`models/Emoji.ts`)
```typescript
interface IEmoji {
    emojiId: string;
    roomId: string;
    emoji: string;
    senderId: string;
    senderName: string;
    receiverId?: string;
    receiverName?: string;
    message?: string;
    isGlobal: boolean;
}
```

## 🚀 API Endpoints

### Polls

#### Create Poll
```http
POST /api/interactive/:roomId/polls
Content-Type: application/json

{
    "question": "What's your favorite color?",
    "options": ["Red", "Blue", "Green", "Yellow"],
    "isMultipleChoice": false,
    "duration": 300
}
```

#### Vote on Poll
```http
POST /api/interactive/polls/:pollId/vote
Content-Type: application/json

{
    "optionId": "option-uuid"
}
```

#### Get Poll Results
```http
GET /api/interactive/polls/:pollId/results
```

#### Get Active Polls
```http
GET /api/interactive/:roomId/polls
```

### Q&A

#### Ask Question
```http
POST /api/interactive/:roomId/questions
Content-Type: application/json

{
    "question": "How do you handle performance optimization?",
    "askedByName": "John Doe"
}
```

#### Upvote Question
```http
POST /api/interactive/questions/:questionId/upvote
```

#### Downvote Question
```http
POST /api/interactive/questions/:questionId/downvote
```

#### Answer Question
```http
POST /api/interactive/questions/:questionId/answer
Content-Type: application/json

{
    "answer": "We use message batching and caching for optimal performance.",
    "answeredByName": "Stream Host"
}
```

#### Get Questions
```http
GET /api/interactive/:roomId/questions?status=all&limit=50
```

### Gifts

#### Send Gift
```http
POST /api/interactive/:roomId/gifts
Content-Type: application/json

{
    "giftType": "virtual",
    "giftName": "Rose",
    "giftValue": 100,
    "receiverId": "user-uuid",
    "receiverName": "Stream Host",
    "message": "Thanks for the great stream!",
    "senderName": "Viewer"
}
```

#### Get Gifts
```http
GET /api/interactive/:roomId/gifts?limit=50
```

### Emojis

#### Send Emoji
```http
POST /api/interactive/:roomId/emojis
Content-Type: application/json

{
    "emoji": "❤️",
    "receiverId": "user-uuid",
    "receiverName": "Stream Host",
    "message": "Love this!",
    "isGlobal": false,
    "senderName": "Viewer"
}
```

#### Get Emojis
```http
GET /api/interactive/:roomId/emojis?limit=100
```

## 🔌 WebSocket Events

### Connection
```javascript
// Connect to interactive namespace
const socket = io('/interactive');

// Join room
socket.emit('join-room', {
    roomId: 'room-uuid',
    userId: 'user-uuid',
    userName: 'John Doe'
});
```

### Poll Events

#### Create Poll
```javascript
socket.emit('create-poll', {
    question: 'What do you think?',
    options: ['Option 1', 'Option 2', 'Option 3'],
    isMultipleChoice: false,
    duration: 300
});

// Listen for poll creation
socket.on('poll-created', (poll) => {
    console.log('New poll created:', poll);
});
```

#### Vote on Poll
```javascript
socket.emit('vote-poll', {
    pollId: 'poll-uuid',
    optionId: 'option-uuid'
});

// Listen for vote updates
socket.on('poll-vote-updated', (data) => {
    console.log('Poll results updated:', data.results);
});
```

#### Poll Ended
```javascript
socket.on('poll-ended', (data) => {
    console.log('Poll ended with results:', data.results);
});
```

### Q&A Events

#### Ask Question
```javascript
socket.emit('ask-question', {
    question: 'How do you optimize performance?'
});

// Listen for new questions
socket.on('question-asked', (question) => {
    console.log('New question:', question);
});
```

#### Vote on Question
```javascript
socket.emit('upvote-question', { questionId: 'question-uuid' });
socket.emit('downvote-question', { questionId: 'question-uuid' });

// Listen for question updates
socket.on('question-updated', (data) => {
    console.log('Question updated:', data);
});
```

#### Answer Question
```javascript
socket.emit('answer-question', {
    questionId: 'question-uuid',
    answer: 'Here is the answer...'
});

// Listen for answers
socket.on('question-answered', (data) => {
    console.log('Question answered:', data);
});
```

### Gift Events

#### Send Gift
```javascript
socket.emit('send-gift', {
    giftType: 'virtual',
    giftName: 'Rose',
    giftValue: 100,
    receiverId: 'user-uuid',
    receiverName: 'Stream Host',
    message: 'Thanks!'
});

// Listen for gifts
socket.on('gift-sent', (gift) => {
    console.log('Gift sent:', gift);
});
```

### Emoji Events

#### Send Emoji
```javascript
socket.emit('send-emoji', {
    emoji: '❤️',
    receiverId: 'user-uuid',
    receiverName: 'Stream Host',
    message: 'Love this!',
    isGlobal: false
});

// Listen for emojis
socket.on('emoji-sent', (emoji) => {
    console.log('Emoji sent:', emoji);
});
```

## ⚡ Performance Optimization

### Message Batching
- Messages are batched to reduce network overhead
- Configurable batch sizes based on room activity
- Automatic flushing with configurable intervals

### Rate Limiting
- **Polls**: 1 vote per user per poll
- **Questions**: 10 upvotes/downvotes per minute per question
- **Gifts**: 5 gifts per minute per user
- **Emojis**: 20 emojis per minute per user

### Caching Strategy
- Poll results cached for quick access
- Question updates cached with TTL
- Room statistics cached for 5 minutes
- Interactive messages cached for real-time retrieval

### Throttling
- Poll updates throttled to 1 second intervals
- Q&A updates rate-limited to prevent spam
- Gift and emoji messages rate-limited per user

## 🔧 Configuration

### Environment Variables
```env
# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_TTL=3600

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200

# Performance
BATCH_SIZE=10
FLUSH_INTERVAL_MS=100
```

### Performance Tuning
```javascript
// Adjust batch size based on room activity
performanceOptimizer.adjustBatchSize(roomId, 'high'); // low, medium, high

// Get queue status
const status = performanceOptimizer.getQueueStatus();
console.log('Queue status:', status);
```

## 🛡️ Security & Validation

### Input Validation
- All inputs validated using Joi schemas
- String length limits enforced
- Numeric value ranges validated
- Required fields enforced

### Authentication
- All endpoints require authentication
- User context validated for each request
- Room membership verified

### Rate Limiting
- Per-IP rate limiting on all routes
- Per-user rate limiting for interactive features
- Configurable limits and windows

## 📊 Monitoring

### Performance Metrics
- Message queue status
- Cache hit/miss ratios
- Rate limiting statistics
- Socket connection counts

### Error Handling
- Comprehensive error logging
- Graceful degradation
- Fallback mechanisms
- User-friendly error messages

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Set up Database
```bash
# MongoDB collections will be created automatically
# Ensure MongoDB is running
```

### 3. Set up Redis
```bash
# Install and start Redis
redis-server
```

### 4. Start the Server
```bash
npm run dev
```

### 5. Test Interactive Features
```bash
# Test polls
curl -X POST http://localhost:3000/api/interactive/room-uuid/polls \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"question":"Test poll","options":["Yes","No"]}'

# Test Q&A
curl -X POST http://localhost:3000/api/interactive/room-uuid/questions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"question":"Test question"}'
```

## 🔄 Integration with Frontend

### React/Next.js Example
```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

const useInteractiveFeatures = (roomId, userId, userName) => {
    const [socket, setSocket] = useState(null);
    const [polls, setPolls] = useState([]);
    const [questions, setQuestions] = useState([]);
    const [gifts, setGifts] = useState([]);

    useEffect(() => {
        const newSocket = io('/interactive');
        setSocket(newSocket);

        newSocket.emit('join-room', { roomId, userId, userName });

        newSocket.on('active-polls', setPolls);
        newSocket.on('recent-questions', setQuestions);
        newSocket.on('recent-gifts', setGifts);

        return () => newSocket.close();
    }, [roomId, userId, userName]);

    const createPoll = (pollData) => {
        socket?.emit('create-poll', pollData);
    };

    const votePoll = (pollId, optionId) => {
        socket?.emit('vote-poll', { pollId, optionId });
    };

    const askQuestion = (question) => {
        socket?.emit('ask-question', { question });
    };

    const sendGift = (giftData) => {
        socket?.emit('send-gift', giftData);
    };

    const sendEmoji = (emojiData) => {
        socket?.emit('send-emoji', emojiData);
    };

    return {
        polls,
        questions,
        gifts,
        createPoll,
        votePoll,
        askQuestion,
        sendGift,
        sendEmoji
    };
};
```

## 🎯 Best Practices

### For Smooth Streaming
1. **Use message batching** for high-traffic rooms
2. **Implement client-side throttling** for user interactions
3. **Cache frequently accessed data** on the client
4. **Use WebSocket compression** for large payloads
5. **Monitor performance metrics** regularly

### For Scalability
1. **Use Redis clustering** for high availability
2. **Implement horizontal scaling** for socket servers
3. **Use load balancers** for API endpoints
4. **Monitor resource usage** and scale accordingly
5. **Implement graceful degradation** for peak loads

### For User Experience
1. **Provide immediate feedback** for user actions
2. **Show loading states** for async operations
3. **Handle offline scenarios** gracefully
4. **Implement retry mechanisms** for failed requests
5. **Use optimistic updates** for better responsiveness

## 🐛 Troubleshooting

### Common Issues

#### High Latency
- Check Redis connection and performance
- Monitor message queue sizes
- Adjust batch sizes and flush intervals
- Check network connectivity

#### Memory Leaks
- Monitor socket connections
- Check for unclosed timers
- Verify cleanup routines are running
- Monitor Redis memory usage

#### Rate Limiting Issues
- Check rate limit configuration
- Monitor user activity patterns
- Adjust limits based on usage
- Implement user feedback mechanisms

### Debug Commands
```javascript
// Check queue status
console.log(performanceOptimizer.getQueueStatus());

// Check Redis cache
const cached = await RedisVideoService.getCache('key');

// Monitor socket connections
console.log(io.engine.clientsCount);
```

## 📈 Future Enhancements

### Planned Features
- **Advanced Poll Types**: Image polls, ranking polls
- **Gift Animations**: Custom gift animations and effects
- **Emoji Reactions**: Reaction counters and trends
- **Moderation Tools**: Content filtering and moderation
- **Analytics Dashboard**: Detailed interaction analytics
- **Custom Themes**: Room-specific themes and branding

### Performance Improvements
- **WebRTC Integration**: Direct peer-to-peer for low latency
- **Edge Computing**: CDN integration for global performance
- **Machine Learning**: Smart content recommendations
- **Predictive Caching**: AI-driven cache optimization

---

This interactive features system provides a robust foundation for engaging live streaming experiences while maintaining optimal performance and scalability.
