import { Router, Response } from 'express';
import pool from '../db.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

// ───── GET ALL USERS (public info only) ─────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query('SELECT id, username, email, bio, avatar_url, color, created_at FROM users WHERE verified = TRUE');
        const users = result.rows.map(u => ({
            id: u.id,
            username: u.username,
            email: u.email,
            bio: u.bio,
            avatarUrl: u.avatar_url,
            color: u.color,
            joinedAt: new Date(u.created_at).getTime(),
            bookmarks: [],
        }));
        res.json(users);
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
