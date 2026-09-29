import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import env from './config/env';
import routes from './routes/index';
import { errorHandler, notFound, apiLimiter } from './middlewares/index';
import logger from './utils/logger';

const app = express();

if (env.security.trustProxy) app.set('trust proxy', 1);

app.disable('x-powered-by');

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

/**
 * Vite does not fail when 5173 is taken — it silently starts on 5174, 5175 and
 * so on. Outside production we therefore accept any loopback origin on any port
 * so that shift does not look like a CORS outage. In production only the
 * explicit CLIENT_URL allow-list is honoured.
 */
const isLoopback = (origin: string): boolean => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / curl / server-to-server requests (no Origin header)
      if (!origin) return callback(null, true);
      if (env.cors.origins.includes(origin) || env.cors.origins.includes('*')) return callback(null, true);
      if (!env.isProduction && isLoopback(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS policy`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(compression());

if (!env.isTest) {
  app.use(morgan(env.isProduction ? 'combined' : 'dev', { skip: (req) => req.url === '/api/health' }));
}

app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', env: env.nodeEnv }));

app.use('/api', apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', reason);
});

export default app;
