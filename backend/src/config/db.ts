import mongoose from 'mongoose';
import { env } from './env.js';

// Establish connection to MongoDB instance
export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      autoIndex: true,
    });
    console.log('[Database] MongoDB connected successfully.');
  } catch (error) {
    console.error('[Database] MongoDB connection error:', error);
    process.exit(1);
  }
}

// Disconnect from MongoDB during graceful shutdown
export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log('[Database] MongoDB disconnected cleanly.');
  } catch (error) {
    console.error('[Database] Error while disconnecting MongoDB:', error);
  }
}

