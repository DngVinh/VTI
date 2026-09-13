import "reflect-metadata";
import "./config/di";
import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { httpLogger } from "./middlewares/http-logger.middleware";
import { logger, Logger } from "./infrastructure/logging/logger";

import apiRoutes from "./routes";
import { AppEnv, getEnv } from "./config/env";
import { AppError } from "./utils/AppError";
import { enforceContentType } from "./middlewares/content-type.middleware";
import { globalErrorHandler } from "./middlewares/error.middleware";
import { requestContext } from "./middlewares/request-context.middleware";

const developmentOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

export const createApp = (env: AppEnv = getEnv(), output: Logger = logger) => {
  const app = express();
  const allowedOrigins = new Set(
    env.CORS_ALLOWED_ORIGINS.length > 0 ? env.CORS_ALLOWED_ORIGINS : developmentOrigins
  );

  app.set("env", env.NODE_ENV);
  app.set("trust proxy", env.TRUST_PROXY_HOPS > 0 ? env.TRUST_PROXY_HOPS : false);
  app.disable("x-powered-by");

  app.use(requestContext);
  app.use(httpLogger(output));
  app.use('/api/v1/admin/question-bank', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(
    helmet({
      strictTransportSecurity: env.NODE_ENV === "production" ? undefined : false,
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://accounts.google.com/gsi/client"],
          frameSrc: ["'self'", "https://accounts.google.com/gsi/"],
          connectSrc: ["'self'", "https://accounts.google.com/gsi/"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com/gsi/style"],
          imgSrc: ["'self'", "data:", "https://*.googleusercontent.com", "https://lh3.googleusercontent.com"],
        },
      },
    })
  );

  app.use(
    cors({
      exposedHeaders: ["ETag", "X-Request-Id", "Idempotency-Replayed"],
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new AppError("Origin không được phép truy cập", 403, "CORS_ORIGIN_DENIED"));
      }
    })
  );

  app.use(enforceContentType);
  app.use(
    express.json({
      limit: env.JSON_BODY_LIMIT,
      type: ["application/json", "application/*+json"]
    })
  );

  app.use(
    express.urlencoded({
      extended: true,
      limit: env.FORM_BODY_LIMIT
    })
  );

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({
      success: true,
      message: "IT Interview AI API is running"
    });
  });

  // API v1 routes
  app.use("/api/v1", apiRoutes);

  // Catch-all cho API 404
  app.use("/api", (req, res, next) => {
    next(new AppError(`Không tìm thấy API route: ${req.originalUrl}`, 404, "NOT_FOUND"));
  });

  // React Client static files & SPA fallback
  const clientPath = path.join(process.cwd(), "client", "dist");
  app.use(express.static(clientPath));

  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(clientPath, "index.html"), (err) => {
      if (err) {
        next();
      }
    });
  });

  // Middleware xử lý lỗi toàn cục
  app.use(globalErrorHandler);

  return app;
};

const app = createApp();

export default app;
