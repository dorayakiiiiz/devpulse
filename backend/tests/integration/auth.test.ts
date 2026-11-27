import request from 'supertest';
import { createApp } from '../../src/app.js';
import { emailService } from '../../src/services/emailService.js';
import { UserModel } from '../../src/models/userModel.js';
import { OtpModel } from '../../src/models/otpModel.js';
import { createTestUser } from '../helpers/authHelper.js';

// Integration test suite for authentication endpoints
describe('Auth Integration Tests', () => {
  const app = createApp();

  describe('POST /api/auth/register', () => {
    it('should register a new pending user and send OTP email', async () => {
      const emailSpy = vi.spyOn(emailService, 'sendRegistrationOtpEmail').mockImplementation(() => {});

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(emailSpy).toHaveBeenCalledWith('jane@example.com', expect.any(String));

      const pendingUser = await UserModel.findOne({ email: 'jane@example.com' });
      expect(pendingUser).not.toBeNull();
      expect(pendingUser?.isVerified).toBe(false);
    });

    it('should return 400 if validation fails due to invalid email or short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'J',
          email: 'not-an-email',
          password: '123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 409 if user with verified email already exists', async () => {
      await createTestUser({ email: 'verified@example.com' });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Verified User',
          email: 'verified@example.com',
          password: 'Password123!',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('should verify email with valid OTP and return auth tokens', async () => {
      let capturedOtp = '';
      vi.spyOn(emailService, 'sendRegistrationOtpEmail').mockImplementation((_email, otp) => {
        capturedOtp = otp;
      });

      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Verify Test',
          email: 'verify@example.com',
          password: 'Password123!',
        });

      expect(capturedOtp).toHaveLength(6);

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'verify@example.com',
          otp: capturedOtp,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('verify@example.com');
      expect(response.headers['set-cookie']).toBeDefined();

      const user = await UserModel.findOne({ email: 'verify@example.com' });
      expect(user?.isVerified).toBe(true);
    });

    it('should return 400 for incorrect OTP code', async () => {
      vi.spyOn(emailService, 'sendRegistrationOtpEmail').mockImplementation(() => {});

      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Wrong OTP',
          email: 'wrongotp@example.com',
          password: 'Password123!',
        });

      const response = await request(app)
        .post('/api/auth/verify-email')
        .send({
          email: 'wrongotp@example.com',
          otp: '000000',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login verified user and return auth cookies', async () => {
      const { user, rawPassword } = await createTestUser({
        email: 'login@example.com',
        isVerified: true,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: rawPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(user.email);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 401 for incorrect password', async () => {
      const { user } = await createTestUser({ email: 'wrongpass@example.com' });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'IncorrectPassword999!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 if user account is not verified', async () => {
      const { user, rawPassword } = await createTestUser({
        email: 'unverified@example.com',
        isVerified: false,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: rawPassword,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    it('should rotate access token with valid refresh token cookie', async () => {
      const { refreshCookie } = await createTestUser();

      const response = await request(app)
        .post('/api/auth/refresh-token')
        .set('Cookie', [refreshCookie]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('should return 401 when no refresh token cookie is present', async () => {
      const response = await request(app).post('/api/auth/refresh-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should clear authentication cookies and return 200', async () => {
      const { authHeader } = await createTestUser();

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', authHeader);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/auth/forgot-password & /api/auth/reset-password', () => {
    it('should handle complete password recovery flow', async () => {
      let resetOtp = '';
      vi.spyOn(emailService, 'sendPasswordResetOtpEmail').mockImplementation((_email, otp) => {
        resetOtp = otp;
      });

      const { user } = await createTestUser({ email: 'recover@example.com' });

      const forgotRes = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: user.email });

      expect(forgotRes.status).toBe(200);
      expect(resetOtp).toHaveLength(6);

      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          email: user.email,
          otp: resetOtp,
          newPassword: 'BrandNewPassword123!',
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'BrandNewPassword123!',
        });

      expect(loginRes.status).toBe(200);
    });
  });
});

