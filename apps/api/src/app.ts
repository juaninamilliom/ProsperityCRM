import 'express-async-errors';
import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { errorHandler } from './middleware/error-handler.js';
import { authMiddleware } from './middleware/auth.js';
import { candidateRouter } from './modules/candidate/candidate.routes.js';
import { statusRouter } from './modules/status/status.routes.js';
import { agencyRouter } from './modules/agency/agency.routes.js';
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
      origin: (origin, callback) => {
        if (!origin || config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    })
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  app.use('/admin', adminRouter);
  app.use('/auth', authRouter);
  app.use(authMiddleware);
  app.use('/users', userRouter);
  app.use('/candidates', candidateRouter);
  app.use('/statuses', statusRouter);
  app.use('/agencies', agencyRouter);
  app.use('/history', historyRouter);
  app.use('/organizations', organizationRouter);
  app.use('/jobs', jobRouter);
  app.use('/skills', skillRouter);
  app.use(inviteRouter);

  app.use(errorHandler);

  return app;
}
