import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'life-growth-tracker' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = uuidv4();
  const startTime = Date.now();

  (req as any).requestId = requestId;

  logger.info({
    requestId,
    method: req.method,
    path: req.path,
    userId: (req as any).user?.id || null,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  const originalEnd = res.end;
  res.end = function (this: Response, ...args: any[]) {
    const duration = Date.now() - startTime;
    logger.info({
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: (req as any).user?.id || null,
    });
    return originalEnd.apply(this, args);
  } as any;

  next();
}

export default logger;
