import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestUser } from '../helpers/authHelper.js';

// Integration test suite for healthcheck and administrative system endpoints
describe('System & Admin Integration Tests', () => {
  const app = createApp();

  describe('GET /api/health', () => {
    it('should return 200 with database connectivity and memory usage statistics', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.database.status).toBe('connected');
      expect(response.body.memory.heapUsedMB).toBeGreaterThan(0);
      expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/admin/overview (Role-Based Access Control)', () => {
    it('should return 401 when unauthenticated user accesses admin route', async () => {
      const response = await request(app).get('/api/admin/overview');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 when regular member accesses admin route', async () => {
      const { authHeader } = await createTestUser({ role: 'member' });

      const response = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', authHeader);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 200 with macro statistics for admin user', async () => {
      const { authHeader } = await createTestUser({ role: 'admin' });

      const response = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.counts.totalUsers).toBeGreaterThanOrEqual(1);
      expect(response.body.data.systemMemory).toBeDefined();
    });
  });

  describe('Admin Ping Engine Controls', () => {
    it('should return ping engine operational diagnostics', async () => {
      const { authHeader } = await createTestUser({ role: 'admin' });

      const response = await request(app)
        .get('/api/admin/ping-engine/status')
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.concurrencyLimit).toBe(5);
    });

    it('should allow admin to manually flush ping metric buffer', async () => {
      const { authHeader } = await createTestUser({ role: 'admin' });

      const response = await request(app)
        .post('/api/admin/ping-engine/flush')
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.flushedCount).toBeDefined();
    });
  });
});
