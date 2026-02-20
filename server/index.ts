import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import tripRoutes from './routes/trips.js';
import locationRoutes from './routes/locations.js';
import userRoutes from './routes/users.js';

dotenv.config();

// Prevent process crashes
process.on('unhandledRejection', (err) => {
    console.error('⚠️ Unhandled rejection:', err);
});
process.on('uncaughtException', (err) => {
    console.error('⚠️ Uncaught exception:', err);
});

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 TrailThread API running on http://localhost:${PORT}`);
});
