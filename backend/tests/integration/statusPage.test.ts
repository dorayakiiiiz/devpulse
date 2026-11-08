import request from 'supertest';
import { createApp } from '../../src/app.js';
import { Monitor } from '../../src/models/monitorModel.js';
import { createTestUser } from '../helpers/authHelper.js';

// Integration test suite for public status page endpoints and caching
describe('StatusPage Integration Tests', () => {
  const app = createApp();

  it('should allow public anonymous access to user status page and return 200', async () => {
    const { user } = await createTestUser({ name: 'Acme Cloud' });

    await Monitor.create({
      userId: user._id,
      name: 'Public API',
      url: 'https://acme.example.com/health',
      method: 'GET',
      interval: 60,
      status: 'up',
      isActive: true,
    });

    const response = await request(app).get(`/api/status/${user.slug}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.systemName).toBe('Acme Cloud');
    expect(response.body.data.systemStatus).toBe('all_operational');
    expect(response.body.data.monitors).toHaveLength(1);
    expect(response.body.data.monitors[0].name).toBe('Public API');
    expect(response.headers['cache-control']).toBe('public, max-age=30, s-maxage=60');
    expect(response.body.data.cachedAt).toBeDefined();
  });

  it('should serve subsequent requests from memory cache with matching cachedAt timestamp', async () => {
    const { user } = await createTestUser();

    await Monitor.create({
      userId: user._id,
      name: 'Cached Service',
      url: 'https://example.com',
      method: 'GET',
      interval: 60,
      status: 'up',
    });

    const firstResponse = await request(app).get(`/api/status/${user.slug}`);
    expect(firstResponse.status).toBe(200);
    const firstCachedAt = firstResponse.body.data.cachedAt;

    const secondResponse = await request(app).get(`/api/status/${user.slug}`);
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.data.cachedAt).toBe(firstCachedAt);
  });

  it('should return 404 when querying an unregistered status page slug', async () => {
    const response = await request(app).get('/api/status/non-existent-random-slug-123');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});

