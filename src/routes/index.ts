import express from "express";
import roomRoutes from "./roomRoutes";
import streamRoutes from "./streamRoutes";
import interactiveRoutes from "./interactiveRoutes";
import authRoutes from "./authRoutes";
import adminRoutes from "./adminRoutes";
import videoEventRoutes from "./videoEventRoutes";
import chatRoutes from "./chatRoutes";

const router = express.Router();

// Health check
router.get('/', (req: any, res: any) => {
    res.send('Video SDK API is running');
});

// API routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/rooms', roomRoutes);
router.use('/streams', streamRoutes);
router.use('/interactive', interactiveRoutes);
router.use('/video-events', videoEventRoutes);
router.use('/chat', chatRoutes);

export default router;
