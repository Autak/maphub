"""
TerraTales v2 Restoration Script
Run with: python restore_v2.py
Creates v2/server and v2/client with all source files.
"""
import os

BASE = os.path.dirname(os.path.abspath(__file__))
SERVER = os.path.join(BASE, 'v2', 'server')
CLIENT = os.path.join(BASE, 'v2', 'client')

def w(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  wrote {os.path.relpath(path, BASE)}')

print('==> Creating v2/server files...')

w(f'{SERVER}/package.json', """{
  "name": "terratales-server",
  "version": "2.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.3",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.11.3",
    "resend": "^3.2.0",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^20.11.30",
    "@types/pg": "^8.11.2",
    "@types/uuid": "^9.0.8",
    "tsx": "^4.7.1",
    "typescript": "^5.4.2"
  }
}
""")

w(f'{SERVER}/tsconfig.json', """{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
""")

w(f'{SERVER}/.env.example', """# Copy this file to .env and fill in your values
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
JWT_SECRET=change_this_to_a_long_random_secret
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=http://localhost:3000
PORT=3001
""")

w(f'{SERVER}/src/config.ts', """import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required env var: ${key}`);
    return val;
}

export const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    databaseUrl: required('DATABASE_URL'),
    jwtSecret: required('JWT_SECRET'),
    resendApiKey: process.env.RESEND_API_KEY || '',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    nodeEnv: process.env.NODE_ENV || 'development',
};
""")

w(f'{SERVER}/src/db.ts', """import { Pool } from 'pg';
import { config } from './config';

export const db = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
});

db.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});
""")

w(f'{SERVER}/src/middleware/auth.ts', """import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthRequest extends Request {
    userId?: string;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.slice(7);
    try {
        const payload = jwt.verify(token, config.jwtSecret) as { userId: string };
        req.userId = payload.userId;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}
""")

w(f'{SERVER}/src/routes/auth.routes.ts', """import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { config } from '../config';
import { authenticate, AuthRequest } from '../middleware/auth';
import { Resend } from 'resend';

const router = Router();
const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

// POST /api/auth/register
router.post('/register', async (req, res: Response) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'username, email, and password are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const existing = await db.query(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email.toLowerCase(), username]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email or username already taken' });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const verifyToken = uuidv4();
        const colors = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        const result = await db.query(
            `INSERT INTO users (id, username, email, password_hash, color, verify_token, verified, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
            [uuidv4(), username, email.toLowerCase(), passwordHash, color, verifyToken, !resend]
        );

        if (resend) {
            await resend.emails.send({
                from: 'TerraTales <noreply@terratales.app>',
                to: email,
                subject: 'Verify your TerraTales account',
                html: `<h2>Welcome to TerraTales!</h2>
                       <p>Click the link below to verify your account:</p>
                       <a href="${config.frontendUrl}/verify?token=${verifyToken}">Verify Email</a>`,
            });
            return res.status(201).json({ message: 'Registration successful! Please check your email to verify.', autoVerified: false });
        }

        return res.status(201).json({ message: 'Account created successfully!', autoVerified: true });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await db.query(
            'SELECT id, username, email, password_hash, color, bio, avatar_url, verified FROM users WHERE email = $1',
            [email.toLowerCase()]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        if (!user.verified) {
            return res.status(403).json({ error: 'Please verify your email before logging in' });
        }

        const token = jwt.sign({ userId: user.id }, config.jwtSecret, { expiresIn: '30d' });
        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                color: user.color,
                bio: user.bio || '',
                avatarUrl: user.avatar_url || '',
            },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/auth/verify?token=xxx
router.get('/verify', async (req, res: Response) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: 'Token required' });

        const result = await db.query(
            'UPDATE users SET verified = true, verify_token = NULL WHERE verify_token = $1 RETURNING id',
            [token]
        );
        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }
        res.json({ message: 'Email verified! You can now log in.' });
    } catch (err) {
        console.error('Verify error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const result = await db.query(
            'SELECT id, username, email, color, bio, avatar_url FROM users WHERE id = $1',
            [req.userId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const u = result.rows[0];
        res.json({ id: u.id, username: u.username, email: u.email, color: u.color, bio: u.bio || '', avatarUrl: u.avatar_url || '' });
    } catch (err) {
        console.error('Get me error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/auth/profile
router.put('/profile', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { username, bio, avatarUrl } = req.body;
        const result = await db.query(
            'UPDATE users SET username = COALESCE($1, username), bio = COALESCE($2, bio), avatar_url = COALESCE($3, avatar_url) WHERE id = $4 RETURNING id, username, email, color, bio, avatar_url',
            [username || null, bio ?? null, avatarUrl || null, req.userId]
        );
        const u = result.rows[0];
        res.json({ id: u.id, username: u.username, email: u.email, color: u.color, bio: u.bio || '', avatarUrl: u.avatar_url || '' });
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
""")

w(f'{SERVER}/src/routes/trips.routes.ts', """import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/trips — all public + user's own
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const result = await db.query(
            `SELECT t.*, u.username, u.color FROM trips t
             JOIN users u ON u.id = t.user_id
             WHERE t.visibility = 'public' OR t.user_id = $1
             ORDER BY t.created_at DESC`,
            [req.userId]
        );
        res.json(result.rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            title: row.title,
            description: row.description || '',
            startDate: new Date(row.start_date).getTime(),
            endDate: row.end_date ? new Date(row.end_date).getTime() : null,
            visibility: row.visibility,
            difficulty: row.difficulty || '',
            tags: row.tags || [],
            likes: row.likes || [],
            gpxData: row.gpx_data || null,
            gpxStats: row.gpx_stats || null,
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/trips
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { title, description, startDate, visibility, difficulty, tags, gpxData, gpxStats } = req.body;
        if (!title) return res.status(400).json({ error: 'Title is required' });
        const id = uuidv4();
        await db.query(
            `INSERT INTO trips (id, user_id, title, description, start_date, visibility, difficulty, tags, likes, gpx_data, gpx_stats, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
            [id, req.userId, title, description || '', startDate ? new Date(startDate) : new Date(),
             visibility || 'private', difficulty || null, JSON.stringify(tags || []),
             JSON.stringify([]), gpxData ? JSON.stringify(gpxData) : null, gpxStats ? JSON.stringify(gpxStats) : null]
        );
        const trip = await db.query('SELECT * FROM trips WHERE id = $1', [id]);
        const t = trip.rows[0];
        res.status(201).json({
            id: t.id, userId: t.user_id, title: t.title, description: t.description || '',
            startDate: new Date(t.start_date).getTime(), visibility: t.visibility,
            difficulty: t.difficulty || '', tags: t.tags || [], likes: t.likes || [],
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/trips/:id
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const check = await db.query('SELECT user_id FROM trips WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
        if (check.rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        const { title, description, visibility, difficulty, tags } = req.body;
        const result = await db.query(
            `UPDATE trips SET title=COALESCE($1,title), description=COALESCE($2,description),
             visibility=COALESCE($3,visibility), difficulty=COALESCE($4,difficulty), tags=COALESCE($5,tags)
             WHERE id=$6 RETURNING *`,
            [title, description, visibility, difficulty, tags ? JSON.stringify(tags) : null, id]
        );
        const t = result.rows[0];
        res.json({ id: t.id, userId: t.user_id, title: t.title, description: t.description || '',
            startDate: new Date(t.start_date).getTime(), visibility: t.visibility,
            difficulty: t.difficulty || '', tags: t.tags || [], likes: t.likes || [] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/trips/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const check = await db.query('SELECT user_id FROM trips WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
        if (check.rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        await db.query('DELETE FROM locations WHERE trip_id = $1', [id]);
        await db.query('DELETE FROM trips WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/trips/:id/visibility
router.patch('/:id/visibility', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const check = await db.query('SELECT user_id, visibility FROM trips WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
        if (check.rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        const newVis = check.rows[0].visibility === 'public' ? 'private' : 'public';
        await db.query('UPDATE trips SET visibility = $1 WHERE id = $2', [newVis, id]);
        res.json({ id, visibility: newVis });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/trips/:id/like
router.post('/:id/like', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const trip = await db.query('SELECT likes FROM trips WHERE id = $1', [id]);
        if (trip.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
        let likes: string[] = trip.rows[0].likes || [];
        if (likes.includes(req.userId!)) {
            likes = likes.filter(l => l !== req.userId);
        } else {
            likes.push(req.userId!);
        }
        await db.query('UPDATE trips SET likes = $1 WHERE id = $2', [JSON.stringify(likes), id]);
        res.json({ likes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
""")

w(f'{SERVER}/src/routes/locations.routes.ts', """import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/locations
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const result = await db.query(
            `SELECT l.* FROM locations l
             JOIN trips t ON t.id = l.trip_id
             WHERE t.visibility = 'public' OR t.user_id = $1
             ORDER BY l.timestamp ASC`,
            [req.userId]
        );
        res.json(result.rows.map(r => ({
            id: r.id,
            tripId: r.trip_id,
            userId: r.user_id,
            title: r.title,
            comment: r.comment || '',
            type: r.type || 'adventure',
            photoUrl: r.photo_url || '',
            coords: { lat: parseFloat(r.lat), lng: parseFloat(r.lng) },
            timestamp: new Date(r.timestamp).getTime(),
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/locations
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { tripId, title, comment, type, photoUrl, coords, timestamp } = req.body;
        if (!tripId || !title || !coords) return res.status(400).json({ error: 'tripId, title, and coords required' });

        const tripCheck = await db.query('SELECT user_id FROM trips WHERE id = $1', [tripId]);
        if (tripCheck.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
        if (tripCheck.rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });

        const id = uuidv4();
        await db.query(
            `INSERT INTO locations (id, trip_id, user_id, title, comment, type, photo_url, lat, lng, timestamp, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
            [id, tripId, req.userId, title, comment || '', type || 'adventure', photoUrl || '',
             coords.lat, coords.lng, timestamp ? new Date(timestamp) : new Date()]
        );
        res.status(201).json({
            id, tripId, userId: req.userId!, title, comment: comment || '',
            type: type || 'adventure', photoUrl: photoUrl || '',
            coords, timestamp: timestamp || Date.now(),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/locations/:id
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const check = await db.query('SELECT user_id FROM locations WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        if (check.rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        const { title, comment, type } = req.body;
        const r = await db.query(
            'UPDATE locations SET title=COALESCE($1,title), comment=COALESCE($2,comment), type=COALESCE($3,type) WHERE id=$4 RETURNING *',
            [title, comment, type, id]
        );
        const loc = r.rows[0];
        res.json({ id: loc.id, tripId: loc.trip_id, userId: loc.user_id, title: loc.title,
            comment: loc.comment || '', type: loc.type, photoUrl: loc.photo_url || '',
            coords: { lat: parseFloat(loc.lat), lng: parseFloat(loc.lng) },
            timestamp: new Date(loc.timestamp).getTime() });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/locations/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const check = await db.query('SELECT user_id FROM locations WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        if (check.rows[0].user_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
        await db.query('DELETE FROM locations WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
""")

w(f'{SERVER}/src/routes/users.routes.ts', """import { Router, Response } from 'express';
import { db } from '../db';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/users
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
    try {
        const result = await db.query('SELECT id, username, color, bio, avatar_url FROM users ORDER BY username');
        res.json(result.rows.map(u => ({
            id: u.id, username: u.username, color: u.color, bio: u.bio || '', avatarUrl: u.avatar_url || '',
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
""")

w(f'{SERVER}/src/index.ts', """import express from 'express';
import cors from 'cors';
import { config } from './config';
import authRouter from './routes/auth.routes';
import tripsRouter from './routes/trips.routes';
import locationsRouter from './routes/locations.routes';
import usersRouter from './routes/users.routes';

const app = express();

app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/trips', tripsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/users', usersRouter);

app.listen(config.port, () => {
    console.log(`🚀 TerraTales API running on http://localhost:${config.port}`);
});
""")

print('==> Creating v2/client files...')

w(f'{CLIENT}/package.json', """{
  "name": "terratales-client",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "leaflet": "^1.9.4",
    "lucide-react": "^0.358.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-leaflet": "^4.2.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.8",
    "@types/node": "^20.11.30",
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@types/uuid": "^9.0.8",
    "@vitejs/plugin-react": "4.2.1",
    "typescript": "^5.4.2",
    "vite": "5.4.11"
  }
}
""")

w(f'{CLIENT}/tsconfig.json', """{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "types": ["node"]
  },
  "include": ["src"]
}
""")

w(f'{CLIENT}/vite.config.ts', """import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    resolve: {
        // Required for Windows symlinked drives with special characters in path
        preserveSymlinks: true,
    },
});
""")

w(f'{CLIENT}/.env', """VITE_MAPY_API_KEY=your_mapy_cz_api_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
""")

w(f'{CLIENT}/index.html', """<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="TerraTales - Share your hiking adventures with interactive maps" />
    <title>TerraTales</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  </head>
  <body>
    <div id="root" style="height:100vh;width:100vw;overflow:hidden;"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
""")

w(f'{CLIENT}/src/main.tsx', """import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AuthProvider>
            <App />
        </AuthProvider>
    </React.StrictMode>
);
""")

w(f'{CLIENT}/src/types.ts', """export type LocationType = 'adventure' | 'camp' | 'summit' | 'water' | 'food' | 'danger' | 'photo' | 'rest';
export type Visibility = 'public' | 'private';
export type Difficulty = 'easy' | 'moderate' | 'hard' | 'extreme';

export interface Coordinates {
    lat: number;
    lng: number;
}

export interface User {
    id: string;
    username: string;
    email: string;
    color: string;
    bio?: string;
    avatarUrl?: string;
}

export interface MapLocation {
    id: string;
    tripId: string;
    userId: string;
    title: string;
    comment: string;
    type: LocationType;
    photoUrl: string;
    coords: Coordinates;
    timestamp: number;
}

export interface Trip {
    id: string;
    userId: string;
    title: string;
    description: string;
    startDate: number;
    endDate?: number;
    visibility: Visibility;
    difficulty?: Difficulty;
    tags: string[];
    likes: string[];
    gpxData?: { lat: number; lng: number; ele?: number }[];
    gpxStats?: { distanceKm: number; estimatedDays: number };
}
""")

w(f'{CLIENT}/src/constants.ts', """export const MAPY_API_KEY = import.meta.env.VITE_MAPY_API_KEY || '';

export const TILE_LAYERS = {
    outdoor: {
        url: `https://api.mapy.cz/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
        name: 'Outdoor',
    },
    aerial: {
        url: `https://api.mapy.cz/v1/maptiles/aerial/256/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
        name: 'Aerial',
    },
    winter: {
        url: `https://api.mapy.cz/v1/maptiles/winter/256/{z}/{x}/{y}?apikey=${MAPY_API_KEY}`,
        name: 'Winter',
    },
};

export const LOCATION_TYPES = [
    { value: 'adventure', label: 'Adventure', emoji: '🏔️', color: '#3b82f6' },
    { value: 'camp',      label: 'Camp',      emoji: '⛺',  color: '#10b981' },
    { value: 'summit',    label: 'Summit',    emoji: '🗻',  color: '#f59e0b' },
    { value: 'water',     label: 'Water',     emoji: '💧',  color: '#06b6d4' },
    { value: 'food',      label: 'Food',      emoji: '🍽️',  color: '#f97316' },
    { value: 'danger',    label: 'Danger',    emoji: '⚠️',  color: '#ef4444' },
    { value: 'photo',     label: 'Photo',     emoji: '📷',  color: '#8b5cf6' },
    { value: 'rest',      label: 'Rest',      emoji: '🛖',  color: '#84cc16' },
];

export const DIFFICULTY_LEVELS = [
    { value: 'easy',     label: 'Easy',     color: '#10b981' },
    { value: 'moderate', label: 'Moderate', color: '#f59e0b' },
    { value: 'hard',     label: 'Hard',     color: '#ef4444' },
    { value: 'extreme',  label: 'Extreme',  color: '#7c3aed' },
];

export const TRIP_TAGS = [
    'Hiking', 'Cycling', 'Running', 'Skiing', 'Climbing', 'Camping',
    'Photography', 'Wildlife', 'Historical', 'Solo', 'Family', 'Dog-Friendly',
];
""")

w(f'{CLIENT}/src/api/client.ts', """import { User, Trip, MapLocation } from '../types';

// Direct URL to avoid proxy issues with Windows symlinks
const API_BASE = 'http://localhost:3001/api';

function getToken(): string | null { return localStorage.getItem('token'); }
export function setToken(t: string) { localStorage.setItem('token', t); }
export function clearToken() { localStorage.removeItem('token'); }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `Request failed: ${res.status}`);
    }
    return res.json();
}

export interface LoginResponse { token: string; user: User; }
export interface RegisterResponse { message: string; autoVerified: boolean; }

export const api = {
    register: (d: { username: string; email: string; password: string }) =>
        request<RegisterResponse>('/auth/register', { method: 'POST', body: JSON.stringify(d) }),
    login: (d: { email: string; password: string }) =>
        request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(d) }),
    getMe: () => request<User>('/auth/me'),
    updateProfile: (d: { username?: string; bio?: string }) =>
        request<User>('/auth/profile', { method: 'PUT', body: JSON.stringify(d) }),
    getTrips: () => request<Trip[]>('/trips'),
    createTrip: (d: Partial<Trip>) =>
        request<Trip>('/trips', { method: 'POST', body: JSON.stringify(d) }),
    updateTrip: (id: string, d: Partial<Trip>) =>
        request<Trip>(`/trips/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteTrip: (id: string) =>
        request<{ success: boolean }>(`/trips/${id}`, { method: 'DELETE' }),
    toggleVisibility: (id: string) =>
        request<{ id: string; visibility: string }>(`/trips/${id}/visibility`, { method: 'PATCH' }),
    likeTrip: (id: string) =>
        request<{ likes: string[] }>(`/trips/${id}/like`, { method: 'POST' }),
    getLocations: () => request<MapLocation[]>('/locations'),
    createLocation: (d: Partial<MapLocation>) =>
        request<MapLocation>('/locations', { method: 'POST', body: JSON.stringify(d) }),
    updateLocation: (id: string, d: { title?: string; comment?: string; type?: string }) =>
        request<MapLocation>(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteLocation: (id: string) =>
        request<{ success: boolean }>(`/locations/${id}`, { method: 'DELETE' }),
    getUsers: () => request<User[]>('/users'),
};
""")

w(f'{CLIENT}/src/hooks/useAuth.tsx', """import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api, setToken, clearToken, LoginResponse, RegisterResponse } from '../api/client';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<User>;
    register: (username: string, email: string, password: string) => Promise<RegisterResponse>;
    logout: () => void;
    updateUser: (u: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const restore = async () => {
            const token = localStorage.getItem('token');
            if (!token) { setIsLoading(false); return; }
            try {
                // 5 second timeout to prevent infinite loading
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 5000);
                const me = await api.getMe();
                clearTimeout(timeout);
                setUser(me);
            } catch {
                clearToken();
            } finally {
                setIsLoading(false);
            }
        };
        restore();
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<User> => {
        const res: LoginResponse = await api.login({ email, password });
        setToken(res.token);
        setUser(res.user);
        return res.user;
    }, []);

    const register = useCallback(async (username: string, email: string, password: string) =>
        api.register({ username, email, password }), []);

    const logout = useCallback(() => { clearToken(); setUser(null); }, []);
    const updateUser = useCallback((u: User) => setUser(u), []);

    return (
        <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export function useAuth(): AuthContextType {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
""")

w(f'{CLIENT}/src/utils/gpxParser.ts', """export function parseGPX(gpxText: string): { lat: number; lng: number; ele?: number }[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxText, 'application/xml');
    const points: { lat: number; lng: number; ele?: number }[] = [];
    const trkpts = doc.querySelectorAll('trkpt');
    trkpts.forEach(pt => {
        const lat = parseFloat(pt.getAttribute('lat') || '0');
        const lng = parseFloat(pt.getAttribute('lon') || '0');
        const eleEl = pt.querySelector('ele');
        const ele = eleEl ? parseFloat(eleEl.textContent || '0') : undefined;
        if (!isNaN(lat) && !isNaN(lng)) points.push({ lat, lng, ele });
    });
    return points;
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function calculateGPXStats(points: { lat: number; lng: number }[]): { distanceKm: number; estimatedDays: number } {
    let dist = 0;
    for (let i = 1; i < points.length; i++) dist += haversine(points[i - 1], points[i]);
    return { distanceKm: Math.round(dist * 10) / 10, estimatedDays: Math.max(1, Math.ceil(dist / 25)) };
}
""")

w(f'{CLIENT}/src/utils/tripStats.ts', """import { MapLocation } from '../types';

export function computeTripStats(locations: MapLocation[]) {
    const stops = locations.length;
    if (stops === 0) return { stops: 0, days: 0, distanceKm: 0 };
    const sorted = [...locations].sort((a, b) => a.timestamp - b.timestamp);
    const startDay = new Date(sorted[0].timestamp).setHours(0,0,0,0);
    const endDay = new Date(sorted[sorted.length - 1].timestamp).setHours(0,0,0,0);
    const days = Math.max(1, Math.round((endDay - startDay) / 86400000) + 1);
    return { stops, days, distanceKm: 0 };
}
""")

w(f'{CLIENT}/src/utils/imageService.ts', """export function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const scale = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = url;
    });
}
""")

w(f'{CLIENT}/src/utils/achievements.ts', """import { User, Trip, MapLocation } from '../types';

export interface Achievement {
    id: string;
    name: string;
    description: string;
    unlocked: boolean;
}

const DEFS = [
    { id: 'first_trip',    name: 'First Steps',     description: 'Create your first trip',         check: (_u: User, trips: Trip[]) => trips.length >= 1 },
    { id: 'five_trips',    name: 'Adventurer',       description: 'Create 5 trips',                 check: (_u: User, trips: Trip[]) => trips.length >= 5 },
    { id: 'ten_trips',     name: 'Explorer',         description: 'Create 10 trips',                check: (_u: User, trips: Trip[]) => trips.length >= 10 },
    { id: 'first_loc',     name: 'Pin Dropper',      description: 'Add your first location',        check: (_u: User, _t: Trip[], locs: MapLocation[]) => locs.length >= 1 },
    { id: 'fifty_locs',    name: 'Cartographer',     description: 'Add 50 locations',               check: (_u: User, _t: Trip[], locs: MapLocation[]) => locs.length >= 50 },
    { id: 'public_trip',   name: 'Storyteller',      description: 'Share a public trip',            check: (_u: User, trips: Trip[]) => trips.some(t => t.visibility === 'public') },
    { id: 'got_likes',     name: 'Popular Trails',   description: 'Get 10 likes on a trip',         check: (_u: User, trips: Trip[]) => trips.some(t => t.likes.length >= 10) },
    { id: 'has_gpx',       name: 'Track Master',     description: 'Upload a GPX track',             check: (_u: User, trips: Trip[]) => trips.some(t => t.gpxData && t.gpxData.length > 0) },
];

export function getUserAchievements(user: User, trips: Trip[], locations: MapLocation[]): Achievement[] {
    const userTrips = trips.filter(t => t.userId === user.id);
    const userLocs = locations.filter(l => l.userId === user.id);
    return DEFS.map(d => ({
        id: d.id, name: d.name, description: d.description,
        unlocked: d.check(user, userTrips, userLocs),
    }));
}
""")

w(f'{CLIENT}/src/utils/packingRules.ts', """export interface PackingItem { name: string; category: string; }

const BASE_ITEMS: PackingItem[] = [
    { name: 'Hiking boots', category: 'Footwear' },
    { name: 'Moisture-wicking socks', category: 'Clothing' },
    { name: 'First aid kit', category: 'Safety' },
    { name: 'Water bottle (2L)', category: 'Hydration' },
    { name: 'Map & compass', category: 'Navigation' },
    { name: 'Headlamp + batteries', category: 'Light' },
    { name: 'Emergency whistle', category: 'Safety' },
    { name: 'Sunscreen SPF50+', category: 'Health' },
    { name: 'Snacks / trail mix', category: 'Food' },
    { name: 'Rain jacket', category: 'Clothing' },
    { name: 'Phone charger', category: 'Electronics' },
];

const TAG_ITEMS: Record<string, PackingItem[]> = {
    Camping: [
        { name: 'Tent + pegs + poles', category: 'Shelter' },
        { name: 'Sleeping bag', category: 'Sleep' },
        { name: 'Sleeping mat', category: 'Sleep' },
        { name: 'Camp stove + fuel', category: 'Cooking' },
        { name: 'Cookware set', category: 'Cooking' },
    ],
    Skiing: [
        { name: 'Ski goggles', category: 'Protection' },
        { name: 'Ski gloves', category: 'Clothing' },
        { name: 'Thermal baselayer', category: 'Clothing' },
        { name: 'Avalanche beacon', category: 'Safety' },
    ],
    Photography: [
        { name: 'Camera + lenses', category: 'Electronics' },
        { name: 'Extra batteries', category: 'Electronics' },
        { name: 'Tripod', category: 'Electronics' },
    ],
    Cycling: [
        { name: 'Helmet', category: 'Safety' },
        { name: 'Repair kit', category: 'Tools' },
        { name: 'Cycling gloves', category: 'Clothing' },
    ],
};

export function generatePackingList(tags: string[], difficulty: string): PackingItem[] {
    const items = [...BASE_ITEMS];
    tags.forEach(tag => {
        if (TAG_ITEMS[tag]) items.push(...TAG_ITEMS[tag]);
    });
    if (difficulty === 'hard' || difficulty === 'extreme') {
        items.push({ name: 'Emergency bivvy', category: 'Safety' });
        items.push({ name: 'Satellite communicator', category: 'Safety' });
    }
    // Deduplicate
    const seen = new Set<string>();
    return items.filter(i => { const k = i.name; if (seen.has(k)) return false; seen.add(k); return true; });
}
""")

# ── Styles ──────────────────────────────────────────────

w(f'{CLIENT}/src/styles/index.css', """/* TerraTales v2 Design System */
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --blue-500: #3b82f6;
  --green-500: #10b981;
  --slate-50: #f8fafc;
  --slate-100: #f1f5f9;
  --slate-200: #e2e8f0;
  --slate-300: #cbd5e1;
  --slate-400: #94a3b8;
  --slate-500: #64748b;
  --slate-600: #475569;
  --slate-700: #334155;
  --slate-800: #1e293b;
  --slate-900: #0f172a;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.12);
  --shadow-lg: 0 10px 30px rgba(0,0,0,0.15);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-full: 9999px;
}

*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root { height: 100%; width: 100%; overflow: hidden; }

body {
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--slate-800);
  background: var(--slate-50);
  -webkit-font-smoothing: antialiased;
}

.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: var(--radius-md);
  border: none; cursor: pointer; font-size: 14px; font-weight: 600;
  font-family: var(--font-sans); transition: all 0.15s; white-space: nowrap;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--slate-800); color: white; }
.btn-primary:hover:not(:disabled) { background: var(--slate-900); }
.btn-secondary { background: var(--slate-100); color: var(--slate-700); }
.btn-secondary:hover:not(:disabled) { background: var(--slate-200); }
.btn-ghost { background: transparent; color: var(--slate-500); }
.btn-ghost:hover:not(:disabled) { background: var(--slate-100); }
.btn-sm { padding: 5px 10px; font-size: 12px; }
.btn-icon { padding: 6px; border-radius: var(--radius-sm); }

.input {
  width: 100%; padding: 10px 12px;
  border: 1.5px solid var(--slate-200); border-radius: var(--radius-md);
  font-family: var(--font-sans); font-size: 14px; color: var(--slate-800);
  background: white; outline: none; transition: border-color 0.15s;
}
.input:focus { border-color: var(--blue-500); }
.input::placeholder { color: var(--slate-400); }
textarea.input { resize: vertical; }

.label { display: block; font-size: 12px; font-weight: 600; color: var(--slate-500); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }

.card { background: white; border-radius: var(--radius-lg); border: 1px solid var(--slate-100); box-shadow: var(--shadow-sm); }

.badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-full); font-size: 11px; font-weight: 600; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(4px); padding: 16px; }
.modal-content { background: white; border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; }

@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes spin    { to { transform: rotate(360deg); } }

.animate-slideUp { animation: slideUp 0.4s ease forwards; }
.animate-spin    { animation: spin 0.8s linear infinite; }

/* Leaflet overrides */
.leaflet-container { height: 100%; width: 100%; }
.leaflet-popup-content-wrapper { border-radius: var(--radius-md) !important; box-shadow: var(--shadow-md) !important; border: 1px solid var(--slate-100) !important; }
.leaflet-popup-tip { display: none; }
""")

# ── Components ───────────────────────────────────────────

w(f'{CLIENT}/src/components/NavBar.tsx', """import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Mountain, Map, User, LogOut } from 'lucide-react';

interface NavBarProps { currentPage: string; onNavigate: (page: string) => void; }

const NavBar: React.FC<NavBarProps> = ({ currentPage, onNavigate }) => {
    const { user, logout } = useAuth();
    return (
        <nav style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '56px', zIndex: 500,
            background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--slate-200)',
            display: 'flex', alignItems: 'center', padding: '0 16px', gap: '8px',
        }}>
            <button className="btn btn-ghost" onClick={() => onNavigate('explore')} style={{ gap: '8px', fontWeight: 800, fontSize: '16px', color: 'var(--slate-800)' }}>
                <Mountain size={22} style={{ color: 'var(--blue-500)' }} /> TerraTales
            </button>
            <div style={{ flex: 1 }} />
            <button className={`btn btn-ghost btn-sm ${currentPage === 'explore' ? 'btn-secondary' : ''}`} onClick={() => onNavigate('explore')}>
                <Map size={16} /> Explore
            </button>
            {user && (
                <>
                    <button className={`btn btn-ghost btn-sm ${currentPage === 'profile' ? 'btn-secondary' : ''}`} onClick={() => onNavigate('profile')}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: user.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white', fontWeight: 700 }}>
                            {user.username.slice(0, 2).toUpperCase()}
                        </div>
                        <User size={14} />
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={logout} title="Logout">
                        <LogOut size={16} />
                    </button>
                </>
            )}
        </nav>
    );
};

export default NavBar;
""")

print('==> All files written successfully!')
print()
print('Next steps:')
print('  1. Copy v2/server/.env.example to v2/server/.env and fill in your values')
print('  2. cd v2/server && npm install && npm run dev')
print('  3. cd v2/client && npm install && npm run dev')
