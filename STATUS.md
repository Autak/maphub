# System Status
## Operational
- **Time:** 2026-02-27 22:47
- **Status:** All systems operational. Redeploying to sync Vercel branch state.
- **Backend:** Running on http://localhost:3001
- **Frontend:** Running on http://localhost:3000
- **Fixes Applied:**
    - Reverted `server/.env` to use local PostgreSQL (was pointing to invalid Supabase instance).
    - Verified `services/api.ts` points to `http://localhost:3001/api`.
    - Restarted all services.
