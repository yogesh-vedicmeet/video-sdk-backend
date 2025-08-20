import { Request, Response, NextFunction } from 'express';

interface ValidationRule {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    enum?: string[];
    pattern?: RegExp;
    custom?: (value: any) => boolean;
    message?: string;
}

interface ValidationSchema {
    body?: Record<string, ValidationRule>;
    query?: Record<string, ValidationRule>;
    params?: Record<string, ValidationRule>;
}

export function validateRequest(schema: ValidationSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        const errors: string[] = [];

        // Validate body
        if (schema.body) {
            validateObject(req.body, schema.body, 'body', errors);
        }

        // Validate query
        if (schema.query) {
            validateObject(req.query, schema.query, 'query', errors);
        }

        // Validate params
        if (schema.params) {
            validateObject(req.params, schema.params, 'params', errors);
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }

        next();
    };
}

function validateObject(
    data: any, 
    schema: Record<string, ValidationRule>, 
    source: string, 
    errors: string[]
): void {
    for (const [field, rule] of Object.entries(schema)) {
        const value = data[field];
        const fieldPath = `${source}.${field}`;

        // Check if required
        if (rule.required && (value === undefined || value === null || value === '')) {
            errors.push(`${fieldPath} is required`);
            continue;
        }

        // Skip validation if value is not provided and not required
        if (value === undefined || value === null) {
            continue;
        }

        // Type validation
        if (!validateType(value, rule.type)) {
            errors.push(`${fieldPath} must be of type ${rule.type}`);
            continue;
        }

        // String validations
        if (rule.type === 'string' && typeof value === 'string') {
            if (rule.minLength !== undefined && value.length < rule.minLength) {
                errors.push(`${fieldPath} must be at least ${rule.minLength} characters long`);
            }

            if (rule.maxLength !== undefined && value.length > rule.maxLength) {
                errors.push(`${fieldPath} must be at most ${rule.maxLength} characters long`);
            }

            if (rule.pattern && !rule.pattern.test(value)) {
                errors.push(`${fieldPath} format is invalid`);
            }

            if (rule.enum && !rule.enum.includes(value)) {
                errors.push(`${fieldPath} must be one of: ${rule.enum.join(', ')}`);
            }
        }

        // Number validations
        if (rule.type === 'number' && typeof value === 'number') {
            if (rule.min !== undefined && value < rule.min) {
                errors.push(`${fieldPath} must be at least ${rule.min}`);
            }

            if (rule.max !== undefined && value > rule.max) {
                errors.push(`${fieldPath} must be at most ${rule.max}`);
            }
        }

        // Custom validation
        if (rule.custom && !rule.custom(value)) {
            errors.push(rule.message || `${fieldPath} validation failed`);
        }
    }
}

function validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
        case 'string':
            return typeof value === 'string';
        case 'number':
            return typeof value === 'number' && !isNaN(value);
        case 'boolean':
            return typeof value === 'boolean';
        case 'object':
            return typeof value === 'object' && value !== null && !Array.isArray(value);
        case 'array':
            return Array.isArray(value);
        default:
            return true;
    }
}

// Helper function for common validations
export const commonValidations = {
    // UUID validation
    uuid: (value: string): boolean => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(value);
    },

    // Email validation
    email: (value: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    },

    // URL validation
    url: (value: string): boolean => {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    },

    // Date validation
    date: (value: string): boolean => {
        const date = new Date(value);
        return !isNaN(date.getTime());
    },

    // Positive integer validation
    positiveInteger: (value: number): boolean => {
        return Number.isInteger(value) && value > 0;
    },

    // Non-negative integer validation
    nonNegativeInteger: (value: number): boolean => {
        return Number.isInteger(value) && value >= 0;
    }
};

// Predefined validation schemas
export const validationSchemas = {
    room: {
        body: {
            name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
            description: { type: 'string', required: false, maxLength: 500 },
            maxParticipants: { type: 'number', required: false, min: 1, max: 100 },
            settings: { type: 'object', required: false },
            metadata: { type: 'object', required: false }
        }
    },

    participant: {
        body: {
            identity: { type: 'string', required: true, minLength: 1, maxLength: 100 },
            name: { type: 'string', required: true, minLength: 1, maxLength: 100 },
            email: { 
                type: 'string', 
                required: false, 
                custom: commonValidations.email,
                message: 'Invalid email format'
            },
            role: { 
                type: 'string', 
                required: false, 
                enum: ['host', 'moderator', 'participant', 'viewer'] 
            }
        }
    },

    session: {
        body: {
            title: { type: 'string', required: true, minLength: 1, maxLength: 200 },
            description: { type: 'string', required: false, maxLength: 1000 },
            maxParticipants: { type: 'number', required: false, min: 1, max: 100 },
            startTime: { 
                type: 'string', 
                required: false, 
                custom: commonValidations.date,
                message: 'Invalid date format'
            }
        }
    },

    pagination: {
        query: {
            page: { type: 'number', required: false, min: 1 },
            limit: { type: 'number', required: false, min: 1, max: 100 },
            sortBy: { type: 'string', required: false },
            sortOrder: { type: 'string', required: false, enum: ['asc', 'desc'] }
        }
    },

    idParam: {
        params: {
            id: { type: 'string', required: true, minLength: 1 }
        }
    },

    roomIdParam: {
        params: {
            roomId: { type: 'string', required: true, minLength: 3, maxLength: 50 }
        }
    }
};

export default validateRequest;
