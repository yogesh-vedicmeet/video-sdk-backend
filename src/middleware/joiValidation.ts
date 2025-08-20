import { Request, Response, NextFunction } from 'express';
import { Schema, ValidationError } from 'joi';

/**
 * Joi validation middleware
 * Validates request data against Joi schemas
 */
export function validateRequest(schema: Schema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const { error, value } = schema.validate(req, {
            abortEarly: false,
            stripUnknown: true,
            allowUnknown: true
        });

        console.log('validateRequest', error, value);

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }));

            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errorDetails
            });
            return;
        }

        // Replace request data with validated data
        if (value.body) req.body = value.body;
        if (value.params) req.params = value.params;
        if (value.query) req.query = value.query;

        next();
    };
}

/**
 * Validate only request body
 */
export function validateBody(schema: Schema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
            allowUnknown: true
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }));

            res.status(400).json({
                success: false,
                message: 'Request body validation failed',
                errors: errorDetails
            });
            return;
        }

        req.body = value;
        next();
    };
}

/**
 * Validate only request parameters
 */
export function validateParams(schema: Schema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const { error, value } = schema.validate(req.params, {
            abortEarly: false,
            stripUnknown: true,
            allowUnknown: true
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }));

            res.status(400).json({
                success: false,
                message: 'Request parameters validation failed',
                errors: errorDetails
            });
            return;
        }

        req.params = value;
        next();
    };
}

/**
 * Validate only request query
 */
export function validateQuery(schema: Schema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true,
            allowUnknown: true
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }));

            res.status(400).json({
                success: false,
                message: 'Request query validation failed',
                errors: errorDetails
            });
            return;
        }

        req.query = value;
        next();
    };
}

/**
 * Custom error handler for Joi validation errors
 */
export function handleJoiError(error: ValidationError, req: Request, res: Response, next: NextFunction): void {
    if (error.isJoi) {
        const errorDetails = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            type: detail.type
        }));

        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errorDetails
        });
        return;
    }

    next(error);
}

/**
 * Sanitize request data
 * Removes unknown fields and applies transformations
 */
export function sanitizeRequest(schema: Schema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const { value } = schema.validate(req, {
            abortEarly: false,
            stripUnknown: true,
            allowUnknown: false
        });

        // Replace request data with sanitized data
        if (value.body) req.body = value.body;
        if (value.params) req.params = value.params;
        if (value.query) req.query = value.query;

        next();
    };
}

/**
 * Validate and transform request data
 * Applies both validation and transformation
 */
export function validateAndTransform(schema: Schema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const { error, value } = schema.validate(req, {
            abortEarly: false,
            stripUnknown: true,
            allowUnknown: false
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }));

            res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errorDetails
            });
            return;
        }

        // Replace request data with validated and transformed data
        if (value.body) req.body = value.body;
        if (value.params) req.params = value.params;
        if (value.query) req.query = value.query;

        next();
    };
}

export default {
    validateRequest,
    validateBody,
    validateParams,
    validateQuery,
    handleJoiError,
    sanitizeRequest,
    validateAndTransform
};
