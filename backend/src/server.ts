import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';

// Bootstrap backend server and handle lifecycle
async function bootstrap(): Promise<void> {
  await connectDatabase();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.log(`[Server] DevPulse Backend running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // Handle graceful shutdown on termination signals
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);

    server.close(async () => {
      console.log('[Server] HTTP listener closed.');
      await disconnectDatabase();
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[Server] Could not close connections in time, forcefully shutting down.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('[Server] Fatal startup error:', error);
  process.exit(1);
});

