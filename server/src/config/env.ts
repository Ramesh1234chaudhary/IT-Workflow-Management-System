import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.join(serverRoot, '.env') });

const bool = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const list = (value: string | undefined, fallback: string[] = []): string[] => {
  if (!value) return fallback;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

/**
 * Development falls back to fixed throwaway secrets so a fresh clone runs with
 * `npm install && npm run dev` and no .env file. `jsonwebtoken` rejects an
 * empty secret, which would otherwise crash the first sign-in. Production never
 * gets these: the guard below exits instead.
 */
const accessSecret = process.env.JWT_ACCESS_SECRET || 'dev-only-access-secret-change-me-0123456789';
const refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-only-refresh-secret-change-me-0123456789';

if (isProduction) {
  const missing: string[] = [];
  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
  if (accessSecret.length < 32) missing.push('JWT_ACCESS_SECRET (min 32 chars)');
  if (refreshSecret.length < 32) missing.push('JWT_REFRESH_SECRET (min 32 chars)');
  if (accessSecret && accessSecret === refreshSecret) missing.push('JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET');
  if (missing.length) {
    console.error(`[config] Invalid production configuration: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const env = Object.freeze({
  nodeEnv,
  isProduction,
  isTest: nodeEnv === 'test',
  serverRoot,
  port: int(process.env.PORT, 4000),

  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/it_workflow_management',

  jwt: {
    accessSecret,
    refreshSecret,
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    accessExpiresMinutes: int(process.env.ACCESS_TOKEN_EXPIRES_MINUTES, 15),
    refreshTtl: process.env.REFRESH_TOKEN_TTL || '7d',
    refreshExpiresDays: int(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 7),
  },

  cookie: {
    refreshName: process.env.REFRESH_COOKIE_NAME || 'wf_refresh_token',
    path: process.env.REFRESH_COOKIE_PATH || '/api/auth',
    // Split deployments (Vercel + Railway) put the API on a different site than
    // the SPA, so a Lax cookie is never attached to the refresh call and every
    // reload would sign the user out. None requires Secure, which needs HTTPS.
    sameSite: (process.env.REFRESH_COOKIE_SAMESITE || (isProduction ? 'none' : 'lax')) as 'lax' | 'strict' | 'none',
    secure: bool(process.env.REFRESH_COOKIE_SECURE, isProduction),
    domain: process.env.COOKIE_DOMAIN || undefined,
  },

  cors: {
    origins: list(process.env.CLIENT_URL, ['http://localhost:5173']),
    credentials: true,
  },

  security: {
    bcryptSaltRounds: int(process.env.BCRYPT_SALT_ROUNDS, 10),
    authRateLimitWindowMs: int(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    authRateLimitMax: int(process.env.AUTH_RATE_LIMIT_MAX, 20),
    apiRateLimitWindowMs: int(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    apiRateLimitMax: int(process.env.API_RATE_LIMIT_MAX, 500),
    // Behind Railway/Render the socket is a proxy, so req.ip is the load
    // balancer unless X-Forwarded-For is trusted.
    trustProxy: bool(process.env.TRUST_PROXY, isProduction),
  },

  uploads: {
    dir: path.resolve(serverRoot, process.env.UPLOAD_DIR || './uploads'),
    maxSizeBytes: int(process.env.MAX_UPLOAD_SIZE_MB, 25) * 1024 * 1024,
  },

  integrations: {
    enabled: bool(process.env.INTEGRATIONS_ENABLED, false),
    openProject: {
      baseUrl: process.env.OPENPROJECT_BASE_URL || '',
      apiToken: process.env.OPENPROJECT_API_TOKEN || '',
    },
    timesheet: {
      baseUrl: process.env.TIMESHEET_BASE_URL || '',
      apiToken: process.env.TIMESHEET_API_TOKEN || '',
    },
  },
});

export type Env = typeof env;
export default env;
