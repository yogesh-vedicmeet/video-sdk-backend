import Joi from 'joi';

// Participant creation validation schema
export const createParticipantSchema = Joi.object({
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
        identity: Joi.string()
            .min(1)
            .max(100)
            .required()
            .messages({
                'string.empty': 'Identity is required',
                'string.min': 'Identity must be at least 1 character long',
                'string.max': 'Identity cannot exceed 100 characters',
                'any.required': 'Identity is required'
            }),
        name: Joi.string()
            .min(1)
            .max(100)
            .required()
            .messages({
                'string.empty': 'Name is required',
                'string.min': 'Name must be at least 1 character long',
                'string.max': 'Name cannot exceed 100 characters',
                'any.required': 'Name is required'
            }),
        email: Joi.string()
            .email()
            .optional()
            .messages({
                'string.email': 'Please provide a valid email address'
            }),
        role: Joi.string()
            .valid('host', 'moderator', 'participant', 'viewer')
            .default('participant')
            .messages({
                'any.only': 'Role must be one of: host, moderator, participant, viewer'
            }),
        metadata: Joi.object().optional()
    })
});

// Participant update validation schema
export const updateParticipantSchema = Joi.object({
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
            }),
        participantId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Participant ID is required',
                'string.min': 'Participant ID must be at least 3 characters long',
                'string.max': 'Participant ID cannot exceed 50 characters',
                'any.required': 'Participant ID is required'
            })
    }),
    body: Joi.object({
        name: Joi.string()
            .min(1)
            .max(100)
            .optional()
            .messages({
                'string.empty': 'Name cannot be empty',
                'string.min': 'Name must be at least 1 character long',
                'string.max': 'Name cannot exceed 100 characters'
            }),
        email: Joi.string()
            .email()
            .optional()
            .messages({
                'string.email': 'Please provide a valid email address'
            }),
        role: Joi.string()
            .valid('host', 'moderator', 'participant', 'viewer')
            .optional()
            .messages({
                'any.only': 'Role must be one of: host, moderator, participant, viewer'
            }),
        isMuted: Joi.boolean().optional(),
        isVideoEnabled: Joi.boolean().optional(),
        isScreenSharing: Joi.boolean().optional(),
        metadata: Joi.object().optional()
    })
});

// Participant ID validation schema
export const participantIdSchema = Joi.object({
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
            }),
        participantId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Participant ID is required',
                'string.min': 'Participant ID must be at least 3 characters long',
                'string.max': 'Participant ID cannot exceed 50 characters',
                'any.required': 'Participant ID is required'
            })
    })
});

// Participant query validation schema
export const participantQuerySchema = Joi.object({
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
        role: Joi.string()
            .valid('host', 'moderator', 'participant', 'viewer')
            .optional()
            .messages({
                'any.only': 'Role must be one of: host, moderator, participant, viewer'
            }),
        isOnline: Joi.boolean()
            .optional()
            .messages({
                'boolean.base': 'isOnline must be a boolean'
            }),
        isMuted: Joi.boolean()
            .optional()
            .messages({
                'boolean.base': 'isMuted must be a boolean'
            }),
        isVideoEnabled: Joi.boolean()
            .optional()
            .messages({
                'boolean.base': 'isVideoEnabled must be a boolean'
            }),
        sortBy: Joi.string()
            .valid('joinedAt', 'name', 'role', 'lastActivityAt')
            .default('joinedAt')
            .messages({
                'any.only': 'Sort by must be one of: joinedAt, name, role, lastActivityAt'
            }),
        sortOrder: Joi.string()
            .valid('asc', 'desc')
            .default('asc')
            .messages({
                'any.only': 'Sort order must be either "asc" or "desc"'
            })
    })
});

// Participant mute/unmute validation schema
export const participantMuteSchema = Joi.object({
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
            }),
        participantId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Participant ID is required',
                'string.min': 'Participant ID must be at least 3 characters long',
                'string.max': 'Participant ID cannot exceed 50 characters',
                'any.required': 'Participant ID is required'
            })
    }),
    body: Joi.object({
        isMuted: Joi.boolean()
            .required()
            .messages({
                'boolean.base': 'isMuted must be a boolean',
                'any.required': 'isMuted is required'
            })
    })
});

// Participant video enable/disable validation schema
export const participantVideoSchema = Joi.object({
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
            }),
        participantId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Participant ID is required',
                'string.min': 'Participant ID must be at least 3 characters long',
                'string.max': 'Participant ID cannot exceed 50 characters',
                'any.required': 'Participant ID is required'
            })
    }),
    body: Joi.object({
        isVideoEnabled: Joi.boolean()
            .required()
            .messages({
                'boolean.base': 'isVideoEnabled must be a boolean',
                'any.required': 'isVideoEnabled is required'
            })
    })
});

// Participant role change validation schema
export const participantRoleSchema = Joi.object({
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
            }),
        participantId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Participant ID is required',
                'string.min': 'Participant ID must be at least 3 characters long',
                'string.max': 'Participant ID cannot exceed 50 characters',
                'any.required': 'Participant ID is required'
            })
    }),
    body: Joi.object({
        role: Joi.string()
            .valid('host', 'moderator', 'participant', 'viewer')
            .required()
            .messages({
                'any.only': 'Role must be one of: host, moderator, participant, viewer',
                'any.required': 'Role is required'
            })
    })
});

export default {
    createParticipantSchema,
    updateParticipantSchema,
    participantIdSchema,
    participantQuerySchema,
    participantMuteSchema,
    participantVideoSchema,
    participantRoleSchema
};
