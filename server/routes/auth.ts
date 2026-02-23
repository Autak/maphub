import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';
import { AuthRequest, authMiddleware } from '../middleware/auth.js';

const router = Router();

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'];
const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

// ───── REGISTER ─────
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        if (username.length < 2) {
            return res.status(400).json({ error: 'Username must be at least 2 characters' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check existing
        const existing = await pool.query(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)',
            [email, username]
        );

        if (existing.rows.length > 0) {
            let hasVerifiedConflict = false;
            const unverifiedIds: string[] = [];

            for (const row of existing.rows) {
                if (row.verified) {
                    hasVerifiedConflict = true;
                } else {
                    unverifiedIds.push(row.id);
                }
            }

            if (hasVerifiedConflict) {
                return res.status(409).json({ error: 'Email or username already taken' });
            }

            // Clean up old unverified accounts so the user can re-register using the same credentials
            if (unverifiedIds.length > 0) {
                for (const unverifiedId of unverifiedIds) {
                    await pool.query('DELETE FROM users WHERE id = $1', [unverifiedId]);
                }
            }
        }

        // Hash password & insert user
        const passwordHash = await bcrypt.hash(password, 12);
        const color = randomColor();
        const result = await pool.query(
            `INSERT INTO users (username, email, password_hash, color) VALUES ($1, $2, $3, $4) RETURNING id`,
            [username, email.toLowerCase(), passwordHash, color]
        );
        const userId = result.rows[0].id;

        // Create verification token
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        await pool.query(
            'INSERT INTO verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [userId, token, expiresAt]
        );

        try {
            // Send verification email via Brevo API
            const protocol = req.protocol;
            const host = req.get('host');
            const verifyUrl = `${protocol}://${host}/api/auth/verify/${token}`;
            const senderEmail = process.env.SENDER_EMAIL || 'lukas@thetrailthread.com';
            const brevoApiKey = process.env.BREVO_API_KEY;

            if (brevoApiKey) {
                const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'api-key': brevoApiKey,
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sender: { name: "TrailThread", email: senderEmail },
                        to: [{ email: email, name: username }],
                        subject: "Verify your TrailThread account",
                        htmlContent: `
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h1 style="font-size: 24px; color: #1e293b;">Welcome to TrailThread!</h1>
              <p style="color: #64748b; line-height: 1.6;">
                Hi <strong>${username}</strong>, thanks for signing up. Click the button below to verify your email address.
              </p>
              <a href="${verifyUrl}" style="display: inline-block; background: #1e293b; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
                Verify Email
              </a>
              <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">
                This link expires in 24 hours. If you didn't create this account, you can ignore this email.
              </p>
            </div>
          `
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Brevo API error:', response.status, errorText);
                }
            } else {
                // No configuration — auto-verify for development
                console.log(`⚠️  No Email configuration — auto-verifying user ${username}`);
                console.log(`   Verification link would be: ${verifyUrl}`);
                await pool.query('UPDATE users SET verified = TRUE WHERE id = $1', [userId]);
            }
        } catch (emailErr) {
            console.error('Failed to send verification email:', emailErr);
            // Still continue — user can request re-send later
        }

        const isAutoVerified = !process.env.BREVO_API_KEY;

        res.status(201).json({
            message: isAutoVerified
                ? 'Account created and auto-verified (dev mode)'
                : 'Account created! Check your email to verify.',
            autoVerified: isAutoVerified,
        });
    } catch (err: any) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ───── VERIFY EMAIL ─────
router.get('/verify/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const result = await pool.query(
            'SELECT * FROM verification_tokens WHERE token = $1 AND expires_at > NOW()',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).send(`
        <html><body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
          <div style="text-align: center;">
            <h1 style="color: #ef4444;">Invalid or Expired Link</h1>
            <p style="color: #64748b;">This verification link is no longer valid.</p>
          </div>
        </body></html>
      `);
        }

        const { user_id } = result.rows[0];
        await pool.query('UPDATE users SET verified = TRUE WHERE id = $1', [user_id]);
        await pool.query('DELETE FROM verification_tokens WHERE user_id = $1', [user_id]);

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.send(`
      <html><body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
        <div style="text-align: center;">
          <h1 style="color: #10b981;">Email Verified!</h1>
          <p style="color: #64748b;">Your account is now active. You can log in.</p>
          <a href="${frontendUrl}" style="display: inline-block; background: #1e293b; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">Go to TrailThread</a>
        </div>
      </body></html>
    `);
    } catch (err) {
        console.error('Verify error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ───── LOGIN ─────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await pool.query(
            'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.verified) {
            return res.status(403).json({ error: 'Please verify your email before logging in' });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                bio: user.bio,
                avatarUrl: user.avatar_url,
                color: user.color,
                joinedAt: new Date(user.created_at).getTime(),
                bookmarks: [],
            },
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ───── GET CURRENT USER ─────
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        const u = result.rows[0];
        res.json({
            id: u.id,
            username: u.username,
            email: u.email,
            bio: u.bio,
            avatarUrl: u.avatar_url,
            color: u.color,
            joinedAt: new Date(u.created_at).getTime(),
            bookmarks: [],
        });
    } catch (err) {
        console.error('Me error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ───── UPDATE PROFILE ─────
router.put('/profile', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { username, bio, avatarUrl } = req.body;
        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (username !== undefined) {
            updates.push(`username = $${idx++}`);
            values.push(username);
        }
        if (bio !== undefined) {
            updates.push(`bio = $${idx++}`);
            values.push(bio);
        }
        if (avatarUrl !== undefined) {
            updates.push(`avatar_url = $${idx++}`);
            values.push(avatarUrl);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nothing to update' });
        }

        values.push(req.userId);
        const result = await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
            values
        );

        const u = result.rows[0];
        res.json({
            id: u.id,
            username: u.username,
            email: u.email,
            bio: u.bio,
            avatarUrl: u.avatar_url,
            color: u.color,
            joinedAt: new Date(u.created_at).getTime(),
            bookmarks: [],
        });
    } catch (err: any) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Username already taken' });
        }
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
