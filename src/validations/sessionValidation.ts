import Joi from 'joi';

// Session creation validation schema
export const createSessionSchema = Joi.object({
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
        title: Joi.string()
            .min(1)
            .max(200)
            .required()
            .messages({
                'string.empty': 'Session title is required',
                'string.min': 'Session title must be at least 1 character long',
                'string.max': 'Session title cannot exceed 200 characters',
                'any.required': 'Session title is required'
            }),
        description: Joi.string()
            .max(1000)
            .optional()
            .messages({
                'string.max': 'Description cannot exceed 1000 characters'
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
        startTime: Joi.date()
            .iso()
            .optional()
            .messages({
                'date.base': 'Start time must be a valid date',
                'date.format': 'Start time must be in ISO format'
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

// Session update validation schema
export const updateSessionSchema = Joi.object({
    params: Joi.object({
        sessionId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Session ID is required',
                'string.min': 'Session ID must be at least 3 characters long',
                'string.max': 'Session ID cannot exceed 50 characters',
                'any.required': 'Session ID is required'
            })
    }),
    body: Joi.object({
        title: Joi.string()
            .min(1)
            .max(200)
            .optional()
            .messages({
                'string.empty': 'Session title cannot be empty',
                'string.min': 'Session title must be at least 1 character long',
                'string.max': 'Session title cannot exceed 200 characters'
            }),
        description: Joi.string()
            .max(1000)
            .optional()
            .messages({
                'string.max': 'Description cannot exceed 1000 characters'
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
        status: Joi.string()
            .valid('scheduled', 'active', 'ended', 'cancelled')
            .optional()
            .messages({
                'any.only': 'Status must be one of: scheduled, active, ended, cancelled'
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

// Session ID validation schema
export const sessionIdSchema = Joi.object({
    params: Joi.object({
        sessionId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Session ID is required',
                'string.min': 'Session ID must be at least 3 characters long',
                'string.max': 'Session ID cannot exceed 50 characters',
                'any.required': 'Session ID is required'
            })
    })
});

// Session query validation schema
export const sessionQuerySchema = Joi.object({
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
    query: Joi.object({
        status: Joi.string()
            .valid('scheduled', 'active', 'ended', 'cancelled')
            .optional()
            .messages({
                'any.only': 'Status must be one of: scheduled, active, ended, cancelled'
            }),
        isRecording: Joi.boolean()
            .optional()
            .messages({
                'boolean.base': 'isRecording must be a boolean'
            }),
        startDate: Joi.date()
            .iso()
            .optional()
            .messages({
                'date.base': 'Start date must be a valid date',
                'date.format': 'Start date must be in ISO format'
            }),
        endDate: Joi.date()
            .iso()
            .optional()
            .messages({
                'date.base': 'End date must be a valid date',
                'date.format': 'End date must be in ISO format'
            }),
        sortBy: Joi.string()
            .valid('startTime', 'endTime', 'createdAt', 'title')
            .default('startTime')
            .messages({
                'any.only': 'Sort by must be one of: startTime, endTime, createdAt, title'
            }),
        sortOrder: Joi.string()
            .valid('asc', 'desc')
            .default('desc')
            .messages({
                'any.only': 'Sort order must be either "asc" or "desc"'
            }),
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
            })
    })
});

// Session start validation schema
export const startSessionSchema = Joi.object({
    params: Joi.object({
        sessionId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Session ID is required',
                'string.min': 'Session ID must be at least 3 characters long',
                'string.max': 'Session ID cannot exceed 50 characters',
                'any.required': 'Session ID is required'
            })
    })
});

// Session end validation schema
export const endSessionSchema = Joi.object({
    params: Joi.object({
        sessionId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Session ID is required',
                'string.min': 'Session ID must be at least 3 characters long',
                'string.max': 'Session ID cannot exceed 50 characters',
                'any.required': 'Session ID is required'
            })
    }),
    body: Joi.object({
        endTime: Joi.date()
            .iso()
            .optional()
            .messages({
                'date.base': 'End time must be a valid date',
                'date.format': 'End time must be in ISO format'
            }),
        recordingUrl: Joi.string()
            .uri()
            .optional()
            .messages({
                'string.uri': 'Recording URL must be a valid URI'
            })
    })
});

// Session recording validation schema
export const sessionRecordingSchema = Joi.object({
    params: Joi.object({
        sessionId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Session ID is required',
                'string.min': 'Session ID must be at least 3 characters long',
                'string.max': 'Session ID cannot exceed 50 characters',
                'any.required': 'Session ID is required'
            })
    }),
    body: Joi.object({
        action: Joi.string()
            .valid('start', 'stop')
            .required()
            .messages({
                'any.only': 'Action must be either "start" or "stop"',
                'any.required': 'Action is required'
            }),
        recordingUrl: Joi.string()
            .uri()
            .optional()
            .messages({
                'string.uri': 'Recording URL must be a valid URI'
            })
    })
});

// Session participant count update validation schema
export const sessionParticipantCountSchema = Joi.object({
    params: Joi.object({
        sessionId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Session ID is required',
                'string.min': 'Session ID must be at least 3 characters long',
                'string.max': 'Session ID cannot exceed 50 characters',
                'any.required': 'Session ID is required'
            })
    }),
    body: Joi.object({
        participantCount: Joi.number()
            .integer()
            .min(0)
            .required()
            .messages({
                'number.base': 'Participant count must be a number',
                'number.integer': 'Participant count must be an integer',
                'number.min': 'Participant count cannot be negative',
                'any.required': 'Participant count is required'
            })
    })
});

export default {
    createSessionSchema,
    updateSessionSchema,
    sessionIdSchema,
    sessionQuerySchema,
    startSessionSchema,
    endSessionSchema,
    sessionRecordingSchema,
    sessionParticipantCountSchema
};
