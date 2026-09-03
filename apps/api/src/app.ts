import 'express-async-errors';
import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { isAllowedOrigin } from './cors.js';
import { errorHandler } from './middleware/error-handler.js';
import { authMiddleware } from './middleware/auth.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { entryRouter } from './modules/entry/entry.routes.js';
import { companyRouter } from './modules/company/company.routes.js';
import { personRouter } from './modules/person/person.routes.js';
import { opportunityRouter } from './modules/opportunity/opportunity.routes.js';
import { activityRouter } from './modules/activity/activity.routes.js';
import { statusRouter } from './modules/status/status.routes.js';
import { userRouter } from './modules/user/user.routes.js';
import { historyRouter } from './modules/history/history.routes.js';
import { organizationRouter } from './modules/organization/organization.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { inviteRouter } from './modules/invite/invite.routes.js';
import { jobRouter } from './modules/job/job.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { skillRouter } from './modules/skill/skill.routes.js';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin: (origin, callback) => callback(null, isAllowedOrigin(origin, config.corsOrigins)),
      credentials: true,
    })
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Attached at the router mount, never as a bare app.use between these three
  // lines: their order is the only authentication gate this API has. See
  // app.test.ts.
  //
  // /admin is one header secret away from promoting any user to admin in any
  // organization, and nothing legitimate calls it in bulk.
  //
  // /auth is NOT throttled here. Four of its routes carry their own
  // authMiddleware and are ordinary in-app operations - GET /auth/passkeys is
  // polled by the app shell on every tab focus - so a prefix-wide bucket would
  // let normal work lock an office out of logging in. The credential routes
  // carry their own limiter inside auth.routes.ts.
  app.use(
    '/admin',
    createRateLimiter({ windowMs: 15 * 60_000, max: 10, trustedProxyHops: config.trustedProxyHops }),
    adminRouter,
  );
  app.use('/auth', authRouter);
  app.use(authMiddleware);
  app.use('/users', userRouter);
  app.use('/pipeline-entries', entryRouter);
  app.use('/companies', companyRouter);
  app.use('/people', personRouter);
  app.use('/opportunities', opportunityRouter);
  app.use('/activities', activityRouter);
  app.use('/statuses', statusRouter);
  app.use('/history', historyRouter);
  app.use('/organizations', organizationRouter);
  app.use('/jobs', jobRouter);
  app.use('/skills', skillRouter);
  app.use(inviteRouter);

  app.use(errorHandler);

  return app;
}
