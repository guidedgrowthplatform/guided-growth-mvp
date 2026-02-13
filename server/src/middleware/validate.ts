import type { Request, Response, NextFunction } from 'express';

type Validator = (data: unknown) => { success: true; data: any } | { success: false; error: string };

export function validateBody(validator: Validator) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = validator(req.body);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    req.body = result.data;
    next();
  };
}
