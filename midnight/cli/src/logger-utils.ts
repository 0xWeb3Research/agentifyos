import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import pino from 'pino';

/**
 * File-only logger. The CLI narrates to stdout itself, so SDK chatter goes to
 * a log file where it can be read after the fact instead of drowning the demo.
 */
export const createLogger = async (logPath: string): Promise<pino.Logger> => {
  await mkdir(path.dirname(logPath), { recursive: true });
  return pino(
    { level: process.env.DEBUG_LEVEL ?? 'info' },
    pino.destination({ dest: logPath, sync: true, mkdir: true }),
  );
};
