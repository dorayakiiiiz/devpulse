import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { memoryCache } from '../src/utils/cache.js';

let mongoServer: MongoMemoryServer;

// Start in-memory MongoDB instance and connect Mongoose for integration tests
beforeAll(async () => {
  const testPath = expect.getState().testPath ?? '';
  if (testPath.includes('unit')) {
    return;
  }
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 60000);

// Teardown database connection and stop in-memory server
afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}, 60000);

// Clean all collection documents and flush in-memory caches between individual tests
beforeEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
  memoryCache.flush();
  vi.clearAllMocks();
});
