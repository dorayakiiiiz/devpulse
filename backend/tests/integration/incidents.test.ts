import request from 'supertest';
import { createApp } from '../../src/app.js';
import { Monitor } from '../../src/models/monitorModel.js';
import { Incident } from '../../src/models/incidentModel.js';
import { aiService } from '../../src/services/aiService.js';
import { createTestUser } from '../helpers/authHelper.js';

// Integration test suite for incident management endpoints
describe('Incidents Integration Tests', () => {
  const app = createApp();

  describe('GET /api/incidents', () => {
    it('should list incidents belonging to the user and filter by status', async () => {
      const { user, authHeader } = await createTestUser();

      const monitor = await Monitor.create({
        userId: user._id,
        name: 'Target Monitor',
        url: 'https://example.com/api',
        method: 'GET',
        interval: 60,
      });

      await Incident.create({
        monitorId: monitor._id,
        userId: user._id,
        status: 'ongoing',
        startedAt: new Date(),
        errorDetails: {
          statusCode: 502,
          errorMessage: 'Bad Gateway',
          responseBody: '',
          responseHeaders: new Map(),
        },
      });

      await Incident.create({
        monitorId: monitor._id,
        userId: user._id,
        status: 'resolved',
        startedAt: new Date(Date.now() - 3600000),
        resolvedAt: new Date(),
        errorDetails: {
          statusCode: 504,
          errorMessage: 'Gateway Timeout',
          responseBody: '',
          responseHeaders: new Map(),
        },
      });

      const allRes = await request(app)
        .get('/api/incidents')
        .set('Authorization', authHeader);

      expect(allRes.status).toBe(200);
      expect(allRes.body.success).toBe(true);
      expect(allRes.body.data).toHaveLength(2);

      const ongoingRes = await request(app)
        .get('/api/incidents?status=ongoing')
        .set('Authorization', authHeader);

      expect(ongoingRes.status).toBe(200);
      expect(ongoingRes.body.data).toHaveLength(1);
      expect(ongoingRes.body.data[0].status).toBe('ongoing');
    });
  });

  describe('GET /api/incidents/:id (IDOR Protection)', () => {
    it('should return incident details for the owner', async () => {
      const { user, authHeader } = await createTestUser();

      const monitor = await Monitor.create({
        userId: user._id,
        name: 'Private Service',
        url: 'https://example.com',
        method: 'GET',
        interval: 60,
      });

      const incident = await Incident.create({
        monitorId: monitor._id,
        userId: user._id,
        status: 'ongoing',
        startedAt: new Date(),
        errorDetails: {
          statusCode: 500,
          errorMessage: 'Internal Server Error',
          responseBody: '',
          responseHeaders: new Map(),
        },
      });

      const response = await request(app)
        .get(`/api/incidents/${incident._id}`)
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(incident._id.toString());
      expect(response.body.data.errorDetails.statusCode).toBe(500);
    });

    it('should return 404 when querying an incident owned by another user', async () => {
      const owner = await createTestUser({ email: 'owner_inc@example.com' });
      const attacker = await createTestUser({ email: 'attacker_inc@example.com' });

      const monitor = await Monitor.create({
        userId: owner.user._id,
        name: 'Owner Service',
        url: 'https://example.com',
        method: 'GET',
        interval: 60,
      });

      const incident = await Incident.create({
        monitorId: monitor._id,
        userId: owner.user._id,
        status: 'ongoing',
        startedAt: new Date(),
        errorDetails: {
          statusCode: 500,
          errorMessage: 'Error',
          responseBody: '',
          responseHeaders: new Map(),
        },
      });

      const response = await request(app)
        .get(`/api/incidents/${incident._id}`)
        .set('Authorization', attacker.authHeader);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PATCH /api/incidents/:id/resolve', () => {
    it('should mark ongoing incident as resolved', async () => {
      const { user, authHeader } = await createTestUser();

      const monitor = await Monitor.create({
        userId: user._id,
        name: 'Resolved Service',
        url: 'https://example.com',
        method: 'GET',
        interval: 60,
      });

      const incident = await Incident.create({
        monitorId: monitor._id,
        userId: user._id,
        status: 'ongoing',
        startedAt: new Date(),
        errorDetails: {
          statusCode: 503,
          errorMessage: 'Service Unavailable',
          responseBody: '',
          responseHeaders: new Map(),
        },
      });

      const response = await request(app)
        .patch(`/api/incidents/${incident._id}/resolve`)
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('resolved');
      expect(response.body.data.resolvedAt).not.toBeNull();

      const updated = await Incident.findById(incident._id);
      expect(updated?.status).toBe('resolved');
    });
  });

  describe('POST /api/incidents/:id/reanalyze', () => {
    it('should invoke AI service and persist updated post-mortem report', async () => {
      const { user, authHeader } = await createTestUser();

      const monitor = await Monitor.create({
        userId: user._id,
        name: 'AI Analysis Service',
        url: 'https://example.com/api',
        method: 'GET',
        interval: 60,
      });

      const incident = await Incident.create({
        monitorId: monitor._id,
        userId: user._id,
        status: 'ongoing',
        startedAt: new Date(),
        errorDetails: {
          statusCode: 502,
          errorMessage: 'Bad Gateway',
          responseBody: 'Upstream gateway timed out',
          responseHeaders: new Map(),
        },
      });

      vi.spyOn(aiService, 'generatePostMortem').mockResolvedValue({
        summary: 'Gateway timeout failure',
        rootCause: 'Upstream pod overloaded',
        actionItems: ['Scale out backend deployment replica count'],
      });

      const response = await request(app)
        .post(`/api/incidents/${incident._id}/reanalyze`)
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body.data.aiPostMortem).toBeDefined();
      expect(response.body.data.aiPostMortem.rootCause).toBe('Upstream pod overloaded');
      expect(response.body.data.aiPostMortem.actionItems).toContain('Scale out backend deployment replica count');
    });
  });
});

