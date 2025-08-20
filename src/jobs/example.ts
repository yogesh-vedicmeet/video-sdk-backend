import { queueService, QueueType } from '../services/queue';

/**
 * Example usage of the queue service
 */
export class QueueExamples {
    
    /**
     * Example: Send a welcome email
     */
    static async sendWelcomeEmail(userEmail: string, userName: string) {
        try {
            const job = await queueService.addEmailJob({
                to: userEmail,
                subject: 'Welcome to Our Platform!',
                body: `Hello ${userName}, welcome to our platform!`,
                template: 'welcome-email'
            });
            
            console.log(`📧 Welcome email queued with job ID: ${job.id}`);
            return job;
        } catch (error) {
            console.error('❌ Failed to queue welcome email:', error);
            throw error;
        }
    }

    /**
     * Example: Send a delayed notification
     */
    static async sendDelayedNotification(userId: string, message: string, delayMinutes: number = 5) {
        try {
            const job = await queueService.addNotificationJob({
                userId,
                type: 'push',
                title: 'Reminder',
                message,
                data: { type: 'reminder' }
            }, {
                delay: delayMinutes * 60 * 1000 // Convert minutes to milliseconds
            });
            
            console.log(`🔔 Delayed notification queued with job ID: ${job.id}`);
            return job;
        } catch (error) {
            console.error('❌ Failed to queue delayed notification:', error);
            throw error;
        }
    }

    /**
     * Example: Process a video file
     */
    static async processVideo(videoId: string, inputPath: string, outputPath: string) {
        try {
            const job = await queueService.addVideoProcessingJob({
                videoId,
                inputPath,
                outputPath,
                quality: 'high',
                format: 'mp4'
            });
            
            console.log(`🎥 Video processing queued with job ID: ${job.id}`);
            return job;
        } catch (error) {
            console.error('❌ Failed to queue video processing:', error);
            throw error;
        }
    }

    /**
     * Example: Upload a file with metadata
     */
    static async uploadFile(fileId: string, filePath: string, destination: string, metadata?: Record<string, any>) {
        try {
            const job = await queueService.addFileUploadJob({
                fileId,
                filePath,
                destination,
                metadata
            });
            
            console.log(`📁 File upload queued with job ID: ${job.id}`);
            return job;
        } catch (error) {
            console.error('❌ Failed to queue file upload:', error);
            throw error;
        }
    }

    /**
     * Example: Schedule cleanup task
     */
    static async scheduleCleanup(cleanupType: 'temp-files' | 'old-sessions' | 'expired-tokens', olderThanDays: number = 7) {
        try {
            const job = await queueService.addCleanupJob({
                type: cleanupType,
                olderThan: olderThanDays,
                patterns: cleanupType === 'temp-files' ? ['*.tmp', '*.temp'] : undefined
            });
            
            console.log(`🧹 Cleanup task queued with job ID: ${job.id}`);
            return job;
        } catch (error) {
            console.error('❌ Failed to queue cleanup task:', error);
            throw error;
        }
    }

    /**
     * Example: Track user analytics event
     */
    static async trackAnalyticsEvent(event: string, userId?: string, data?: Record<string, any>) {
        try {
            const job = await queueService.addAnalyticsJob({
                event,
                userId,
                data: data || {},
                timestamp: Date.now()
            });
            
            console.log(`📊 Analytics event queued with job ID: ${job.id}`);
            return job;
        } catch (error) {
            console.error('❌ Failed to queue analytics event:', error);
            throw error;
        }
    }

    /**
     * Example: Get queue statistics
     */
    static async getQueueStats() {
        try {
            const stats: Record<string, any> = {};
            
            for (const queueType of queueService.getQueueTypes()) {
                stats[queueType] = await queueService.getQueueStats(queueType);
            }
            
            console.log('📊 Queue Statistics:', JSON.stringify(stats, null, 2));
            return stats;
        } catch (error) {
            console.error('❌ Failed to get queue stats:', error);
            throw error;
        }
    }

    /**
     * Example: Monitor job progress
     */
    static async monitorJob(queueType: QueueType, jobId: string) {
        try {
            const job = await queueService.getJob(queueType, jobId);
            
            if (!job) {
                console.log(`❌ Job ${jobId} not found`);
                return null;
            }
            
            console.log(`📋 Job ${jobId} status:`, {
                id: job.id,
                name: job.name,
                data: job.data,
                progress: job.progress,
                timestamp: job.timestamp,
                processedOn: job.processedOn,
                finishedOn: job.finishedOn,
                failedReason: job.failedReason
            });
            
            return job;
        } catch (error) {
            console.error('❌ Failed to monitor job:', error);
            throw error;
        }
    }

    /**
     * Example: Retry failed jobs
     */
    static async retryFailedJobs(queueType: QueueType) {
        try {
            const failedJobs = await queueService.getFailedJobs(queueType);
            
            console.log(`🔄 Found ${failedJobs.length} failed jobs in ${queueType} queue`);
            
            for (const job of failedJobs) {
                await queueService.retryJob(queueType, job.id!);
                console.log(`🔄 Retried job ${job.id}`);
            }
            
            return failedJobs.length;
        } catch (error) {
            console.error('❌ Failed to retry jobs:', error);
            throw error;
        }
    }
}

// Example usage
async function runExamples() {
    try {
        console.log('🚀 Running queue examples...\n');
        
        // Send welcome email
        await QueueExamples.sendWelcomeEmail('user@example.com', 'John Doe');
        
        // Send delayed notification
        await QueueExamples.sendDelayedNotification('user123', 'Don\'t forget your meeting!', 2);
        
        // Process video
        await QueueExamples.processVideo('video123', '/uploads/video.mp4', '/processed/video.mp4');
        
        // Upload file
        await QueueExamples.uploadFile('file123', '/temp/file.pdf', '/uploads/', { 
            category: 'document', 
            size: 1024 
        });
        
        // Schedule cleanup
        await QueueExamples.scheduleCleanup('temp-files', 1);
        
        // Track analytics
        await QueueExamples.trackAnalyticsEvent('user_login', 'user123', { 
            platform: 'web', 
            browser: 'chrome' 
        });
        
        // Get queue stats
        await QueueExamples.getQueueStats();
        
        console.log('\n✅ All examples completed successfully!');
        
    } catch (error) {
        console.error('❌ Examples failed:', error);
    }
}

// Uncomment to run examples
// runExamples();

export default QueueExamples;
