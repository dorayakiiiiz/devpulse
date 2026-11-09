import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';

// Create and configure Express application
export function createApp(): Express {
  const app = express();

  // Trust first proxy hop from Nginx reverse proxy
  app.set('trust proxy', 1);

  // Basic request parsers and security middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Mount API routes
  app.use('/api', apiRoutes);

  // Handle unmatched 404 routes
  app.use(notFoundHandler);

  // Centralized error handling
  app.use(errorHandler);

  return app;
}

