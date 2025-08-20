import { Queue, Worker, Job, QueueOptions, WorkerOptions } from 'bullmq';
import { config } from '../config/config';

// Redis connection configuration
const connection = {
    host: config.redisHost,
    port: Number(config.redisPort),
    password: config.redisPassword,
};

// Default queue options
const defaultQueueOptions: QueueOptions = {
    connection,
    defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50,      // Keep last 50 failed jobs
        attempts: 3,           // Retry failed jobs up to 3 times
        backoff: {
            type: 'exponential',
            delay: 2000,       // Start with 2 seconds delay
        },
    },
};

// Default worker options
const defaultWorkerOptions: WorkerOptions = {
    connection,
    concurrency: 5,           // Process 5 jobs concurrently
};

// Queue types enum
export enum QueueType {
    EMAIL = 'email',
    NOTIFICATION = 'notification',
    VIDEO_PROCESSING = 'video-processing',
    FILE_UPLOAD = 'file-upload',
    CLEANUP = 'cleanup',
    ANALYTICS = 'analytics',
}

// Job data interfaces
export interface EmailJobData {
    to: string;
    subject: string;
    body: string;
    template?: string;
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType: string;
    }>;
}

export interface NotificationJobData {
    userId: string;
    type: 'push' | 'email' | 'sms';
    title: string;
    message: string;
    data?: Record<string, any>;
}

export interface VideoProcessingJobData {
    videoId: string;
    inputPath: string;
    outputPath: string;
    quality: 'low' | 'medium' | 'high';
    format: 'mp4' | 'webm' | 'avi';
}

export interface FileUploadJobData {
    fileId: string;
    filePath: string;
    destination: string;
    metadata?: Record<string, any>;
}

export interface CleanupJobData {
    type: 'temp-files' | 'old-sessions' | 'expired-tokens';
    olderThan: number; // days
    patterns?: string[];
}

export interface AnalyticsJobData {
    event: string;
    userId?: string;
    data: Record<string, any>;
    timestamp: number;
}

// Queue service class
export class QueueService {
    private queues: Map<QueueType, Queue> = new Map();
    private workers: Map<QueueType, Worker> = new Map();

    constructor() {
        this.initializeQueues();
    }

    /**
     * Initialize all queues
     */
    private initializeQueues(): void {
        Object.values(QueueType).forEach(queueType => {
            const queue = new Queue(queueType, defaultQueueOptions);
            this.queues.set(queueType, queue);
        });
    }

    /**
     * Get a queue by type
     */
    public getQueue<T = any>(queueType: QueueType): Queue<T> {
        const queue = this.queues.get(queueType);
        if (!queue) {
            throw new Error(`Queue ${queueType} not found`);
        }
        return queue as Queue<T>;
    }

    /**
     * Add a job to a queue
     */
    public async addJob<T = any>(
        queueType: QueueType,
        data: T,
        options?: {
            delay?: number;
            priority?: number;
            jobId?: string;
            repeat?: {
                pattern: string;
            };
        }
    ): Promise<Job<T>> {
        const queue = this.getQueue<T>(queueType);
        return await queue.add(queueType, data, options);
    }

    /**
     * Add email job
     */
    public async addEmailJob(data: EmailJobData, options?: { delay?: number; priority?: number }): Promise<Job<EmailJobData>> {
        return await this.addJob(QueueType.EMAIL, data, options);
    }

    /**
     * Add notification job
     */
    public async addNotificationJob(data: NotificationJobData, options?: { delay?: number; priority?: number }): Promise<Job<NotificationJobData>> {
        return await this.addJob(QueueType.NOTIFICATION, data, options);
    }

    /**
     * Add video processing job
     */
    public async addVideoProcessingJob(data: VideoProcessingJobData, options?: { delay?: number; priority?: number }): Promise<Job<VideoProcessingJobData>> {
        return await this.addJob(QueueType.VIDEO_PROCESSING, data, options);
    }

