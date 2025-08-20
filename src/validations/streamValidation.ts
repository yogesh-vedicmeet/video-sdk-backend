import Joi from 'joi';

// Stream creation validation schema
export const createStreamSchema = Joi.object({
    body: Joi.object({
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
        title: Joi.string()
            .min(1)
            .max(200)
            .required()
            .messages({
                'string.empty': 'Stream title is required',
                'string.min': 'Stream title must be at least 1 character long',
                'string.max': 'Stream title cannot exceed 200 characters',
                'any.required': 'Stream title is required'
            }),
        description: Joi.string()
            .max(1000)
            .optional()
            .messages({
                'string.max': 'Description cannot exceed 1000 characters'
            }),
        quality: Joi.string()
            .valid('low', 'medium', 'high', 'ultra')
            .default('medium')
            .messages({
                'any.only': 'Quality must be one of: low, medium, high, ultra'
            }),
        maxViewers: Joi.number()
            .integer()
            .min(1)
            .max(10000)
            .default(1000)
            .messages({
                'number.base': 'Max viewers must be a number',
                'number.integer': 'Max viewers must be an integer',
                'number.min': 'Max viewers must be at least 1',
                'number.max': 'Max viewers cannot exceed 10000'
            }),
        settings: Joi.object({
            enableChat: Joi.boolean().default(true),
            enableScreenShare: Joi.boolean().default(true),
            enableRecording: Joi.boolean().default(true),
            enableModeration: Joi.boolean().default(false),
            allowViewerInteraction: Joi.boolean().default(true),
            autoRecord: Joi.boolean().default(false),
            streamDelay: Joi.number()
                .min(0)
                .max(30)
                .default(2)
                .messages({
                    'number.base': 'Stream delay must be a number',
                    'number.min': 'Stream delay cannot be negative',
                    'number.max': 'Stream delay cannot exceed 30 seconds'
                }),
            maxBitrate: Joi.number()
                .min(100)
                .max(10000)
                .optional()
                .messages({
                    'number.base': 'Max bitrate must be a number',
                    'number.min': 'Max bitrate must be at least 100 kbps',
                    'number.max': 'Max bitrate cannot exceed 10000 kbps'
                }),
            resolution: Joi.object({
                width: Joi.number()
                    .integer()
                    .min(320)
                    .max(3840)
                    .required()
                    .messages({
                        'number.base': 'Width must be a number',
                        'number.integer': 'Width must be an integer',
                        'number.min': 'Width must be at least 320',
                        'number.max': 'Width cannot exceed 3840',
                        'any.required': 'Width is required'
                    }),
                height: Joi.number()
                    .integer()
                    .min(240)
                    .max(2160)
                    .required()
                    .messages({
                        'number.base': 'Height must be a number',
                        'number.integer': 'Height must be an integer',
                        'number.min': 'Height must be at least 240',
                        'number.max': 'Height cannot exceed 2160',
                        'any.required': 'Height is required'
                    })
            }).optional()
        }).optional(),
        metadata: Joi.object().optional()
    })
});

// Stream ID validation schema
export const streamIdSchema = Joi.object({
    params: Joi.object({
        streamId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Stream ID is required',
                'string.min': 'Stream ID must be at least 3 characters long',
                'string.max': 'Stream ID cannot exceed 50 characters',
                'any.required': 'Stream ID is required'
            })
    })
});

// Start stream validation schema
export const startStreamSchema = Joi.object({
    params: Joi.object({
        streamId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Stream ID is required',
                'string.min': 'Stream ID must be at least 3 characters long',
                'string.max': 'Stream ID cannot exceed 50 characters',
                'any.required': 'Stream ID is required'
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
            })
    })
});

// Join stream validation schema
export const joinStreamSchema = Joi.object({
    params: Joi.object({
        streamId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Stream ID is required',
                'string.min': 'Stream ID must be at least 3 characters long',
                'string.max': 'Stream ID cannot exceed 50 characters',
                'any.required': 'Stream ID is required'
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
            })
    })
});

// Leave stream validation schema
export const leaveStreamSchema = Joi.object({
    params: Joi.object({
        streamId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Stream ID is required',
                'string.min': 'Stream ID must be at least 3 characters long',
                'string.max': 'Stream ID cannot exceed 50 characters',
                'any.required': 'Stream ID is required'
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
            })
    })
});

// Chat message validation schema
export const chatMessageSchema = Joi.object({
    params: Joi.object({
        streamId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Stream ID is required',
                'string.min': 'Stream ID must be at least 3 characters long',
                'string.max': 'Stream ID cannot exceed 50 characters',
                'any.required': 'Stream ID is required'
            })
    }),
    body: Joi.object({
        sender: Joi.string()
            .min(1)
            .max(100)
            .required()
            .messages({
                'string.empty': 'Sender is required',
                'string.min': 'Sender must be at least 1 character long',
                'string.max': 'Sender cannot exceed 100 characters',
                'any.required': 'Sender is required'
            }),
        message: Joi.string()
            .min(1)
            .max(1000)
            .required()
            .messages({
                'string.empty': 'Message is required',
                'string.min': 'Message must be at least 1 character long',
                'string.max': 'Message cannot exceed 1000 characters',
                'any.required': 'Message is required'
            }),
        type: Joi.string()
            .valid('text', 'emoji', 'system')
            .default('text')
            .messages({
                'any.only': 'Message type must be one of: text, emoji, system'
            })
    })
});

