import Joi from 'joi';

// Update user validation schema (admin)
export const updateUserSchema = Joi.object({
    body: Joi.object({
        name: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .messages({
                'string.min': 'Name must be at least 2 characters long',
                'string.max': 'Name cannot exceed 100 characters'
            }),
        email: Joi.string()
            .email()
            .optional()
            .messages({
                'string.email': 'Please provide a valid email address'
            }),
        role: Joi.string()
            .valid('user', 'moderator', 'admin')
            .optional()
            .messages({
                'any.only': 'Role must be one of: user, moderator, admin'
            }),
        isActive: Joi.boolean()
            .optional()
            .messages({
                'boolean.base': 'isActive must be a boolean value'
            }),
        isEmailVerified: Joi.boolean()
            .optional()
            .messages({
                'boolean.base': 'isEmailVerified must be a boolean value'
            })
    })
});

// Reset password validation schema (admin)
export const resetPasswordSchema = Joi.object({
    body: Joi.object({
        newPassword: Joi.string()
            .min(8)
            .max(128)
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .required()
            .messages({
                'string.empty': 'New password is required',
                'string.min': 'Password must be at least 8 characters long',
                'string.max': 'Password cannot exceed 128 characters',
                'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
                'any.required': 'New password is required'
            })
    })
});

// Query parameters validation for user listing
export const listUsersSchema = Joi.object({
    query: Joi.object({
        page: Joi.number()
            .integer()
            .min(1)
            .optional()
            .messages({
                'number.base': 'Page must be a number',
                'number.integer': 'Page must be an integer',
                'number.min': 'Page must be at least 1'
            }),
        limit: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .optional()
            .messages({
                'number.base': 'Limit must be a number',
                'number.integer': 'Limit must be an integer',
                'number.min': 'Limit must be at least 1',
                'number.max': 'Limit cannot exceed 100'
            }),
        search: Joi.string()
            .min(1)
            .max(100)
            .optional()
            .messages({
                'string.min': 'Search term must be at least 1 character long',
                'string.max': 'Search term cannot exceed 100 characters'
            }),
        role: Joi.string()
            .valid('user', 'moderator', 'admin')
            .optional()
            .messages({
                'any.only': 'Role filter must be one of: user, moderator, admin'
            }),
        isActive: Joi.string()
            .valid('true', 'false')
            .optional()
            .messages({
                'any.only': 'isActive filter must be either "true" or "false"'
            })
    })
});
