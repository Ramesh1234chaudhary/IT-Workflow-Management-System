/* eslint-disable no-console */

type Level = 'log' | 'warn' | 'error';
type Args = unknown[];

const isSilent = process.env.NODE_ENV === 'test' || process.env.LOG_SILENT === 'true';

const emit = (level: Level, args: Args) => {
  if (isSilent) return;
  const stamp = new Date().toISOString();
  console[level](`[${stamp}] [${level.toUpperCase()}]`, ...args);
};

const logger = {
  info: (...args: Args) => emit('log', args),
  warn: (...args: Args) => emit('warn', args),
  error: (...args: Args) => emit('error', args),
  debug: (...args: Args) => {
    if (process.env.NODE_ENV === 'development') emit('log', args);
  },
};

export default logger;
