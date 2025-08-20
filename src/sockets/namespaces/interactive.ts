import { Socket, Server as SocketIOServer } from 'socket.io';
import { IPoll, Poll } from '../../models/Poll';
import { Question } from '../../models/Question';
import { Gift } from '../../models/Gift';
import { Emoji } from '../../models/Emoji';
import { Room } from '../../models/Room';
import { v4 as uuidv4 } from 'uuid';

export default async (io: SocketIOServer) => {
    const interactiveNamespace = io.of('/interactive');
    
    interactiveNamespace.on('connection', (socket: Socket) => {
        console.log('Interactive namespace connected:', socket.id);
        
        // Join room
        socket.on('join-room', async (data: { roomId: string, userId: string, userName: string }) => {
            const { roomId, userId, userName } = data;
            
            // Validate room exists
            const room = await Room.findOne({ roomId, isActive: true });
            if (!room) {
                socket.emit('error', { message: 'Room not found or inactive' });
                return;
            }
            
            socket.join(roomId);
            socket.data.roomId = roomId;
            socket.data.userId = userId;
            socket.data.userName = userName;
            
            console.log(`User ${userName} (${userId}) joined interactive room ${roomId}`);
            
            // Send current active polls
            const activePolls = await Poll.find({
                roomId,
                isActive: true,
                $or: [
                    { expiresAt: { $gt: new Date() } },
                    { expiresAt: null }
                ]
            }).sort({ createdAt: -1 });
            
            socket.emit('active-polls', activePolls.map(poll => ({
                pollId: poll.pollId,
                question: poll.question,
                options: poll.options.map(opt => ({ id: opt.id, text: opt.text })),
                isMultipleChoice: poll.isMultipleChoice,
                expiresAt: poll.expiresAt,
                totalVotes: poll.totalVotes
            })));
            
            // Send recent questions
            const recentQuestions = await Question.find({ roomId })
                .sort({ upvotes: -1, createdAt: -1 })
                .limit(20);
            
            socket.emit('recent-questions', recentQuestions.map(q => ({
                questionId: q.questionId,
                question: q.question,
                askedBy: q.askedBy,
                askedByName: q.askedByName,
                isAnswered: q.isAnswered,
                isHighlighted: q.isHighlighted,
                upvotes: q.upvotes,
                downvotes: q.downvotes,
                score: q.score,
                answer: q.answer,
                answeredBy: q.answeredBy,
                answeredByName: q.answeredByName,
                answeredAt: q.answeredAt,
                createdAt: q.createdAt
            })));
            
            // Send recent gifts
            const recentGifts = await Gift.find({ roomId })
                .sort({ createdAt: -1 })
                .limit(10);
            
            socket.emit('recent-gifts', recentGifts.map(gift => ({
                giftId: gift.giftId,
                giftType: gift.giftType,
                giftName: gift.giftName,
                giftValue: gift.giftValue,
                senderId: gift.senderId,
                senderName: gift.senderName,
                receiverId: gift.receiverId,
                receiverName: gift.receiverName,
                message: gift.message,
                createdAt: gift.createdAt
            })));
        });
        
        // Poll Events
        socket.on('create-poll', async (data: {
            question: string;
            options: string[];
            isMultipleChoice?: boolean;
            duration?: number;
        }) => {
            try {
                const { roomId, userId, userName } = socket.data;
                if (!roomId || !userId) {
                    socket.emit('error', { message: 'Not connected to a room' });
                    return;
                }
                
                const { question, options, isMultipleChoice = false, duration } = data;
                
                // Validate options
                if (!options || options.length < 2 || options.length > 10) {
                    socket.emit('error', { message: 'Poll must have between 2 and 10 options' });
                    return;
                }
                
                const pollId = uuidv4();
                const pollOptions = options.map((text: string) => ({
                    id: uuidv4(),
                    text: text.trim(),
                    votes: 0,
                    voters: []
                }));
                
                const poll = new Poll({
                    pollId,
                    roomId,
                    question: question.trim(),
                    options: pollOptions,
                    createdBy: userId,
                    isMultipleChoice,
                    duration
                });
                
                await poll.save();
                
                // Broadcast to all users in the room
                interactiveNamespace.to(roomId).emit('poll-created', {
                    pollId: poll.pollId,
                    question: poll.question,
                    options: poll.options.map(opt => ({ id: opt.id, text: opt.text })),
                    isMultipleChoice: poll.isMultipleChoice,
                    expiresAt: poll.expiresAt,
                    createdBy: userId,
                    createdByName: userName
                });
                
                // Set expiration timer if duration is provided
                if (duration) {
                    setTimeout(async () => {
                        const updatedPoll = await Poll.findOne({ pollId });
                        if (updatedPoll && updatedPoll.isActive) {
                            updatedPoll.isActive = false;
                            await updatedPoll.save();
                            
                            interactiveNamespace.to(roomId).emit('poll-ended', {
                                pollId: updatedPoll.pollId,
                                results: updatedPoll.getResults()
                            });
                        }
                    }, duration * 1000);
                }
                
            } catch (error) {
                console.error('Error creating poll:', error);
                socket.emit('error', { message: 'Failed to create poll' });
            }
        });
        
        socket.on('vote-poll', async (data: { pollId: string; optionId: string }) => {
            try {
                const { roomId, userId } = socket.data;
                if (!roomId || !userId) {
                    socket.emit('error', { message: 'Not connected to a room' });
                    return;
                }
                
                const { pollId, optionId } = data;
                
                const poll = await Poll.findOne({ pollId, isActive: true });
                if (!poll) {
                    socket.emit('error', { message: 'Poll not found or inactive' });
                    return;
                }
                
                await poll.vote(optionId, userId);
                
                // Broadcast updated results to all users in the room
                interactiveNamespace.to(roomId).emit('poll-vote-updated', {
                    pollId: poll.pollId,
                    results: poll.getResults()
                });
                
            } catch (error) {
                console.error('Error voting on poll:', error);
                socket.emit('error', { message: 'Failed to record vote' });
            }
        });
        
        // Q&A Events
        socket.on('ask-question', async (data: { question: string }) => {
            try {
                const { roomId, userId, userName } = socket.data;
                if (!roomId || !userId || !userName) {
                    socket.emit('error', { message: 'Not connected to a room' });
                    return;
                }
                
                const { question } = data;
                
                const questionId = uuidv4();
                const newQuestion = new Question({
                    questionId,
                    roomId,
                    question: question.trim(),
                    askedBy: userId,
                    askedByName: userName
                });
                
                await newQuestion.save();
                
                // Broadcast to all users in the room
                interactiveNamespace.to(roomId).emit('question-asked', {
                    questionId: newQuestion.questionId,
                    question: newQuestion.question,
                    askedBy: newQuestion.askedBy,
                    askedByName: newQuestion.askedByName,
                    createdAt: newQuestion.createdAt
                });
                
            } catch (error) {
                console.error('Error asking question:', error);
                socket.emit('error', { message: 'Failed to submit question' });
            }
        });
        
        socket.on('upvote-question', async (data: { questionId: string }) => {
            try {
                const { roomId, userId } = socket.data;
                if (!roomId || !userId) {
                    socket.emit('error', { message: 'Not connected to a room' });
                    return;
                }
                
                const { questionId } = data;
                
                const question = await Question.findOne({ questionId });
                if (!question) {
                    socket.emit('error', { message: 'Question not found' });
                    return;
                }
                
                await question.upvote(userId);
                
                // Broadcast updated question to all users in the room
                interactiveNamespace.to(roomId).emit('question-updated', {
                    questionId: question.questionId,
                    upvotes: question.upvotes,
                    downvotes: question.downvotes,
                    score: question.score
                });
                
            } catch (error) {
                console.error('Error upvoting question:', error);
                socket.emit('error', { message: 'Failed to record upvote' });
            }
        });
        
        socket.on('downvote-question', async (data: { questionId: string }) => {
            try {
                const { roomId, userId } = socket.data;
                if (!roomId || !userId) {
                    socket.emit('error', { message: 'Not connected to a room' });
                    return;
                }
                
                const { questionId } = data;
                
                const question = await Question.findOne({ questionId });
                if (!question) {
                    socket.emit('error', { message: 'Question not found' });
                    return;
                }
                
                await question.downvote(userId);
                
                // Broadcast updated question to all users in the room
                interactiveNamespace.to(roomId).emit('question-updated', {
                    questionId: question.questionId,
                    upvotes: question.upvotes,
                    downvotes: question.downvotes,
                    score: question.score
                });
                
            } catch (error) {
                console.error('Error downvoting question:', error);
                socket.emit('error', { message: 'Failed to record downvote' });
            }
        });
        
        socket.on('answer-question', async (data: { questionId: string; answer: string }) => {
            try {
                const { roomId, userId, userName } = socket.data;
                if (!roomId || !userId || !userName) {
                    socket.emit('error', { message: 'Not connected to a room' });
                    return;
                }
                
                const { questionId, answer } = data;
                
                const question = await Question.findOne({ questionId });
                if (!question) {
                    socket.emit('error', { message: 'Question not found' });
                    return;
                }
                
                await question.answerQuestion(answer.trim(), userId, userName);
                
                // Broadcast answer to all users in the room
                interactiveNamespace.to(roomId).emit('question-answered', {
                    questionId: question.questionId,
                    answer: question.answer,
                    answeredBy: question.answeredBy,
                    answeredByName: question.answeredByName,
                    answeredAt: question.answeredAt
                });
                
            } catch (error) {
                console.error('Error answering question:', error);
                socket.emit('error', { message: 'Failed to answer question' });
            }
        });
        
        // Gift Events
        socket.on('send-gift', async (data: {
            giftType: string;
            giftName: string;
            giftValue: number;
            receiverId: string;
            receiverName: string;
            message?: string;
        }) => {
            try {
                const { roomId, userId, userName } = socket.data;
                if (!roomId || !userId || !userName) {
                    socket.emit('error', { message: 'Not connected to a room' });
                    return;
                }
                
                const { giftType, giftName, giftValue, receiverId, receiverName, message } = data;
                
                const giftId = uuidv4();
                const gift = new Gift({
                    giftId,
                    roomId,
                    giftType,
                    giftName,
                    giftValue,
                    senderId: userId,
                    senderName: userName,
                    receiverId,
                    receiverName,
                    message
                });
                
                await gift.save();
                
                // Broadcast gift to all users in the room
                interactiveNamespace.to(roomId).emit('gift-sent', {
                    giftId: gift.giftId,
                    giftType: gift.giftType,
                    giftName: gift.giftName,
                    giftValue: gift.giftValue,
                    senderId: gift.senderId,
                    senderName: gift.senderName,
                    receiverId: gift.receiverId,
                    receiverName: gift.receiverName,
                    message: gift.message,
                    createdAt: gift.createdAt
                });
                
            } catch (error) {
                console.error('Error sending gift:', error);
                socket.emit('error', { message: 'Failed to send gift' });
            }
        });
        
        // Emoji Events
        socket.on('send-emoji', async (data: {
            emoji: string;
            receiverId?: string;
            receiverName?: string;
            message?: string;
            isGlobal?: boolean;
        }) => {
            try {
                const { roomId, userId, userName } = socket.data;
                if (!roomId || !userId || !userName) {
                    socket.emit('error', { message: 'Not connected to a room' });
                    return;
                }
                
                const { emoji, receiverId, receiverName, message, isGlobal = false } = data;
                
                const emojiId = uuidv4();
                const emojiReaction = new Emoji({
                    emojiId,
                    roomId,
                    emoji,
                    senderId: userId,
                    senderName: userName,
                    receiverId,
                    receiverName,
                    message,
                    isGlobal
                });
                
                await emojiReaction.save();
                
                // Broadcast emoji to all users in the room
                interactiveNamespace.to(roomId).emit('emoji-sent', {
                    emojiId: emojiReaction.emojiId,
                    emoji: emojiReaction.emoji,
                    senderId: emojiReaction.senderId,
                    senderName: emojiReaction.senderName,
                    receiverId: emojiReaction.receiverId,
                    receiverName: emojiReaction.receiverName,
                    message: emojiReaction.message,
                    isGlobal: emojiReaction.isGlobal,
                    createdAt: emojiReaction.createdAt
                });
                
            } catch (error) {
                console.error('Error sending emoji:', error);
                socket.emit('error', { message: 'Failed to send emoji' });
            }
        });
        
        // Disconnect
        socket.on('disconnect', () => {
            console.log('Interactive namespace disconnected:', socket.id);
        });
    });
};