    /**
     * Add file upload job
     */
    public async addFileUploadJob(data: FileUploadJobData, options?: { delay?: number; priority?: number }): Promise<Job<FileUploadJobData>> {
        return await this.addJob(QueueType.FILE_UPLOAD, data, options);
    }

    /**
     * Add cleanup job
     */
    public async addCleanupJob(data: CleanupJobData, options?: { delay?: number; priority?: number }): Promise<Job<CleanupJobData>> {
        return await this.addJob(QueueType.CLEANUP, data, options);
    }

    /**
     * Add analytics job
     */
    public async addAnalyticsJob(data: AnalyticsJobData, options?: { delay?: number; priority?: number }): Promise<Job<AnalyticsJobData>> {
        return await this.addJob(QueueType.ANALYTICS, data, options);
    }

    /**
     * Get job by ID
     */
    public async getJob<T = any>(queueType: QueueType, jobId: string): Promise<Job<T> | undefined> {
        const queue = this.getQueue<T>(queueType);
        return await queue.getJob(jobId);
    }

    /**
     * Get waiting jobs
     */
    public async getWaitingJobs<T = any>(queueType: QueueType, start = 0, end = 100): Promise<Job<T>[]> {
        const queue = this.getQueue<T>(queueType);
        return await queue.getWaiting(start, end);
    }

    /**
     * Get active jobs
     */
    public async getActiveJobs<T = any>(queueType: QueueType, start = 0, end = 100): Promise<Job<T>[]> {
        const queue = this.getQueue<T>(queueType);
        return await queue.getActive(start, end);
    }

    /**
     * Get completed jobs
     */
    public async getCompletedJobs<T = any>(queueType: QueueType, start = 0, end = 100): Promise<Job<T>[]> {
        const queue = this.getQueue<T>(queueType);
        return await queue.getCompleted(start, end);
    }

    /**
     * Get failed jobs
     */
    public async getFailedJobs<T = any>(queueType: QueueType, start = 0, end = 100): Promise<Job<T>[]> {
        const queue = this.getQueue<T>(queueType);
        return await queue.getFailed(start, end);
    }

    /**
     * Remove job by ID
     */
    public async removeJob(queueType: QueueType, jobId: string): Promise<void> {
        const queue = this.getQueue(queueType);
        const job = await queue.getJob(jobId);
        if (job) {
            await job.remove();
        }
    }

    /**
     * Retry failed job
     */
    public async retryJob(queueType: QueueType, jobId: string): Promise<void> {
        const queue = this.getQueue(queueType);
        const job = await queue.getJob(jobId);
        if (job) {
            await job.retry();
        }
    }

    /**
     * Get queue statistics
     */
    public async getQueueStats(queueType: QueueType): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        paused: number;
    }> {
        const queue = this.getQueue(queueType);
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
        ]);

        return {
            waiting,
            active,
            completed,
            failed,
            delayed,
            paused: 0, // BullMQ doesn't have getPausedCount method
        };
    }

    /**
     * Pause a queue
     */
    public async pauseQueue(queueType: QueueType): Promise<void> {
        const queue = this.getQueue(queueType);
        await queue.pause();
    }

    /**
     * Resume a queue
     */
    public async resumeQueue(queueType: QueueType): Promise<void> {
        const queue = this.getQueue(queueType);
        await queue.resume();
    }

    /**
     * Clean a queue (remove completed/failed jobs)
     */
    public async cleanQueue(queueType: QueueType, grace = 1000 * 60 * 60 * 24): Promise<void> {
        const queue = this.getQueue(queueType);
        await queue.clean(grace, 'completed' as any);
        await queue.clean(grace, 'failed' as any);
    }

    /**
     * Close all queues
     */
    public async close(): Promise<void> {
        const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
        await Promise.all(closePromises);
        this.queues.clear();
    }

    /**
     * Get all queue types
     */
    public getQueueTypes(): QueueType[] {
        return Object.values(QueueType);
    }
}

// Create singleton instance
export const queueService = new QueueService();

// Export for convenience
export default queueService;
