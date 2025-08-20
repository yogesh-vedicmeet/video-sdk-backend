import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/config';
import { errorHandler, requestLogger } from './middleware/auth';
import roomRoutes from './routes/roomRoutes';
import streamRoutes from './routes/streamRoutes';
import interactiveRoutes from './routes/interactiveRoutes';

class App {
    public app: Application;
    public port: number;

    constructor() {
        this.app = express();
        this.port = Number(config.port) || 3000;
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    /**
     * Initialize all middleware
     */
    private initializeMiddlewares(): void {
        // CORS middleware
        this.app.use(cors({
            origin: '*',
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
        }));

        // Body parsing middleware
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Logging middleware
        if (config.nodeEnv === 'development') {
            this.app.use(morgan('dev'));
        } else {
            this.app.use(morgan('combined'));
        }

        // Custom request logger
        this.app.use(requestLogger);

        // Health check endpoint
        this.app.get('/health', (req: Request, res: Response) => {
            res.status(200).json({
                success: true,
                message: 'Server is healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: config.nodeEnv
            });
        });

        // API documentation endpoint
        this.app.get('/api/docs', (req: Request, res: Response) => {
            res.json({
                success: true,
                message: 'Video SDK API Documentation',
                version: '1.0.0',
                endpoints: {
                    rooms: {
                        'POST /api/rooms': 'Create a new room',
                        'GET /api/rooms': 'Get all rooms with pagination',
                        'GET /api/rooms/:roomId': 'Get a specific room',
                        'PUT /api/rooms/:roomId': 'Update a room',
                        'DELETE /api/rooms/:roomId': 'Delete a room',
                        'POST /api/rooms/:roomId/token': 'Generate join token',
                        'GET /api/rooms/:roomId/stats': 'Get room statistics'
                    },
                    participants: {
                        'GET /api/rooms/:roomId/participants': 'Get room participants',
                        'POST /api/rooms/:roomId/participants': 'Add participant to room',
                        'PUT /api/rooms/:roomId/participants/:participantId': 'Update participant',
                        'DELETE /api/rooms/:roomId/participants/:participantId': 'Remove participant'
                    },
                    sessions: {
                        'POST /api/rooms/:roomId/sessions': 'Start a session',
                        'GET /api/rooms/:roomId/sessions': 'Get room sessions',
                        'PUT /api/sessions/:sessionId': 'Update session',
                        'DELETE /api/sessions/:sessionId': 'End session'
                    },
                    streams: {
                        'POST /api/streams': 'Create a new live stream',
                        'GET /api/streams/:streamId': 'Get stream information',
                        'PUT /api/streams/:streamId': 'Update stream configuration',
                        'POST /api/streams/:streamId/start': 'Start a live stream',
                        'POST /api/streams/:streamId/stop': 'Stop a live stream',
                        'POST /api/streams/:streamId/pause': 'Pause a live stream',
                        'POST /api/streams/:streamId/resume': 'Resume a paused stream',
                        'GET /api/streams/:streamId/stats': 'Get stream statistics',
                        'POST /api/streams/:streamId/join': 'Join stream as viewer',
                        'POST /api/streams/:streamId/leave': 'Leave stream as viewer',
                        'POST /api/streams/:streamId/chat': 'Send chat message',
                        'POST /api/streams/:streamId/recording/start': 'Start recording',
                        'POST /api/streams/:streamId/recording/stop': 'Stop recording',
                        'GET /api/streams/:streamId/events': 'Get stream events'
                    },
                    interactive: {
                        'POST /api/interactive/:roomId/polls': 'Create a new poll',
                        'POST /api/interactive/polls/:pollId/vote': 'Vote on a poll',
                        'GET /api/interactive/polls/:pollId/results': 'Get poll results',
                        'GET /api/interactive/:roomId/polls': 'Get active polls',
                        'POST /api/interactive/:roomId/questions': 'Ask a question',
                        'POST /api/interactive/questions/:questionId/upvote': 'Upvote a question',
                        'POST /api/interactive/questions/:questionId/downvote': 'Downvote a question',
                        'POST /api/interactive/questions/:questionId/answer': 'Answer a question',
                        'GET /api/interactive/:roomId/questions': 'Get questions',
                        'POST /api/interactive/:roomId/gifts': 'Send a gift',
                        'GET /api/interactive/:roomId/gifts': 'Get gifts',
                        'POST /api/interactive/:roomId/emojis': 'Send an emoji',
                        'GET /api/interactive/:roomId/emojis': 'Get emojis'
                    }
                }
            });
        });
    }

    /**
     * Initialize all routes
     */
    private initializeRoutes(): void {
        // API routes
        this.app.use('/api/rooms', roomRoutes);
        this.app.use('/api/streams', streamRoutes);
        this.app.use('/api/interactive', interactiveRoutes);

        // Webhook routes for LiveKit
        this.app.post('/webhooks/livekit', (req: Request, res: Response) => {
            // Handle LiveKit webhooks
            console.log('📥 Received LiveKit webhook:', req.body);
            res.status(200).json({ success: true });
        });

        // 404 handler for undefined routes
        this.app.use('*', (req: Request, res: Response) => {
            res.status(404).json({
                success: false,
                message: 'Route not found',
                path: req.originalUrl,
                method: req.method
            });
        });
    }

    /**
     * Initialize error handling
     */
    private initializeErrorHandling(): void {
        // Global error handler
        this.app.use(errorHandler);

        // Unhandled promise rejection handler
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
        });

        // Uncaught exception handler
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            process.exit(1);
        });
    }

    /**
     * Start the server
     */
    public listen(): void {
        this.app.listen(this.port, () => {
            console.log(`🚀 Server is running on port ${this.port}`);
            console.log(`📊 Environment: ${config.nodeEnv}`);
            console.log(`🔗 Health check: http://localhost:${this.port}/health`);
            console.log(`📚 API docs: http://localhost:${this.port}/api/docs`);
        });
    }

    /**
     * Get the Express app instance
     */
    public getApp(): Application {
        return this.app;
    }
}

// Create and export the app instance
const app = new App();

// Export for testing
export default app;

// Start the server if this file is run directly
if (require.main === module) {
    app.listen();
}