// Update stream validation schema
export const updateStreamSchema = Joi.object({
    params: Joi.object({
        streamId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Stream ID is required',
                'string.min': 'Stream ID must be at least 3 characters long',
                'string.max': 'Stream ID cannot exceed 50 characters',
                'any.required': 'Stream ID is required'
            })
    }),
    body: Joi.object({
        title: Joi.string()
            .min(1)
            .max(200)
            .optional()
            .messages({
                'string.empty': 'Stream title cannot be empty',
                'string.min': 'Stream title must be at least 1 character long',
                'string.max': 'Stream title cannot exceed 200 characters'
            }),
        description: Joi.string()
            .max(1000)
            .optional()
            .messages({
                'string.max': 'Description cannot exceed 1000 characters'
            }),
        quality: Joi.string()
            .valid('low', 'medium', 'high', 'ultra')
            .optional()
            .messages({
                'any.only': 'Quality must be one of: low, medium, high, ultra'
            }),
        maxViewers: Joi.number()
            .integer()
            .min(1)
            .max(10000)
            .optional()
            .messages({
                'number.base': 'Max viewers must be a number',
                'number.integer': 'Max viewers must be an integer',
                'number.min': 'Max viewers must be at least 1',
                'number.max': 'Max viewers cannot exceed 10000'
            }),
        settings: Joi.object({
            enableChat: Joi.boolean(),
            enableScreenShare: Joi.boolean(),
            enableRecording: Joi.boolean(),
            enableModeration: Joi.boolean(),
            allowViewerInteraction: Joi.boolean(),
            autoRecord: Joi.boolean(),
            streamDelay: Joi.number()
                .min(0)
                .max(30)
                .messages({
                    'number.base': 'Stream delay must be a number',
                    'number.min': 'Stream delay cannot be negative',
                    'number.max': 'Stream delay cannot exceed 30 seconds'
                }),
            maxBitrate: Joi.number()
                .min(100)
                .max(10000)
                .messages({
                    'number.base': 'Max bitrate must be a number',
                    'number.min': 'Max bitrate must be at least 100 kbps',
                    'number.max': 'Max bitrate cannot exceed 10000 kbps'
                }),
            resolution: Joi.object({
                width: Joi.number()
                    .integer()
                    .min(320)
                    .max(3840)
                    .messages({
                        'number.base': 'Width must be a number',
                        'number.integer': 'Width must be an integer',
                        'number.min': 'Width must be at least 320',
                        'number.max': 'Width cannot exceed 3840'
                    }),
                height: Joi.number()
                    .integer()
                    .min(240)
                    .max(2160)
                    .messages({
                        'number.base': 'Height must be a number',
                        'number.integer': 'Height must be an integer',
                        'number.min': 'Height must be at least 240',
                        'number.max': 'Height cannot exceed 2160'
                    })
            })
        }).optional(),
        metadata: Joi.object().optional()
    })
});

// Stream events query validation schema
export const streamEventsSchema = Joi.object({
    params: Joi.object({
        streamId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Stream ID is required',
                'string.min': 'Stream ID must be at least 3 characters long',
                'string.max': 'Stream ID cannot exceed 50 characters',
                'any.required': 'Stream ID is required'
            })
    }),
    query: Joi.object({
        limit: Joi.number()
            .integer()
            .min(1)
            .max(1000)
            .default(100)
            .messages({
                'number.base': 'Limit must be a number',
                'number.integer': 'Limit must be an integer',
                'number.min': 'Limit must be at least 1',
                'number.max': 'Limit cannot exceed 1000'
            })
    })
});

// Stop recording validation schema
export const stopRecordingSchema = Joi.object({
    params: Joi.object({
        streamId: Joi.string()
            .min(3)
            .max(50)
            .required()
            .messages({
                'string.empty': 'Stream ID is required',
                'string.min': 'Stream ID must be at least 3 characters long',
                'string.max': 'Stream ID cannot exceed 50 characters',
                'any.required': 'Stream ID is required'
            })
    }),
    body: Joi.object({
        recordingUrl: Joi.string()
            .uri()
            .optional()
            .messages({
                'string.uri': 'Recording URL must be a valid URI'
            })
    })
});

export default {
    createStreamSchema,
    streamIdSchema,
    startStreamSchema,
    joinStreamSchema,
    leaveStreamSchema,
    chatMessageSchema,
    updateStreamSchema,
    streamEventsSchema,
    stopRecordingSchema
};
