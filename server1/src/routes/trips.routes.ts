import { Router, Response } from 'express';
import pool from '../db.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

/** Map a DB trip row to the API response shape */
function mapTrip(t: any) {
    return {
        id: t.id,
        userId: t.user_id,
        title: t.title,
        description: t.description,
        startDate: Number(t.start_date),
        endDate: t.end_date ? Number(t.end_date) : undefined,
        visibility: t.visibility,
        difficulty: t.difficulty || undefined,
        coverPhotoUrl: t.cover_photo_url || undefined,
        tags: t.tags || [],
        likes: t.likes || [],
        gpxData: t.gpx_data ? JSON.parse(t.gpx_data) : undefined,
        gpxStats: t.gpx_stats ? JSON.parse(t.gpx_stats) : undefined,
        packingItems: t.packing_items || [],
        packingList: t.packing_list || [],
        dayComments: t.day_comments || {},
        externalLinks: t.external_links || [],
    };
}

// ───── GET ALL TRIPS ─────
router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM trips ORDER BY created_at DESC');
        res.json(result.rows.map(mapTrip));
    } catch (err) {
        console.error('Get trips error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ───── CREATE TRIP ─────
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, startDate, endDate, visibility, difficulty, tags, coverPhotoUrl, gpxData, gpxStats, externalLinks, packingList, dayComments } = req.body;
        if (!title || !startDate) {
            return res.status(400).json({ error: 'Title and start date are required' });
        }

        const result = await pool.query(
            `INSERT INTO trips (user_id, title, description, start_date, end_date, visibility, difficulty, tags, cover_photo_url, gpx_data, gpx_stats, external_links, packing_list, day_comments)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
            [
                req.userId, title, description || '', startDate, endDate || null,
                visibility || 'private', difficulty || null, tags || [],
                coverPhotoUrl || null,
                gpxData ? JSON.stringify(gpxData) : null,
                gpxStats ? JSON.stringify(gpxStats) : null,
                JSON.stringify(externalLinks || []),
                packingList || [],
                JSON.stringify(dayComments || {}),
            ]
        );

        res.status(201).json(mapTrip(result.rows[0]));
    } catch (err) {
        console.error('Create trip error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ───── UPDATE TRIP ─────
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { title, description, startDate, endDate, visibility, difficulty, tags, coverPhotoUrl, gpxData, gpxStats, packingItems, externalLinks, packingList, dayComments } = req.body;

        const result = await pool.query(
            `UPDATE trips SET
                title = COALESCE($3, title),
                description = COALESCE($4, description),
                start_date = COALESCE($5, start_date),
                end_date = COALESCE($6, end_date),
                visibility = COALESCE($7, visibility),
                difficulty = COALESCE($8, difficulty),
                tags = COALESCE($9, tags),
                cover_photo_url = COALESCE($10, cover_photo_url),
                gpx_data = COALESCE($11, gpx_data),
                gpx_stats = COALESCE($12, gpx_stats),
                packing_items = COALESCE($13, packing_items),
                external_links = COALESCE($14, external_links),
                packing_list = COALESCE($15, packing_list),
                day_comments = COALESCE($16, day_comments)
            WHERE id = $1 AND user_id = $2 RETURNING *`,
            [
                id, req.userId, title, description, startDate, endDate,
                visibility, difficulty, tags, coverPhotoUrl,
                gpxData ? JSON.stringify(gpxData) : null,
                gpxStats ? JSON.stringify(gpxStats) : null,
                packingItems,
                externalLinks ? JSON.stringify(externalLinks) : null,
                packingList,
                dayComments ? JSON.stringify(dayComments) : null,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found or not owned by you' });
        }
        res.json(mapTrip(result.rows[0]));
    } catch (err) {
        console.error('Update trip error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ───── DELETE TRIP ─────
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        await pool.query('DELETE FROM trips WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
        res.json({ success: true });
    } catch (err) {
        console.error('Delete trip error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ───── TOGGLE VISIBILITY ─────
router.patch('/:id/visibility', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query(
            `UPDATE trips SET visibility = CASE WHEN visibility = 'public' THEN 'private' ELSE 'public' END
             WHERE id = $1 AND user_id = $2 RETURNING *`,
            [req.params.id, req.userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        res.json({ id: result.rows[0].id, visibility: result.rows[0].visibility });
    } catch (err) {
        console.error('Toggle visibility error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ───── LIKE TRIP ─────
router.post('/:id/like', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const trip = await pool.query('SELECT likes FROM trips WHERE id = $1', [req.params.id]);
        if (trip.rows.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }

        const likes: string[] = trip.rows[0].likes || [];
        const userId = req.userId!;
        const newLikes = likes.includes(userId)
            ? likes.filter(l => l !== userId)
            : [...likes, userId];

        await pool.query('UPDATE trips SET likes = $1 WHERE id = $2', [newLikes, req.params.id]);
        res.json({ likes: newLikes });
    } catch (err) {
        console.error('Like trip error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
