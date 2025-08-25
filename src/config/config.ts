import dotenv from "dotenv";

dotenv.config();
export const config = {
    port: process.env.PORT || 3000,
    mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/astro',
    mongoDbName: process.env.MONGO_DB_NAME || 'astro',
    socketIoCollection: process.env.SOCKET_IO_COLLECTION || 'socketio',
    nodeEnv: process.env.NODE_ENV || 'development',
    livekitApiKey: process.env.LIVEKIT_API_KEY || '4e907b45c802a3f6d1962095703e5f7d',
    livekitApiSecret: process.env.LIVEKIT_API_SECRET || 'cac88733d2b6aff45eb51ffd2453f510242cc0663ef1faa26f2b6985d2b20881',
    livekitUrl: process.env.LIVEKIT_URL || 'ws://192.168.1.29:7880',
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisUrl: process.env.REDIS_URL || 'redis://192.168.1.29:6379',
    redisPort: process.env.REDIS_PORT || 6379,
    redisPassword: process.env.REDIS_PASSWORD || '',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    apiKey: process.env.API_KEY || 'your-api-key',
    corsOrigin: process.env.CORS_ORIGIN || '*',
};