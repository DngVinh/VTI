import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';

/**
 * Middleware để validate req.body, req.query, req.params dựa trên Zod Schema
 */
export const validate =
  (schema: ZodSchema) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let validatedData: any;
      const requestData = {
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      };

      try {
        validatedData = await schema.parseAsync(requestData);
      } catch (error) {
        // Older request envelopes intentionally use strict schemas without a
        // headers member. Keep header-aware validation for interview actions,
        // while remaining compatible with those envelopes.
        const isUnexpectedHeadersError =
          error instanceof ZodError &&
          error.issues.some(
            (issue) =>
              issue.code === 'unrecognized_keys' &&
              issue.keys.includes('headers')
          );
        if (!isUnexpectedHeadersError) throw error;

        validatedData = await schema.parseAsync({
          body: req.body,
          query: req.query,
          params: req.params,
        });
      }
      
      // Gán lại dữ liệu đã được Zod parse/transform (vd: ép kiểu string thành number, trim string)
      if (validatedData.body !== undefined) {
        req.body = validatedData.body;
      }
      if (validatedData.params !== undefined) {
        req.params = validatedData.params;
      }
      if (validatedData.query !== undefined) {
        try {
          req.query = validatedData.query;
        } catch {
          Object.defineProperty(req, 'query', {
            value: validatedData.query,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        }
      }
      
      next();
    } catch (error) {
      // Nếu có lỗi, đẩy xuống Global Error Handler để xử lý
      next(error);
    }
  };
