import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import User from '../models/User';

// Extend Express Request interface to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                role: string;
                [key: string]: any;
            };
        }
    }
}

interface JWTPayload {
    id: string;
    email: string;
    role: string;
    phone: string;
    iat: number;
    exp: number;
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        let token = req.headers['authorization'] ? req.headers['authorization'] : req.headers['vm-user-auth'] as string;


        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Access token required'
            });
            return;
        }

        // Verify token
        const decoded = jwt.verify(token, config.jwtSecret || 'your-secret-key') as unknown as JWTPayload;
        
        console.log('decoded', decoded);
      
        
        let user = await User.findOne({ phone: decoded.phone }).lean();
        if (!user) {
            res.status(500).json({
                success: false,
                message: 'User not found'
            });
            return;
        }
        // Attach user to request
        req.user = {
            ...user,
            id: user?._id?.toString(),
            email: user?.email,
            role: user?.role
        };

        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        } else if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        } else {
            console.error('❌ Authentication error:', error);
            res.status(500).json({
                success: false,
                message: 'Authentication failed'
            });
        }
    }
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require it
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            
            try {
                const decoded = jwt.verify(token, config.jwtSecret || 'your-secret-key') as JWTPayload;
                req.user = {
                    id: decoded.id,
                    email: decoded.email,
                    role: decoded.role
                };
            } catch (error) {
                // Token is invalid, but we don't fail the request
                console.warn('⚠️ Invalid token in optional auth:', error);
            }
        }

        next();
    } catch (error) {
        console.error('❌ Optional authentication error:', error);
        next();
    }
}

/**
 * Role-based authorization middleware
 * Requires specific role(s) to access the route
 */
export function authorize(roles: string | string[]): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        const userRole = req.user.role;
        const requiredRoles = Array.isArray(roles) ? roles : [roles];

        if (!requiredRoles.includes(userRole)) {
            res.status(403).json({
                success: false,
                message: 'Insufficient permissions'
            });
            return;
        }

        next();
    };
}

/**
 * Admin authorization middleware
 * Requires admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    return authorize('admin')(req, res, next);
}

/**
 * Moderator or admin authorization middleware
 * Requires moderator or admin role
 */
export function requireModerator(req: Request, res: Response, next: NextFunction): void {
    return authorize(['moderator', 'admin'])(req, res, next);
}

/**
 * User authorization middleware
 * Requires any authenticated user
 */
export function requireUser(req: Request, res: Response, next: NextFunction): void {
    return authorize(['user', 'moderator', 'admin'])(req, res, next);
}

/**
 * Resource ownership middleware
 * Ensures user owns the resource or has admin role
 */
export function requireOwnership(resourceField: string = 'createdBy'): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        // Admin can access any resource
        if (req.user.role === 'admin') {
            return next();
        }

        // Check if user owns the resource
        const resourceOwner = req.body[resourceField] || req.params[resourceField];
        
        if (resourceOwner && resourceOwner !== req.user.id) {
            res.status(403).json({
                success: false,
                message: 'Access denied: You can only access your own resources'
            });
            return;
        }

        next();
    };
}

/**
 * Rate limiting middleware
 * Limits requests based on user ID or IP
 */
export function rateLimit(options: {
    windowMs: number;
    max: number;
    keyGenerator?: (req: Request) => string;
}): (req: Request, res: Response, next: NextFunction) => void {
    const { windowMs, max, keyGenerator } = options;
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction): void => {
        const key = keyGenerator ? keyGenerator(req) : (req.user?.id || req.ip || 'unknown');
        const now = Date.now();

        // Get or create request record
        let record = requests.get(key);
        if (!record || now > record.resetTime) {
            record = { count: 0, resetTime: now + windowMs };
            requests.set(key, record);
        }

        // Increment count
        record.count++;

        // Check if limit exceeded
        if (record.count > max) {
            res.status(429).json({
                success: false,
                message: 'Too many requests',
                retryAfter: Math.ceil((record.resetTime - now) / 1000)
            });
            return;
        }

        // Add headers
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
        res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

        next();
    };
}

/**
 * API key authentication middleware
 * Validates API key from headers
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization'];

    if (!apiKey) {
        res.status(401).json({
            success: false,
            message: 'API key required'
        });
        return;
    }

    // Validate API key (you can implement your own validation logic)
    const validApiKey = config.apiKey || 'your-api-key';
    
    if (apiKey !== validApiKey) {
        res.status(401).json({
            success: false,
            message: 'Invalid API key'
        });
        return;
    }

    next();
}

/**
 * CORS middleware
 * Handles Cross-Origin Resource Sharing
 */
export function cors(req: Request, res: Response, next: NextFunction): void {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');

    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
}

/**
 * Error handling middleware
 * Catches and formats errors
 */
export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void {
    console.error('❌ Error:', error);

    // Handle specific error types
    if (error.name === 'ValidationError') {
        res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: error.message
        });
        return;
    }

    if (error.name === 'CastError') {
        res.status(400).json({
            success: false,
            message: 'Invalid ID format'
        });
        return;
    }

    if (error.name === 'MongoError' && (error as any).code === 11000) {
        res.status(409).json({
            success: false,
            message: 'Duplicate key error'
        });
        return;
    }

    // Default error response
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
}

/**
 * Request logging middleware
 * Logs incoming requests
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const method = req.method;
        const url = req.url;
        const status = res.statusCode;
        const userAgent = req.get('User-Agent') || 'Unknown';
        const ip = req.ip || req.connection.remoteAddress || 'Unknown';
        
        console.log(`${method} ${url} ${status} ${duration}ms - ${ip} - ${userAgent}`);
    });

    next();
}

export default {
    authenticate,
    optionalAuth,
    authorize,
    requireAdmin,
    requireModerator,
    requireUser,
    requireOwnership,
    rateLimit,
    requireApiKey,
    cors,
    errorHandler,
    requestLogger
};
