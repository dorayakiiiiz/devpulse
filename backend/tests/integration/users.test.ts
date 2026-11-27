import request from 'supertest';
import { createApp } from '../../src/app.js';
import { UserModel } from '../../src/models/userModel.js';
import { Monitor } from '../../src/models/monitorModel.js';
import { createTestUser } from '../helpers/authHelper.js';

// Integration test suite for user profile and account management
describe('Users Integration Tests', () => {
  const app = createApp();

  describe('GET /api/users/profile', () => {
    it('should return user profile for authenticated user', async () => {
      const { user, authHeader } = await createTestUser();

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(user._id.toString());
      expect(response.body.data.email).toBe(user.email);
    });

    it('should return 401 when no authorization header is provided', async () => {
      const response = await request(app).get('/api/users/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should update user display name and slug', async () => {
      const { authHeader } = await createTestUser();

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', authHeader)
        .send({
          name: 'Updated Name',
          slug: 'updated-unique-slug',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.slug).toBe('updated-unique-slug');
    });

    it('should return 409 when slug is already claimed by another user', async () => {
      await createTestUser({ email: 'owner@example.com' });
      const secondUser = await createTestUser({ email: 'second@example.com' });

      // First set a known slug for owner
      await UserModel.updateOne({ email: 'owner@example.com' }, { slug: 'claimed-slug' });

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', secondUser.authHeader)
        .send({
          slug: 'claimed-slug',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/users/change-password', () => {
    it('should change password when current password matches', async () => {
      const { user, rawPassword, authHeader } = await createTestUser();

      const response = await request(app)
        .put('/api/users/change-password')
        .set('Authorization', authHeader)
        .send({
          currentPassword: rawPassword,
          newPassword: 'NewSecurePassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'NewSecurePassword123!',
        });

      expect(loginRes.status).toBe(200);
    });

    it('should return 400 when current password does not match', async () => {
      const { authHeader } = await createTestUser();

      const response = await request(app)
        .put('/api/users/change-password')
        .set('Authorization', authHeader)
        .send({
          currentPassword: 'WrongPassword!',
          newPassword: 'NewSecurePassword123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/users/account', () => {
    it('should delete account and cascade delete user monitors', async () => {
      const { user, rawPassword, authHeader } = await createTestUser();

      await Monitor.create({
        userId: user._id,
        name: 'Account Test Monitor',
        url: 'https://example.com/test',
        method: 'GET',
        interval: 60,
      });

      const response = await request(app)
        .delete('/api/users/account')
        .set('Authorization', authHeader)
        .send({ password: rawPassword });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const deletedUser = await UserModel.findById(user._id);
      expect(deletedUser).toBeNull();

      const orphanMonitors = await Monitor.find({ userId: user._id });
      expect(orphanMonitors).toHaveLength(0);
    });

    it('should return 400 when incorrect password is provided', async () => {
      const { authHeader } = await createTestUser();

      const response = await request(app)
        .delete('/api/users/account')
        .set('Authorization', authHeader)
        .send({ password: 'WrongPassword!' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
