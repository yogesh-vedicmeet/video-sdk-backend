import Redis, { RedisOptions } from 'ioredis';
import { config } from '../config/config';

// Redis connection configuration
const redisConfig: RedisOptions = {
    host: config.redisHost,
    port: Number(config.redisPort),
    password: config.redisPassword,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
};

// Create Redis instance for commands
const redis = new Redis(redisConfig);

// Create separate subscriber instance for listening to events
const subscriber = new Redis(redisConfig);

// Store callback functions for different timer keys
const timerCallbacks = new Map<string, () => void>();

// Enable keyspace notifications for expired events
redis.config('SET', 'notify-keyspace-events', 'Ex');

// Subscribe to expired events
subscriber.subscribe('__keyevent@0__:expired', (err) => {
    if (err) {
        console.error('❌ Failed to subscribe to expired events:', err);
        return;
    }
    console.log('✅ Successfully subscribed to expired events');
});

// Listen for expired events
subscriber.on('message', (channel, key) => {
    if (channel === '__keyevent@0__:expired') {
        console.log(`⏰ Timer expired for key: ${key}`);
        // Execute callback if exists
        const callback = timerCallbacks.get(key);
        if (callback) {
            try {
                callback();
                timerCallbacks.delete(key);
                console.log(`✅ Callback executed for expired timer: ${key}`);
            } catch (error) {
                console.error(`❌ Error executing callback for timer ${key}:`, error);
            }
        }
    }
});

// Connection event handlers
redis.on('connect', () => {
    console.log('✅ Redis Timer connected successfully');
});

redis.on('ready', () => {
    console.log('🚀 Redis Timer ready to accept commands');
});

redis.on('error', (error) => {
    console.error('❌ Redis Timer connection error:', error);
});

redis.on('close', () => {
    console.log('🔌 Redis Timer connection closed');
});

redis.on('reconnecting', () => {
    console.log('🔄 Redis Timer reconnecting...');
});

// Subscriber event handlers
subscriber.on('connect', () => {
    console.log('✅ Redis Subscriber connected successfully');
});

subscriber.on('ready', () => {
    console.log('🚀 Redis Subscriber ready to accept commands');
});

subscriber.on('error', (error) => {
    console.error('❌ Redis Subscriber connection error:', error);
});

subscriber.on('close', () => {
    console.log('🔌 Redis Subscriber connection closed');
});

subscriber.on('reconnecting', () => {
    console.log('🔄 Redis Subscriber reconnecting...');
});

/**
 * Register a new timer in Redis
 * @param key - The unique key for the timer
 * @param seconds - Duration in seconds
 * @returns Promise<boolean> - Success status
 */
const registerTimer = async (key: string, seconds: number): Promise<boolean> => {
    try {
        await redis.setex(key, seconds, "pending");
        console.log(`⏰ Timer registered: ${key} for ${seconds} seconds`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to register timer for key: ${key}`, error);
        return false;
    }
};

/**
 * Extend an existing timer's duration
 * @param key - The unique key for the timer
 * @param additionalSeconds - Additional seconds to add
 * @returns Promise<boolean> - Success status
 */
const extendTimer = async (key: string, additionalSeconds: number): Promise<boolean> => {
    try {
        const ttl = await redis.ttl(key);

        if (ttl > 0) {
            await redis.expire(key, ttl + additionalSeconds);
            console.log(`⏰ Timer extended: ${key} by ${additionalSeconds} seconds (new TTL: ${ttl + additionalSeconds})`);
            return true;
        } else {
            console.log(`⚠️ Timer ${key} not found or already expired`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Failed to extend timer for key: ${key}`, error);
        return false;
    }
};

/**
 * Get remaining time for a timer
 * @param key - The unique key for the timer
 * @returns Promise<number> - Remaining time in seconds, -1 if expired/not found, -2 if doesn't exist
 */
const getRemainingTime = async (key: string): Promise<number> => {
    try {
        const exists = await redis.exists(key);
        if (!exists) {
            console.log(`⚠️ Timer ${key} does not exist`);
            return -2;
        }
        const ttl = await redis.ttl(key);
        console.log(`⏰ Timer ${key} remaining time: ${ttl} seconds`);
        return ttl;
    } catch (error) {
        console.error(`❌ Failed to get remaining time for key: ${key}`, error);
        return -1;
    }
};

/**
 * Check if a timer exists and is active
 * @param key - The unique key for the timer
 * @returns Promise<boolean> - Timer status
 */
const isTimerActive = async (key: string): Promise<boolean> => {
    try {
        const exists = await redis.exists(key);
        if (!exists) {
            console.log(`⚠️ Timer ${key} does not exist`);
            return false;
        }
        const ttl = await redis.ttl(key);
        const isActive = ttl > 0;
        console.log(`⏰ Timer ${key} active status: ${isActive} (TTL: ${ttl})`);
        return isActive;
    } catch (error) {
        console.error(`❌ Failed to check timer status for key: ${key}`, error);
        return false;
    }
};

