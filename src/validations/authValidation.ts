import Joi from 'joi';

// Registration validation schema
export const registerSchema = Joi.object({
    body: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .messages({
                'string.email': 'Please provide a valid email address',
                'string.empty': 'Email is required',
                'any.required': 'Email is required'
            }),
        name: Joi.string()
            .min(2)
            .max(100)
            .required()
            .messages({
                'string.empty': 'Name is required',
                'string.min': 'Name must be at least 2 characters long',
                'string.max': 'Name cannot exceed 100 characters',
                'any.required': 'Name is required'
            }),
        password: Joi.string()
            .min(8)
            .max(128)
            // .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .required()
            .messages({
                'string.empty': 'Password is required',
                'string.min': 'Password must be at least 8 characters long',
                'string.max': 'Password cannot exceed 128 characters',
                'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
                'any.required': 'Password is required'
            }),
        userId: Joi.string()
            .min(3)
            .max(50)
            .pattern(/^[a-zA-Z0-9_-]+$/)
            .required()
            .messages({
                'string.empty': 'User ID is required',
                'string.min': 'User ID must be at least 3 characters long',
                'string.max': 'User ID cannot exceed 50 characters',
                'string.pattern.base': 'User ID can only contain letters, numbers, hyphens, and underscores',
                'any.required': 'User ID is required'
            })
    })
});

// Login validation schema
export const loginSchema = Joi.object({
    body: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .messages({
                'string.email': 'Please provide a valid email address',
                'string.empty': 'Email is required',
                'any.required': 'Email is required'
            }),
        password: Joi.string()
            .required()
            .messages({
                'string.empty': 'Password is required',
                'any.required': 'Password is required'
            })
    })
});

// Forgot password validation schema
export const forgotPasswordSchema = Joi.object({
    body: Joi.object({
        email: Joi.string()
            .email()
            .required()
            .messages({
                'string.email': 'Please provide a valid email address',
                'string.empty': 'Email is required',
                'any.required': 'Email is required'
            })
    })
});

// Reset password validation schema
export const resetPasswordSchema = Joi.object({
    body: Joi.object({
        token: Joi.string()
            .required()
            .messages({
                'string.empty': 'Reset token is required',
                'any.required': 'Reset token is required'
            }),
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

// Change password validation schema
export const changePasswordSchema = Joi.object({
    body: Joi.object({
        currentPassword: Joi.string()
            .required()
            .messages({
                'string.empty': 'Current password is required',
                'any.required': 'Current password is required'
            }),
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

// Update profile validation schema
export const updateProfileSchema = Joi.object({
    body: Joi.object({
        name: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .messages({
                'string.min': 'Name must be at least 2 characters long',
                'string.max': 'Name cannot exceed 100 characters'
            }),
        avatar: Joi.string()
            .uri()
            .optional()
            .messages({
                'string.uri': 'Avatar must be a valid URL'
            })
    })
});

// Refresh token validation schema
export const refreshTokenSchema = Joi.object({
    body: Joi.object({
        refreshToken: Joi.string()
            .required()
            .messages({
                'string.empty': 'Refresh token is required',
                'any.required': 'Refresh token is required'
            })
    })
});

// Logout validation schema
export const logoutSchema = Joi.object({
    body: Joi.object({
        refreshToken: Joi.string()
            .optional()
            .messages({
                'string.empty': 'Refresh token cannot be empty'
            })
    })
});
