import 'express-async-errors';
import cors from 'cors';
import express from 'express';
import { config } from './config';
import { errorHandler } from './middleware/error-handler';
import { authMiddleware } from './middleware/auth';
import { candidateRouter } from './modules/candidate/candidate.routes';
import { statusRouter } from './modules/status/status.routes';
import { agencyRouter } from './modules/agency/agency.routes';
import { userRouter } from './modules/user/user.routes';
import { historyRouter } from './modules/history/history.routes';
import { organizationRouter } from './modules/organization/organization.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { inviteRouter } from './modules/invite/invite.routes';

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
  app.use(authMiddleware);
  app.use('/users', userRouter);
  app.use('/candidates', candidateRouter);
  app.use('/statuses', statusRouter);
  app.use('/agencies', agencyRouter);
  app.use('/history', historyRouter);
  app.use('/organizations', organizationRouter);
  app.use(inviteRouter);

  app.use(errorHandler);

  return app;
}
