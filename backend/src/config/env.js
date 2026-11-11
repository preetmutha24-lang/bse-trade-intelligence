import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  dbPath: process.env.DB_PATH ?? path.resolve(process.cwd(), 'data', 'bse_trade_intelligence.sqlite'),
  pullDurationMs: Number(process.env.PULL_DURATION_MS ?? 900000),
  demoPullDurationMs: Number(process.env.DEMO_PULL_DURATION_MS ?? 10000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
};

export function getPullDurationMs() {
  return env.nodeEnv === 'demo' ? env.demoPullDurationMs : env.pullDurationMs;
}
