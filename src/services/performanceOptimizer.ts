import RedisVideoService from './redis-enhanced';

export class PerformanceOptimizer {
    private static instance: PerformanceOptimizer;
    private messageQueue: Map<string, any[]> = new Map();
    private batchSize = 10;
    private flushInterval = 100; // 100ms
    private flushTimers: Map<string, NodeJS.Timeout> = new Map();

    private constructor() {
        this.startPeriodicCleanup();
    }

    public static getInstance(): PerformanceOptimizer {
        if (!PerformanceOptimizer.instance) {
            PerformanceOptimizer.instance = new PerformanceOptimizer();
        }
        return PerformanceOptimizer.instance;
    }

    /**
     * Optimize interactive messages for smooth streaming
     * Batches messages to reduce network overhead
     */
    public async queueInteractiveMessage(roomId: string, messageType: string, data: any): Promise<void> {
        const key = `${roomId}:${messageType}`;
        
        if (!this.messageQueue.has(key)) {
            this.messageQueue.set(key, []);
        }
        
        this.messageQueue.get(key)!.push({
            ...data,
            timestamp: Date.now()
        });

        // Schedule flush if not already scheduled
        if (!this.flushTimers.has(key)) {
            const timer = setTimeout(() => {
                this.flushMessages(key);
            }, this.flushInterval);
            
            this.flushTimers.set(key, timer);
        }

        // Flush immediately if batch is full
        if (this.messageQueue.get(key)!.length >= this.batchSize) {
            this.flushMessages(key);
        }
    }

    /**
     * Flush batched messages
     */
    private async flushMessages(key: string): Promise<void> {
        const messages = this.messageQueue.get(key);
        if (!messages || messages.length === 0) return;

        // Clear the queue
        this.messageQueue.set(key, []);
        
        // Clear the timer
        const timer = this.flushTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.flushTimers.delete(key);
        }

        // Process batched messages
        const [roomId, messageType] = key.split(':');
        
