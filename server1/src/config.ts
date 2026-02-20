import dotenv from 'dotenv';
dotenv.config();

export const config = {
    port: parseInt(process.env.PORT || '3001'),
    databaseUrl: process.env.DATABASE_URL!,
    jwtSecret: process.env.JWT_SECRET!,
    resendApiKey: process.env.RESEND_API_KEY || '',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
} as const;

// Validate required env vars
const required = ['DATABASE_URL', 'JWT_SECRET'] as const;
for (const key of required) {
    if (!process.env[key]) {
        console.error(`❌ Missing required env var: ${key}`);
        process.exit(1);
    }
}
