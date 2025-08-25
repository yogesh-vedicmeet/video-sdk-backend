import Joi from 'joi';

export const chatValidation = {
  sendSystemMessage: Joi.object({
    message: Joi.string().required().min(1).max(500).messages({
      'string.empty': 'Message cannot be empty',
      'string.min': 'Message must be at least 1 character long',
      'string.max': 'Message cannot exceed 500 characters'
    }),
    senderName: Joi.string().optional().max(50).messages({
      'string.max': 'Sender name cannot exceed 50 characters'
    })
  }),

  joinChat: Joi.object({
    roomId: Joi.string().required().messages({
      'string.empty': 'Room ID is required'
    }),
    eventId: Joi.string().optional(),
    userId: Joi.string().required().messages({
      'string.empty': 'User ID is required'
    }),
    userName: Joi.string().required().min(1).max(50).messages({
      'string.empty': 'User name is required',
      'string.min': 'User name must be at least 1 character long',
      'string.max': 'User name cannot exceed 50 characters'
    }),
    userRole: Joi.string().valid('moderator', 'participant', 'host').required().messages({
      'any.only': 'User role must be moderator, participant, or host'
    })
  }),

  sendMessage: Joi.object({
    roomId: Joi.string().required().messages({
      'string.empty': 'Room ID is required'
    }),
    eventId: Joi.string().optional(),
    message: Joi.string().required().min(1).max(1000).messages({
      'string.empty': 'Message cannot be empty',
      'string.min': 'Message must be at least 1 character long',
      'string.max': 'Message cannot exceed 1000 characters'
    }),
    messageType: Joi.string().valid('text', 'system', 'emoji', 'gift').default('text').messages({
      'any.only': 'Message type must be text, system, emoji, or gift'
    }),
    replyTo: Joi.string().optional()
  }),

  reactToMessage: Joi.object({
    messageId: Joi.string().required().messages({
      'string.empty': 'Message ID is required'
    }),
    reaction: Joi.string().required().min(1).max(10).messages({
      'string.empty': 'Reaction cannot be empty',
      'string.min': 'Reaction must be at least 1 character long',
      'string.max': 'Reaction cannot exceed 10 characters'
    }),
    roomId: Joi.string().required().messages({
      'string.empty': 'Room ID is required'
    })
  }),

  deleteMessage: Joi.object({
    messageId: Joi.string().required().messages({
      'string.empty': 'Message ID is required'
    }),
    roomId: Joi.string().required().messages({
      'string.empty': 'Room ID is required'
    })
  }),

  leaveChat: Joi.object({
    roomId: Joi.string().required().messages({
      'string.empty': 'Room ID is required'
    }),
    eventId: Joi.string().optional()
  }),

  typing: Joi.object({
    roomId: Joi.string().required().messages({
      'string.empty': 'Room ID is required'
    }),
    isTyping: Joi.boolean().required().messages({
      'boolean.base': 'isTyping must be a boolean'
    })
  })
};