/**
 * Cancel/delete an existing timer
 * @param key - The unique key for the timer
 * @returns Promise<boolean> - Success status
 */
const cancelTimer = async (key: string): Promise<boolean> => {
    try {
        const result = await redis.del(key);
        if (result === 1) {
            console.log(`✅ Timer cancelled: ${key}`);
            // Also remove callback if exists
            timerCallbacks.delete(key);
            return true;
        } else {
            console.log(`⚠️ Timer ${key} not found for cancellation`);
            return false;
        }
    } catch (error) {
        console.error(`❌ Failed to cancel timer for key: ${key}`, error);
        return false;
    }
};

/**
 * Register a timer with a callback function that will be executed when the timer expires
 * @param key - The unique key for the timer
 * @param seconds - Duration in seconds
 * @param callback - Function to execute when timer expires
 * @returns Promise<boolean> - Success status
 */
const registerTimerWithCallback = async (key: string, seconds: number, callback?: () => void): Promise<boolean> => {
    try {
        await redis.setex(key, seconds, "pending");
        if (callback) {
            timerCallbacks.set(key, callback);
            console.log(`⏰ Timer with callback registered: ${key} for ${seconds} seconds`);
        } else {
            console.log(`⏰ Timer registered: ${key} for ${seconds} seconds`);
        }
        return true;
    } catch (error) {
        console.error(`❌ Failed to register timer for key: ${key}`, error);
        return false;
    }
};

/**
 * Get all active timer keys
 * @param pattern - Pattern to match keys (default: '*')
 * @returns Promise<string[]> - Array of active timer keys
 */
const getActiveTimers = async (pattern: string = '*'): Promise<string[]> => {
    try {
        const keys = await redis.keys(pattern);
        const activeKeys: string[] = [];
        
        for (const key of keys) {
            const ttl = await redis.ttl(key);
            if (ttl > 0) {
                activeKeys.push(key);
            }
        }
        
        console.log(`📋 Found ${activeKeys.length} active timers matching pattern: ${pattern}`);
        return activeKeys;
    } catch (error) {
        console.error(`❌ Failed to get active timers for pattern: ${pattern}`, error);
        return [];
    }
};

/**
 * Clear all timers (use with caution)
 * @param pattern - Pattern to match keys (default: '*')
 * @returns Promise<number> - Number of timers cleared
 */
const clearAllTimers = async (pattern: string = '*'): Promise<number> => {
    try {
        const keys = await redis.keys(pattern);
        if (keys.length === 0) {
            console.log('📋 No timers found to clear');
            return 0;
        }
        
        const result = await redis.del(...keys);
        console.log(`🗑️ Cleared ${result} timers matching pattern: ${pattern}`);
        
        // Clear all callbacks
        timerCallbacks.clear();
        
        return result;
    } catch (error) {
        console.error(`❌ Failed to clear timers for pattern: ${pattern}`, error);
        return 0;
    }
};

/**
 * Get timer statistics
 * @returns Promise<object> - Timer statistics
 */
const getTimerStats = async (): Promise<{
    totalActiveTimers: number;
    totalCallbacks: number;
    redisConnected: boolean;
    subscriberConnected: boolean;
}> => {
    try {
        const activeTimers = await getActiveTimers();
        const stats = {
            totalActiveTimers: activeTimers.length,
            totalCallbacks: timerCallbacks.size,
            redisConnected: redis.status === 'ready',
            subscriberConnected: subscriber.status === 'ready'
        };
        
        console.log('📊 Timer Statistics:', stats);
        return stats;
    } catch (error) {
        console.error('❌ Failed to get timer statistics:', error);
        return {
            totalActiveTimers: 0,
            totalCallbacks: 0,
            redisConnected: false,
            subscriberConnected: false
        };
    }
};

/**
 * Gracefully close Redis connections
 */
const closeConnections = async (): Promise<void> => {
    try {
        console.log('🛑 Closing Redis connections...');
        
        // Clear all callbacks
        timerCallbacks.clear();
        
        // Close connections
        await Promise.all([
            redis.quit(),
            subscriber.quit()
        ]);
        
        console.log('✅ Redis connections closed successfully');
    } catch (error) {
        console.error('❌ Error closing Redis connections:', error);
    }
};

// Export all functions and instances
export {
    redis,
    subscriber,
    registerTimer,
    extendTimer,
    getRemainingTime,
    isTimerActive,
    cancelTimer,
    registerTimerWithCallback,
    getActiveTimers,
    clearAllTimers,
    getTimerStats,
    closeConnections
};

// Default export for convenience
export default {
    redis,
    subscriber,
    registerTimer,
    extendTimer,
    getRemainingTime,
    isTimerActive,
    cancelTimer,
    registerTimerWithCallback,
    getActiveTimers,
    clearAllTimers,
    getTimerStats,
    closeConnections
};
