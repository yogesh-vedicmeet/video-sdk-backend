import Joi from 'joi';

// Room creation validation schema
export const createRoomSchema = Joi.object({
    body: Joi.object({
        name: Joi.string()
            .min(1)
            .max(100)
            .required()
            .messages({
                'string.empty': 'Room name is required',
                'string.min': 'Room name must be at least 1 character long',
                'string.max': 'Room name cannot exceed 100 characters',
                'any.required': 'Room name is required'
            }),
        description: Joi.string()
            .max(500)
            .optional()
            .messages({
                'string.max': 'Description cannot exceed 500 characters'
            }),
        maxParticipants: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(20)
            .messages({
                'number.base': 'Max participants must be a number',
                'number.integer': 'Max participants must be an integer',
                'number.min': 'Max participants must be at least 1',
                'number.max': 'Max participants cannot exceed 100'
            }),
        settings: Joi.object({
            recordingEnabled: Joi.boolean().default(true),
            chatEnabled: Joi.boolean().default(true),
            screenShareEnabled: Joi.boolean().default(true),
            waitingRoomEnabled: Joi.boolean().default(false),
            moderatorApprovalRequired: Joi.boolean().default(false)
        }).optional(),
        metadata: Joi.object().optional()
    })
});

// Room update validation schema
export const updateRoomSchema = Joi.object({
    params: Joi.object({
        roomId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Room ID is required',
                'string.min': 'Room ID must be at least 3 characters long',
                'string.max': 'Room ID cannot exceed 50 characters',
                'any.required': 'Room ID is required'
            })
    }),
    body: Joi.object({
        name: Joi.string()
            .min(1)
            .max(100)
            .optional()
            .messages({
                'string.empty': 'Room name cannot be empty',
                'string.min': 'Room name must be at least 1 character long',
                'string.max': 'Room name cannot exceed 100 characters'
            }),
        description: Joi.string()
            .max(500)
            .optional()
            .messages({
                'string.max': 'Description cannot exceed 500 characters'
            }),
        maxParticipants: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .optional()
            .messages({
                'number.base': 'Max participants must be a number',
                'number.integer': 'Max participants must be an integer',
                'number.min': 'Max participants must be at least 1',
                'number.max': 'Max participants cannot exceed 100'
            }),
        settings: Joi.object({
            recordingEnabled: Joi.boolean(),
            chatEnabled: Joi.boolean(),
            screenShareEnabled: Joi.boolean(),
            waitingRoomEnabled: Joi.boolean(),
            moderatorApprovalRequired: Joi.boolean()
        }).optional(),
        metadata: Joi.object().optional()
    })
});

// Room ID validation schema
export const roomIdSchema = Joi.object({
    params: Joi.object({
        roomId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Room ID is required',
                'string.min': 'Room ID must be at least 3 characters long',
                'string.max': 'Room ID cannot exceed 50 characters',
                'any.required': 'Room ID is required'
            })
    })
});

// Room query validation schema
export const roomQuerySchema = Joi.object({
    query: Joi.object({
        page: Joi.number()
            .integer()
            .min(1)
            .default(1)
            .messages({
                'number.base': 'Page must be a number',
                'number.integer': 'Page must be an integer',
                'number.min': 'Page must be at least 1'
            }),
        limit: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(10)
            .messages({
                'number.base': 'Limit must be a number',
                'number.integer': 'Limit must be an integer',
                'number.min': 'Limit must be at least 1',
                'number.max': 'Limit cannot exceed 100'
            }),
        status: Joi.string()
            .valid('active', 'inactive')
            .optional()
            .messages({
                'any.only': 'Status must be either "active" or "inactive"'
            }),
        createdBy: Joi.string()
            .optional()
            .messages({
                'string.base': 'Created by must be a string'
            }),
        search: Joi.string()
            .max(100)
            .optional()
            .messages({
                'string.max': 'Search term cannot exceed 100 characters'
            }),
        sortBy: Joi.string()
            .valid('createdAt', 'name', 'lastActivityAt')
            .default('createdAt')
            .messages({
                'any.only': 'Sort by must be one of: createdAt, name, lastActivityAt'
            }),
        sortOrder: Joi.string()
            .valid('asc', 'desc')
            .default('desc')
            .messages({
                'any.only': 'Sort order must be either "asc" or "desc"'
            })
    })
});

// Token generation validation schema
export const generateTokenSchema = Joi.object({
    params: Joi.object({
        roomId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Room ID is required',
                'string.min': 'Room ID must be at least 3 characters long',
                'string.max': 'Room ID cannot exceed 50 characters',
                'any.required': 'Room ID is required'
            })
    }),
    body: Joi.object({
        // identity: Joi.string()
        //     .min(1)
        //     .max(100)
        //     .required()
        //     .messages({
        //         'string.empty': 'Identity is required',
        //         'string.min': 'Identity must be at least 1 character long',
        //         'string.max': 'Identity cannot exceed 100 characters',
        //         'any.required': 'Identity is required'
        //     }),
        // name: Joi.string()
        //     .min(1)
        //     .max(100)
        //     .required()
        //     .messages({
        //         'string.empty': 'Name is required',
        //         'string.min': 'Name must be at least 1 character long',
        //         'string.max': 'Name cannot exceed 100 characters',
        //         'any.required': 'Name is required'
        //     }),
        // email: Joi.string()
        //     .email()
        //     .optional()
        //     .messages({
        //         'string.email': 'Please provide a valid email address'
        //     }),
        // role: Joi.string()
        //     .valid('host', 'moderator', 'participant', 'viewer')
        //     .default('participant')
        //     .messages({
        //         'any.only': 'Role must be one of: host, moderator, participant, viewer'
        //     })
    })
});

// Room statistics validation schema
export const roomStatsSchema = Joi.object({
    params: Joi.object({
        roomId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Room ID is required',
                'string.min': 'Room ID must be at least 3 characters long',
                'string.max': 'Room ID cannot exceed 50 characters',
                'any.required': 'Room ID is required'
            })
    })
});

export default {
    createRoomSchema,
    updateRoomSchema,
    roomIdSchema,
    roomQuerySchema,
    generateTokenSchema,
    roomStatsSchema
};
