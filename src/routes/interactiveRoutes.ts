import { Router } from 'express';
import InteractiveController from '../controllers/InteractiveController';
import { validateRequest } from '../middleware/joiValidation';
import { authenticate, rateLimit } from '../middleware/auth';
import {
    createPollSchema,
    votePollSchema,
    askQuestionSchema,
    upvoteQuestionSchema,
    downvoteQuestionSchema,
    answerQuestionSchema,
    sendGiftSchema,
    sendEmojiSchema
} from '../validations/interactiveValidation';

const router = Router();

// Apply rate limiting to all interactive routes
router.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200 // limit each IP to 200 requests per windowMs
}));

// Apply authentication to protected routes
router.use(authenticate);

// Poll Routes
/**
 * @route   POST /api/interactive/:roomId/polls
 * @desc    Create a new poll
 * @access  Private
 */
router.post('/:roomId/polls', 
    validateRequest(createPollSchema),
    InteractiveController.createPoll
);

/**
 * @route   POST /api/interactive/polls/:pollId/vote
 * @desc    Vote on a poll
 * @access  Private
 */
router.post('/polls/:pollId/vote', 
    validateRequest(votePollSchema),
    InteractiveController.votePoll
);

/**
 * @route   GET /api/interactive/polls/:pollId/results
 * @desc    Get poll results
 * @access  Private
 */
router.get('/polls/:pollId/results', 
    InteractiveController.getPollResults
);

/**
 * @route   GET /api/interactive/:roomId/polls
 * @desc    Get active polls for a room
 * @access  Private
 */
router.get('/:roomId/polls', 
    InteractiveController.getActivePolls
);

// Q&A Routes
/**
 * @route   POST /api/interactive/:roomId/questions
 * @desc    Ask a question
 * @access  Private
 */
router.post('/:roomId/questions', 
    validateRequest(askQuestionSchema),
    InteractiveController.askQuestion
);

/**
 * @route   POST /api/interactive/questions/:questionId/upvote
 * @desc    Upvote a question
 * @access  Private
 */
router.post('/questions/:questionId/upvote', 
    validateRequest(upvoteQuestionSchema),
    InteractiveController.upvoteQuestion
);

/**
 * @route   POST /api/interactive/questions/:questionId/downvote
 * @desc    Downvote a question
 * @access  Private
 */
router.post('/questions/:questionId/downvote', 
    validateRequest(downvoteQuestionSchema),
    InteractiveController.downvoteQuestion
);

/**
 * @route   POST /api/interactive/questions/:questionId/answer
 * @desc    Answer a question
 * @access  Private
 */
router.post('/questions/:questionId/answer', 
    validateRequest(answerQuestionSchema),
    InteractiveController.answerQuestion
);

/**
 * @route   GET /api/interactive/:roomId/questions
 * @desc    Get questions for a room
 * @access  Private
 */
router.get('/:roomId/questions', 
    InteractiveController.getQuestions
);

// Gift Routes
/**
 * @route   POST /api/interactive/:roomId/gifts
 * @desc    Send a gift
 * @access  Private
 */
router.post('/:roomId/gifts', 
    validateRequest(sendGiftSchema),
    InteractiveController.sendGift
);

/**
 * @route   GET /api/interactive/:roomId/gifts
 * @desc    Get gifts for a room
 * @access  Private
 */
router.get('/:roomId/gifts', 
    InteractiveController.getGifts
);

// Emoji Routes
/**
 * @route   POST /api/interactive/:roomId/emojis
 * @desc    Send an emoji
 * @access  Private
 */
router.post('/:roomId/emojis', 
    validateRequest(sendEmojiSchema),
    InteractiveController.sendEmoji
);

/**
 * @route   GET /api/interactive/:roomId/emojis
 * @desc    Get emojis for a room
 * @access  Private
 */
router.get('/:roomId/emojis', 
    InteractiveController.getEmojis
);

export default router;
