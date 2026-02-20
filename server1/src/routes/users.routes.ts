import { Router, Response } from 'express';
import pool from '../db.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

// ───── GET ALL USERS (public profiles) ─────
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            'SELECT id, username, bio, avatar_url, color, created_at FROM users ORDER BY created_at ASC'
        );
        res.json(result.rows.map(u => ({
            id: u.id,
            username: u.username,
            bio: u.bio || '',
            avatarUrl: u.avatar_url || '',
            color: u.color,
            joinedAt: new Date(u.created_at).getTime(),
        })));
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
