import Joi from 'joi';

// Poll Validation Schemas
export const createPollSchema = Joi.object({
    question: Joi.string().required().min(1).max(500).messages({
        'string.empty': 'Question cannot be empty',
        'string.max': 'Question cannot exceed 500 characters'
    }),
    options: Joi.array().items(
        Joi.string().min(1).max(200)
    ).min(2).max(10).required().messages({
        'array.min': 'Poll must have at least 2 options',
        'array.max': 'Poll cannot have more than 10 options',
        'any.required': 'Poll options are required'
    }),
    isMultipleChoice: Joi.boolean().default(false),
    duration: Joi.number().integer().min(30).max(3600).optional().messages({
        'number.min': 'Duration must be at least 30 seconds',
        'number.max': 'Duration cannot exceed 1 hour'
    })
});

export const votePollSchema = Joi.object({
    optionId: Joi.string().required().messages({
        'any.required': 'Option ID is required'
    })
});

// Q&A Validation Schemas
export const askQuestionSchema = Joi.object({
    question: Joi.string().required().min(1).max(1000).messages({
        'string.empty': 'Question cannot be empty',
        'string.max': 'Question cannot exceed 1000 characters'
    }),
    askedByName: Joi.string().optional().max(100)
});

export const upvoteQuestionSchema = Joi.object({});

export const downvoteQuestionSchema = Joi.object({});

export const answerQuestionSchema = Joi.object({
    answer: Joi.string().required().min(1).max(2000).messages({
        'string.empty': 'Answer cannot be empty',
        'string.max': 'Answer cannot exceed 2000 characters'
    }),
    answeredByName: Joi.string().optional().max(100)
});

// Gift Validation Schemas
export const sendGiftSchema = Joi.object({
    giftType: Joi.string().required().max(50).messages({
        'any.required': 'Gift type is required',
        'string.max': 'Gift type cannot exceed 50 characters'
    }),
    giftName: Joi.string().required().max(100).messages({
        'any.required': 'Gift name is required',
        'string.max': 'Gift name cannot exceed 100 characters'
    }),
    giftValue: Joi.number().required().min(0).max(10000).messages({
        'any.required': 'Gift value is required',
        'number.min': 'Gift value cannot be negative',
        'number.max': 'Gift value cannot exceed 10000'
    }),
    receiverId: Joi.string().required().messages({
        'any.required': 'Receiver ID is required'
    }),
    receiverName: Joi.string().required().max(100).messages({
        'any.required': 'Receiver name is required',
        'string.max': 'Receiver name cannot exceed 100 characters'
    }),
    message: Joi.string().optional().max(200).messages({
        'string.max': 'Message cannot exceed 200 characters'
    }),
    senderName: Joi.string().optional().max(100)
});

// Emoji Validation Schemas
export const sendEmojiSchema = Joi.object({
    emoji: Joi.string().required().max(10).messages({
        'any.required': 'Emoji is required',
        'string.max': 'Emoji cannot exceed 10 characters'
    }),
    receiverId: Joi.string().optional(),
    receiverName: Joi.string().optional().max(100),
    message: Joi.string().optional().max(100).messages({
        'string.max': 'Message cannot exceed 100 characters'
    }),
    isGlobal: Joi.boolean().default(false),
    senderName: Joi.string().optional().max(100)
});
