import { Router, Response } from 'express';
import pool from '../db.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

// Helper to map DB row to API shape
const mapLocation = (l: any) => ({
    id: l.id,
    tripId: l.trip_id,
    userId: l.user_id,
    coords: { lat: l.lat, lng: l.lng },
    title: l.title,
    comment: l.comment,
    photoUrl: l.photo_url,
    type: l.type,
    timestamp: Number(l.timestamp),
});

// ───── GET ALL LOCATIONS ─────
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM locations ORDER BY timestamp ASC');
        res.json(result.rows.map(mapLocation));
    } catch (err) {
        console.error('Get locations error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ───── CREATE LOCATION ─────
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { tripId, coords, title, comment, photoUrl, type, timestamp } = req.body;
        if (!tripId || !coords || !title) {
            return res.status(400).json({ error: 'tripId, coords, and title are required' });
        }

        // Verify user owns the trip
        const trip = await pool.query('SELECT id FROM trips WHERE id = $1 AND user_id = $2', [tripId, req.userId]);
        if (trip.rows.length === 0) {
            return res.status(403).json({ error: 'You can only add locations to your own trips' });
        }

        const finalTimestamp = timestamp || Date.now();
        const result = await pool.query(
            `INSERT INTO locations (trip_id, user_id, lat, lng, title, comment, photo_url, type, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [tripId, req.userId, coords.lat, coords.lng, title, comment || '', photoUrl || '', type || 'adventure', finalTimestamp]
        );

        res.status(201).json(mapLocation(result.rows[0]));
    } catch (err) {
        console.error('Create location error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ───── UPDATE LOCATION ─────
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title, comment, type, timestamp } = req.body;

        const result = await pool.query(
            `UPDATE locations SET
                title = COALESCE($3, title),
                comment = COALESCE($4, comment),
                type = COALESCE($5, type),
                timestamp = COALESCE($6, timestamp)
            WHERE id = $1 AND user_id = $2 RETURNING *`,
            [id, req.userId, title, comment, type, timestamp]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Location not found or not owned by you' });
        res.json(mapLocation(result.rows[0]));
    } catch (err) {
        console.error('Update location error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ───── DELETE LOCATION ─────
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM locations WHERE id = $1 AND user_id = $2', [id, req.userId]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete location error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
