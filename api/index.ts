/**
 * Express app entry for all non-dedicated API routes.
 * Dedicated handlers remain under api/anilist/* and api/db/health.ts
 * (Vercel filesystem routes win over rewrites for those paths).
 */
import app from '../server/app.js';
import { registerAnivexaExtraRoutes } from '../server/anivexaExtraRoutes.js';

// Mount Anivexa watch + embed-test admin routes (once per cold start)
registerAnivexaExtraRoutes(app);

export default app;
