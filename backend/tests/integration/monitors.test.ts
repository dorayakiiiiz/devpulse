import request from 'supertest';
import { createApp } from '../../src/app.js';
import { Monitor } from '../../src/models/monitorModel.js';
import { createTestUser } from '../helpers/authHelper.js';
import { pingExecutor } from '../../src/services/pingExecutor.js';

// Integration test suite for monitor management endpoints
describe('Monitors Integration Tests', () => {
  const app = createApp();

  describe('POST /api/monitors', () => {
    it('should create a new monitor for the authenticated user', async () => {
      const { user, authHeader } = await createTestUser();

      const response = await request(app)
        .post('/api/monitors')
        .set('Authorization', authHeader)
        .send({
          name: 'Primary API',
          url: 'https://api.example.com/health',
          method: 'GET',
          interval: 60,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Primary API');
      expect(response.body.data.userId).toBe(user._id.toString());

      const created = await Monitor.findById(response.body.data.id);
      expect(created).not.toBeNull();
      expect(created?.url).toBe('https://api.example.com/health');
    });

    it('should return 400 when interval is invalid', async () => {
      const { authHeader } = await createTestUser();

      const response = await request(app)
        .post('/api/monitors')
        .set('Authorization', authHeader)
        .send({
          name: 'Invalid Interval',
          url: 'https://api.example.com',
          interval: 120,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/monitors', () => {
    it('should return only monitors owned by authenticated user', async () => {
      const userA = await createTestUser({ email: 'usera@example.com' });
      const userB = await createTestUser({ email: 'userb@example.com' });

      await Monitor.create({
        userId: userA.user._id,
        name: 'User A Monitor',
        url: 'https://a.example.com',
        method: 'GET',
        interval: 60,
      });

      await Monitor.create({
        userId: userB.user._id,
        name: 'User B Monitor',
        url: 'https://b.example.com',
        method: 'GET',
        interval: 60,
      });

      const response = await request(app)
        .get('/api/monitors')
        .set('Authorization', userA.authHeader);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('User A Monitor');
    });
  });

  describe('GET /api/monitors/:id (IDOR Protection)', () => {
    it('should return monitor for the owner', async () => {
      const { user, authHeader } = await createTestUser();
      const monitor = await Monitor.create({
        userId: user._id,
        name: 'Owner Monitor',
        url: 'https://owner.example.com',
        method: 'GET',
        interval: 60,
      });

      const response = await request(app)
        .get(`/api/monitors/${monitor._id}`)
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Owner Monitor');
    });

    it('should return 404 when querying another user monitor (IDOR)', async () => {
      const userA = await createTestUser({ email: 'user1@example.com' });
      const userB = await createTestUser({ email: 'user2@example.com' });

      const monitorA = await Monitor.create({
        userId: userA.user._id,
        name: 'Private Monitor',
        url: 'https://private.example.com',
        method: 'GET',
        interval: 60,
      });

      const response = await request(app)
        .get(`/api/monitors/${monitorA._id}`)
        .set('Authorization', userB.authHeader);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/monitors/:id & DELETE /api/monitors/:id', () => {
    it('should update monitor configuration for owner', async () => {
      const { user, authHeader } = await createTestUser();
      const monitor = await Monitor.create({
        userId: user._id,
        name: 'Old Name',
        url: 'https://example.com',
        method: 'GET',
        interval: 60,
      });

      const response = await request(app)
        .put(`/api/monitors/${monitor._id}`)
        .set('Authorization', authHeader)
        .send({
          name: 'Renamed Monitor',
          interval: 300,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Renamed Monitor');
      expect(response.body.data.interval).toBe(300);
    });

    it('should return 404 when unauthorized user attempts to update monitor', async () => {
      const userA = await createTestUser({ email: 'ownera@example.com' });
      const attacker = await createTestUser({ email: 'attacker@example.com' });

      const monitor = await Monitor.create({
        userId: userA.user._id,
        name: 'Protected Target',
        url: 'https://example.com',
        method: 'GET',
        interval: 60,
      });

      const response = await request(app)
        .put(`/api/monitors/${monitor._id}`)
        .set('Authorization', attacker.authHeader)
        .send({ name: 'Hacked Name' });

      expect(response.status).toBe(404);
    });

    it('should delete monitor for owner', async () => {
      const { user, authHeader } = await createTestUser();
      const monitor = await Monitor.create({
        userId: user._id,
        name: 'To Delete',
        url: 'https://example.com',
        method: 'GET',
        interval: 60,
      });

      const response = await request(app)
        .delete(`/api/monitors/${monitor._id}`)
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);

      const deleted = await Monitor.findById(monitor._id);
      expect(deleted).toBeNull();
    });
  });

  describe('POST /api/monitors/:id/ping', () => {
    it('should execute instant ping and enforce 15s cooldown', async () => {
      const { user, authHeader } = await createTestUser();
      const monitor = await Monitor.create({
        userId: user._id,
        name: 'Ping Test Monitor',
        url: 'https://example.com/ping',
        method: 'GET',
        interval: 60,
      });

      vi.spyOn(pingExecutor, 'pingTarget').mockResolvedValue({
        isUp: true,
        statusCode: 200,
        latency: 42,
        checkedAt: new Date(),
      });

      const firstPingRes = await request(app)
        .post(`/api/monitors/${monitor._id}/ping`)
        .set('Authorization', authHeader);

      expect(firstPingRes.status).toBe(200);
      expect(firstPingRes.body.data.isUp).toBe(true);

      const secondPingRes = await request(app)
        .post(`/api/monitors/${monitor._id}/ping`)
        .set('Authorization', authHeader);

      expect(secondPingRes.status).toBe(429);
      expect(secondPingRes.body.error).toContain('Please wait 15 seconds');
    });
  });
});
