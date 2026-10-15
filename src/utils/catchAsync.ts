import { Request, Response, NextFunction } from 'express';

/**
 * Hàm bọc giúp bắt lỗi (catch) tự động cho các hàm async route controller,
 * tránh việc phải viết try-catch lặp đi lặp lại.
 */
export const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };
};
