import mongoose from 'mongoose';
import env from './env';
import logger from '../utils/logger';

mongoose.set('strictQuery', true);

/**
 * NOTE: mongoose's global `sanitizeFilter` is intentionally NOT enabled.
 * It wraps every value in `$eq`, which breaks legitimate operator filters such
 * as `{ project: { $in: ids } }` used throughout the data-scoping services.
 *
 * NoSQL operator injection is prevented structurally instead:
 *   - every request payload/query is validated with Joi against a whitelist
 *     schema (`src/validators`), which rejects objects for scalar fields
 *   - services never spread raw user input into a Mongo filter; they copy
 *     named keys only (`safeFilter` in `src/utils/sanitize.js`)
 *   - ids are validated against a 24 hex character ObjectId pattern
 * See `scripts/verify.js` -> "NoSQL injection guard".
 */

export async function connectDatabase(uri = env.mongoUri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  mongoose.connection.on('error', (err) => logger.error('MongoDB connection error', err));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 20,
  });

  logger.info(`MongoDB connected: ${mongoose.connection.name}`);
  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  logger.info('MongoDB connection closed');
}

export default connectDatabase;
