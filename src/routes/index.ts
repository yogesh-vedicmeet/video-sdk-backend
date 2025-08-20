import express from "express";
import roomRoutes from "./roomRoutes";
import streamRoutes from "./streamRoutes";
import interactiveRoutes from "./interactiveRoutes";
import authRoutes from "./authRoutes";
import adminRoutes from "./adminRoutes";

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

export default router;
