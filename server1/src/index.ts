import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './routes/auth.routes.js';
import tripRoutes from './routes/trips.routes.js';
import locationRoutes from './routes/locations.routes.js';
import userRoutes from './routes/users.routes.js';

// Prevent process crashes
process.on('unhandledRejection', (err) => console.error('⚠️ Unhandled rejection:', err));
process.on('uncaughtException', (err) => console.error('⚠️ Uncaught exception:', err));

const app = express();

// Middleware
app.use(cors({ origin: config.frontendUrl }));
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

app.listen(config.port, () => {
    console.log(`🚀 TerraTales API running on http://localhost:${config.port}`);
});