        try {
            // Cache batched messages for quick retrieval
            await RedisVideoService.cacheBatchedMessages(roomId, messageType, messages);
            
            // Emit batched event to socket
            this.emitBatchedMessages(roomId, messageType, messages);
            
        } catch (error) {
            console.error('Error flushing messages:', error);
        }
    }

    /**
     * Emit batched messages to socket clients
     */
    private emitBatchedMessages(roomId: string, messageType: string, messages: any[]): void {
        // This will be called from socket handler
        // The actual emission happens in the socket namespace
        console.log(`Emitting ${messages.length} ${messageType} messages for room ${roomId}`);
    }

    /**
     * Optimize poll updates for real-time performance
     */
    public async optimizePollUpdate(roomId: string, pollId: string, results: any): Promise<void> {
        try {
            // Cache poll results for quick access
            await RedisVideoService.cachePollResults(roomId, pollId, results);
            
            // Throttle updates to prevent spam
            const throttleKey = `poll:${pollId}:throttle`;
            const lastUpdate = await RedisVideoService.getCache(throttleKey);
            const now = Date.now();
            
            if (!lastUpdate || (now - parseInt(lastUpdate)) > 1000) { // 1 second throttle
                await RedisVideoService.setCache(throttleKey, now.toString(), 5); // 5 second TTL
                return results; // Allow update
            }
            
            return null; // Throttle update
        } catch (error) {
            console.error('Error optimizing poll update:', error);
            return results; // Fallback to original results
        }
    }

    /**
     * Optimize Q&A updates
     */
    public async optimizeQAUpdate(roomId: string, questionId: string, update: any): Promise<any> {
        try {
            // Cache question updates
            await RedisVideoService.cacheQuestionUpdate(roomId, questionId, update);
            
            // Rate limit updates
            const rateLimitKey = `qa:${questionId}:rate`;
            const updateCount = await RedisVideoService.incrementCache(rateLimitKey);
            
            if (updateCount === 1) {
                await RedisVideoService.setCacheExpiry(rateLimitKey, 60); // 1 minute TTL
            }
            
            if (updateCount > 10) { // Max 10 updates per minute
                return null; // Rate limit exceeded
            }
            
            return update;
        } catch (error) {
            console.error('Error optimizing Q&A update:', error);
            return update;
        }
    }

    /**
     * Optimize gift and emoji messages
     */
    public async optimizeInteractiveMessage(roomId: string, messageType: 'gift' | 'emoji', data: any): Promise<any> {
        try {
            // Rate limit per user
            const userRateKey = `${messageType}:${roomId}:${data.senderId}:rate`;
            const userCount = await RedisVideoService.incrementCache(userRateKey);
            
            if (userCount === 1) {
                await RedisVideoService.setCacheExpiry(userRateKey, 60); // 1 minute TTL
            }
            
            // Limit per user per minute
            const maxPerMinute = messageType === 'gift' ? 5 : 20;
            if (userCount > maxPerMinute) {
                return null; // Rate limit exceeded
            }
            
            // Cache message
            await RedisVideoService.cacheInteractiveMessage(roomId, messageType, data);
            
            return data;
        } catch (error) {
            console.error('Error optimizing interactive message:', error);
            return data;
        }
    }

    /**
     * Get optimized room statistics
     */
    public async getOptimizedRoomStats(roomId: string): Promise<any> {
        try {
            // Try to get from cache first
            const cachedStats = await RedisVideoService.getCachedRoomStats(roomId);
            if (cachedStats) {
                return cachedStats;
            }

            // If not in cache, calculate and cache
            const stats = await this.calculateRoomStats(roomId);
            await RedisVideoService.cacheRoomStats(roomId, stats, 300); // 5 minutes TTL
            
            return stats;
        } catch (error) {
            console.error('Error getting optimized room stats:', error);
            return null;
        }
    }

    /**
     * Calculate room statistics
     */
    private async calculateRoomStats(roomId: string): Promise<any> {
        // This would calculate various statistics
        // Implementation depends on your specific needs
        return {
            roomId,
            timestamp: Date.now(),
            // Add other stats as needed
        };
    }

    /**
     * Start periodic cleanup of old data
     */
    private startPeriodicCleanup(): void {
        setInterval(async () => {
            try {
                // Clean up old message queues
                const now = Date.now();
                for (const [key, messages] of this.messageQueue.entries()) {
                    const filteredMessages = messages.filter(msg => 
                        now - msg.timestamp < 60000 // Keep only last minute
                    );
                    this.messageQueue.set(key, filteredMessages);
                }

                // Clean up expired timers
                for (const [key, timer] of this.flushTimers.entries()) {
                    if (!this.messageQueue.has(key) || this.messageQueue.get(key)!.length === 0) {
                        clearTimeout(timer);
                        this.flushTimers.delete(key);
                    }
                }

                console.log('Performance optimizer cleanup completed');
            } catch (error) {
                console.error('Error during performance optimizer cleanup:', error);
            }
        }, 60000); // Run every minute
    }

    /**
     * Get current queue status
     */
    public getQueueStatus(): any {
        const status: any = {};
        for (const [key, messages] of this.messageQueue.entries()) {
            status[key] = {
                count: messages.length,
                oldestMessage: messages.length > 0 ? messages[0].timestamp : null,
                newestMessage: messages.length > 0 ? messages[messages.length - 1].timestamp : null
            };
        }
        return status;
    }

    /**
     * Adjust batch size based on room activity
     */
    public adjustBatchSize(roomId: string, activityLevel: 'low' | 'medium' | 'high'): void {
        switch (activityLevel) {
            case 'low':
                this.batchSize = 5;
                this.flushInterval = 200;
                break;
            case 'medium':
                this.batchSize = 10;
                this.flushInterval = 100;
                break;
            case 'high':
                this.batchSize = 20;
                this.flushInterval = 50;
                break;
        }
    }
}

export default PerformanceOptimizer.getInstance();
