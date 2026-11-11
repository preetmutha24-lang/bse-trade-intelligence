import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import router from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
  }),
);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(express.json({ limit: '1mb' }));
app.disable('x-powered-by');

app.get('/', (req, res) => {
  res.json({
    name: 'BSE Trade Intelligence API',
    status: 'running',
    docs: '/api/docs',
  });
});

app.use(router);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
