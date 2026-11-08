import { AppError } from '../../src/utils/appError.js';

// Unit tests for centralized AppError class
describe('AppError', () => {
  it('should create an error with message and default 400 status code', () => {
    const error = new AppError('Bad request');
    expect(error.message).toBe('Bad request');
    expect(error.statusCode).toBe(400);
    expect(error).toBeInstanceOf(Error);
  });

  it('should create an error with custom status code', () => {
    const error = new AppError('Unauthorized access', 401);
    expect(error.message).toBe('Unauthorized access');
    expect(error.statusCode).toBe(401);
  });
});
