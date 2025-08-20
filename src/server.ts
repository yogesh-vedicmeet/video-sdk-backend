import sockets from "./sockets";

// worker.js
import express from "express";
import http from "http";
import https from "https";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import { createAdapter } from "@socket.io/mongo-adapter";
import { config } from "./config/config";
import { MongoClient } from "mongodb";
import fs from "fs";
import expressWinston from "express-winston";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import mongoose from "mongoose";
import morgan from "morgan";


console.log(config);

import routes from "./routes";

const app = express();

let server: http.Server | https.Server;
if (config.nodeEnv === 'production') {
    const privateKey = fs.readFileSync("/etc/letsencrypt/live/micro-services.vedicmeet.com/privkey.pem", "utf8");
    const certificate = fs.readFileSync("/etc/letsencrypt/live/micro-services.vedicmeet.com/fullchain.pem", "utf8");
    const credentials = { key: privateKey, cert: certificate };
    server = https.createServer(credentials, app);
} else {
    server = http.createServer(app);
}

const io = new SocketIOServer(server, {
    cors: {
        origin: "*", // Configure according to your frontend domain
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/api', routes);

// logger winston
const requestLogger = expressWinston.logger({
    transports: [
        // new winston.transports.Console(), // Log to the console for development
        new DailyRotateFile({
            filename: 'logs/%DATE%/info.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'info',
        }),
        new DailyRotateFile({
            filename: 'logs/%DATE%/error.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error',
        }),
        new DailyRotateFile({
            filename: 'logs/%DATE%/warn.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'warn',
        }),
    ],
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.prettyPrint()
    ),
    meta: true, // Disable logging metadata (such as response time)
    msg: 'HTTP {{req.method}} {{res.statusCode}} {{res.responseTime}}ms {{req.url}}',
    expressFormat: true,
    colorize: false,
});

app.use(requestLogger);


async function initializeServer() {
    let client;
    try {
        console.log('MONGO_URI', config.mongoUri);
        await mongoose.connect(config.mongoUri, {
            serverSelectionTimeoutMS: 5000
        }).then(() => console.log('connected to db')).catch((err: any) => console.error('db connection error:', err));

        client = await MongoClient.connect(config.mongoUri, {
            serverSelectionTimeoutMS: 5000
        });
        mongoose.set('debug', true);

        const db = client.db(config.mongoDbName);
        const mongoCollection = db.collection(config.socketIoCollection);

        await mongoCollection.createIndex(
            { createdAt: 1 },
            {
                expireAfterSeconds: 3600,
                background: true
            }
        );

        io.adapter(createAdapter(mongoCollection, {
            addCreatedAtField: true,
            // pingInterval: 30000,
            // pingTimeout: 5000,
            // cleanupInterval: 30000
        }));

        await cleanupOldDocuments(mongoCollection);

        // Initialize socket handlers
        sockets(io);

        const PORT = Number(config.port);
        console.log(`Starting server on port: ${PORT} (from config.port: ${config.port})`);
        server.listen(PORT, '0.0.0.0', (): void => {
            console.log(`⬆️ Worker is running on port ${PORT}`);
        });

    } catch (err) {
        console.error('Failed to initialize server:', err);
        if (client) {
            await client.close();
        }
        process.exit(1);
    }
}

async function cleanupOldDocuments(collection: any) {
    try {
        const oneHourAgo = new Date(Date.now() - 3600 * 1000); // One hour = 3600 seconds = 3600000 milliseconds
        const result = await collection.deleteMany({
            createdAt: { $lt: oneHourAgo }
        });
        console.log(`Cleaned up ${result.deletedCount} old adapter documents`);
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

// Add periodic cleanup
let mongoClient: any;
setInterval(async () => {
    try {
        if (!mongoClient) {
            mongoClient = await MongoClient.connect(config.mongoUri);
        }
        const collection = mongoClient.db(config.mongoDbName).collection(config.socketIoCollection);
        await cleanupOldDocuments(collection);
    } catch (error) {
        console.error('Periodic cleanup error:', error);
        if (mongoClient) {
            await mongoClient.close();
            mongoClient = null;
        }
    }
}, 3600000);

mongoose.connection.on('error', (err: any) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', (): void => {
    console.log('Mongoose disconnected');
});

process.on('SIGINT', async (): Promise<void> => {
    try {
        await mongoose.connection.close();
        if (mongoClient) {
            await mongoClient.close();
        }
        process.exit(0);
    } catch (err) {
        console.error('Error during shutdown:', err);
        process.exit(1);
    }
});

initializeServer();