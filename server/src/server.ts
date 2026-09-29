import type { Server } from 'node:http';
import app from './app';
import env from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';
import logger from './utils/logger';

let server: Server | undefined;

const start = async () => {
  try {
    await connectDatabase();
    server = app.listen(env.port, () => {
      logger.info(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
      logger.info(`Allowed origins: ${env.cors.origins.join(', ')}`);
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  try {
    if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
    await disconnectDatabase();
  } catch (err) {
    logger.error('Error during shutdown', err);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();

export default server;
