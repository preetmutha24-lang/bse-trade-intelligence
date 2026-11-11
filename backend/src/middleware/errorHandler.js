import { env } from '../config/env.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
}

export function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || error.status || 500;
  const message = error.message || 'Internal server error';

  if (env.nodeEnv !== 'production') {
    console.error(`[${new Date().toISOString()}] ${statusCode} ${req.method} ${req.originalUrl} - ${message}`);
  }

  res.status(statusCode).json({
    error: message,
  });
}
