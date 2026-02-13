import type { Request, Response, NextFunction } from 'express';
import logger from './logging.js';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  logger.error({
    error: err.message,
    stack: err.stack,
    requestId: (req as any).requestId,
    method: req.method,
    path: req.path,
  });

  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : err.message,
    requestId: (req as any).requestId,
  });
}
