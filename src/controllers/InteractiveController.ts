import { Request, Response } from 'express';

// Extend Express Request interface to include user
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        [key: string]: any;
    };
}
import { Poll, IPoll } from '../models/Poll';
import { Question, IQuestion } from '../models/Question';
import { Gift, IGift } from '../models/Gift';
import { Emoji, IEmoji } from '../models/Emoji';
import { Room } from '../models/Room';
import { v4 as uuidv4 } from 'uuid';

export class InteractiveController {
    
    // Poll Methods
    static async createPoll(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { roomId, question, options, isMultipleChoice = false, duration } = req.body;
            const createdBy = req.user?.id;

            if (!createdBy) {
                res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
                return;
            }

            // Validate room exists
            const room = await Room.findOne({ roomId, isActive: true });
            if (!room) {
                res.status(404).json({
                    success: false,
                    message: 'Room not found or inactive'
                });
                return;
            }

            // Validate options
            if (!options || options.length < 2 || options.length > 10) {
                res.status(400).json({
                    success: false,
                    message: 'Poll must have between 2 and 10 options'
                });
                return;
            }

            const pollId = uuidv4();
            const pollOptions = options.map((text: string, index: number) => ({
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
                createdBy,
                isMultipleChoice,
                duration
            });

            await poll.save();

            res.status(201).json({
                success: true,
                message: 'Poll created successfully',
                data: {
                    pollId: poll.pollId,
                    question: poll.question,
                    options: poll.options.map(opt => ({ id: opt.id, text: opt.text })),
                    isMultipleChoice: poll.isMultipleChoice,
                    duration: poll.duration,
                    expiresAt: poll.expiresAt
                }
            });

        } catch (error) {
            console.error('❌ Error creating poll:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create poll',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    static async votePoll(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { pollId } = req.params;
            const { optionId } = req.body;
            const voterId = req.user?.id;

            if (!voterId) {
                res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
                return;
            }

            const poll = await Poll.findOne({ pollId, isActive: true });
            if (!poll) {
                res.status(404).json({
                    success: false,
                    message: 'Poll not found or inactive'
                });
                return;
            }

            await poll.vote(optionId, voterId);

            res.json({
                success: true,
                message: 'Vote recorded successfully',
                data: poll.getResults()
            });

        } catch (error) {
            console.error('❌ Error voting on poll:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to record vote',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    static async getPollResults(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { pollId } = req.params;

            const poll = await Poll.findOne({ pollId });
            if (!poll) {
                res.status(404).json({
                    success: false,
                    message: 'Poll not found'
                });
                return;
            }

            res.json({
                success: true,
                data: poll.getResults()
            });

        } catch (error) {
            console.error('❌ Error fetching poll results:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch poll results',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    static async getActivePolls(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { roomId } = req.params;

            const polls = await Poll.find({
                roomId,
                isActive: true,
                $or: [
                    { expiresAt: { $gt: new Date() } },
                    { expiresAt: null }
                ]
            }).sort({ createdAt: -1 });

            res.json({
                success: true,
                data: polls.map(poll => ({
                    pollId: poll.pollId,
                    question: poll.question,
                    options: poll.options.map(opt => ({ id: opt.id, text: opt.text })),
                    isMultipleChoice: poll.isMultipleChoice,
                    expiresAt: poll.expiresAt,
                    totalVotes: poll.totalVotes
                }))
            });

        } catch (error) {
            console.error('❌ Error fetching active polls:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch active polls',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Q&A Methods
    static async askQuestion(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { roomId } = req.params;
            const { question } = req.body;
            const askedBy = req.user?.id;
            const askedByName = req.user?.name || req.body.askedByName;

            if (!askedBy || !askedByName) {
                res.status(400).json({
                    success: false,
                    message: 'User ID and name are required'
                });
                return;
            }

            // Validate room exists
            const room = await Room.findOne({ roomId, isActive: true });
            if (!room) {
                res.status(404).json({
                    success: false,
                    message: 'Room not found or inactive'
                });
                return;
            }

            const questionId = uuidv4();
            const newQuestion = new Question({
                questionId,
                roomId,
                question: question.trim(),
                askedBy,
                askedByName
            });

            await newQuestion.save();

            res.status(201).json({
                success: true,
                message: 'Question submitted successfully',
                data: {
                    questionId: newQuestion.questionId,
                    question: newQuestion.question,
                    askedBy: newQuestion.askedBy,
                    askedByName: newQuestion.askedByName,
                    createdAt: newQuestion.createdAt
                }
            });

        } catch (error) {
            console.error('❌ Error asking question:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to submit question',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    static async upvoteQuestion(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { questionId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
                return;
            }

            const question = await Question.findOne({ questionId });
            if (!question) {
                res.status(404).json({
                    success: false,
                    message: 'Question not found'
                });
                return;
            }

            await question.upvote(userId);

            res.json({
                success: true,
                message: 'Upvote recorded successfully',
                data: {
                    questionId: question.questionId,
                    upvotes: question.upvotes,
                    downvotes: question.downvotes,
                    score: question.score
                }
            });

        } catch (error) {
            console.error('❌ Error upvoting question:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to record upvote',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    static async downvoteQuestion(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { questionId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                res.status(400).json({
                    success: false,
                    message: 'User ID is required'
                });
                return;
            }

            const question = await Question.findOne({ questionId });
            if (!question) {
                res.status(404).json({
                    success: false,
                    message: 'Question not found'
                });
                return;
            }

            await question.downvote(userId);

            res.json({
                success: true,
                message: 'Downvote recorded successfully',
                data: {
                    questionId: question.questionId,
                    upvotes: question.upvotes,
                    downvotes: question.downvotes,
                    score: question.score
                }
            });

        } catch (error) {
            console.error('❌ Error downvoting question:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to record downvote',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    static async answerQuestion(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { questionId } = req.params;
            const { answer } = req.body;
            const answeredBy = req.user?.id;
            const answeredByName = req.user?.name || req.body.answeredByName;

            if (!answeredBy || !answeredByName) {
                res.status(400).json({
                    success: false,
                    message: 'User ID and name are required'
                });
                return;
            }

            const question = await Question.findOne({ questionId });
            if (!question) {
                res.status(404).json({
                    success: false,
                    message: 'Question not found'
                });
                return;
            }

            await question.answerQuestion(answer.trim(), answeredBy, answeredByName);

            res.json({
                success: true,
                message: 'Question answered successfully',
                data: {
                    questionId: question.questionId,
                    answer: question.answer,
                    answeredBy: question.answeredBy,
                    answeredByName: question.answeredByName,
                    answeredAt: question.answeredAt
                }
            });

        } catch (error) {
            console.error('❌ Error answering question:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to answer question',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    static async getQuestions(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { roomId } = req.params;
            const { status = 'all', limit = 50 } = req.query;

            let filter: any = { roomId };
            
            if (status === 'answered') {
                filter.isAnswered = true;
            } else if (status === 'pending') {
                filter.isAnswered = false;
            } else if (status === 'highlighted') {
                filter.isHighlighted = true;
            }

            const questions = await Question.find(filter)
                .sort({ upvotes: -1, createdAt: -1 })
                .limit(parseInt(limit as string));

            res.json({
                success: true,
                data: questions.map(q => ({
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
                }))
            });

        } catch (error) {
            console.error('❌ Error fetching questions:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch questions',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Gift Methods
    static async sendGift(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { roomId } = req.params;
            const { giftType, giftName, giftValue, receiverId, receiverName, message } = req.body;
            const senderId = req.user?.id;
            const senderName = req.user?.name || req.body.senderName;

            if (!senderId || !senderName) {
                res.status(400).json({
                    success: false,
                    message: 'User ID and name are required'
                });
                return;
            }

            // Validate room exists
            const room = await Room.findOne({ roomId, isActive: true });
            if (!room) {
                res.status(404).json({
                    success: false,
                    message: 'Room not found or inactive'
                });
                return;
            }

            const giftId = uuidv4();
            const gift = new Gift({
                giftId,
                roomId,
                giftType,
                giftName,
                giftValue,
                senderId,
                senderName,
                receiverId,
                receiverName,
                message
            });

            await gift.save();

            res.status(201).json({
                success: true,
                message: 'Gift sent successfully',
                data: {
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
                }
            });

        } catch (error) {
            console.error('❌ Error sending gift:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send gift',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    static async getGifts(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { roomId } = req.params;
            const { limit = 50 } = req.query;

            const gifts = await Gift.find({ roomId })
                .sort({ createdAt: -1 })
                .limit(parseInt(limit as string));

            res.json({
                success: true,
                data: gifts.map(gift => ({
                    giftId: gift.giftId,
                    giftType: gift.giftType,
                    giftName: gift.giftName,
                    giftValue: gift.giftValue,
                    senderId: gift.senderId,
                    senderName: gift.senderName,
                    receiverId: gift.receiverId,
                    receiverName: gift.receiverName,
                    message: gift.message,
                    isProcessed: gift.isProcessed,
                    createdAt: gift.createdAt
                }))
            });

        } catch (error) {
            console.error('❌ Error fetching gifts:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch gifts',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    // Emoji Methods
    static async sendEmoji(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { roomId } = req.params;
            const { emoji, receiverId, receiverName, message, isGlobal = false } = req.body;
            const senderId = req.user?.id;
            const senderName = req.user?.name || req.body.senderName;

            if (!senderId || !senderName) {
                res.status(400).json({
                    success: false,
                    message: 'User ID and name are required'
                });
                return;
            }

            // Validate room exists
            const room = await Room.findOne({ roomId, isActive: true });
            if (!room) {
                res.status(404).json({
                    success: false,
                    message: 'Room not found or inactive'
                });
                return;
            }

            const emojiId = uuidv4();
            const emojiReaction = new Emoji({
                emojiId,
                roomId,
                emoji,
                senderId,
                senderName,
                receiverId,
                receiverName,
                message,
                isGlobal
            });

            await emojiReaction.save();

            res.status(201).json({
                success: true,
                message: 'Emoji sent successfully',
                data: {
                    emojiId: emojiReaction.emojiId,
                    emoji: emojiReaction.emoji,
                    senderId: emojiReaction.senderId,
                    senderName: emojiReaction.senderName,
                    receiverId: emojiReaction.receiverId,
                    receiverName: emojiReaction.receiverName,
                    message: emojiReaction.message,
                    isGlobal: emojiReaction.isGlobal,
                    createdAt: emojiReaction.createdAt
                }
            });

        } catch (error) {
            console.error('❌ Error sending emoji:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send emoji',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    static async getEmojis(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { roomId } = req.params;
            const { limit = 100 } = req.query;

            const emojis = await Emoji.find({ roomId })
                .sort({ createdAt: -1 })
                .limit(parseInt(limit as string));

            res.json({
                success: true,
                data: emojis.map(emoji => ({
                    emojiId: emoji.emojiId,
                    emoji: emoji.emoji,
                    senderId: emoji.senderId,
                    senderName: emoji.senderName,
                    receiverId: emoji.receiverId,
                    receiverName: emoji.receiverName,
                    message: emoji.message,
                    isGlobal: emoji.isGlobal,
                    createdAt: emoji.createdAt
                }))
            });

        } catch (error) {
            console.error('❌ Error fetching emojis:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch emojis',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}

export default InteractiveController;
