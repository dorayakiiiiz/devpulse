import { AxiosError, AxiosHeaders } from 'axios';
import { getApiErrorMessage } from '../../../src/lib/apiError';

// Unit tests for API error message extractor utility
describe('getApiErrorMessage', () => {
  it('should extract validation details string if details object is provided', () => {
    const error = new AxiosError(
      'Request failed with status code 400',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {
          success: false,
          error: 'Validation error',
          details: {
            email: ['Invalid email format'],
            password: ['Password must be at least 8 characters'],
          },
        },
      }
    );

    const message = getApiErrorMessage(error);
    expect(message).toBe('Invalid email format, Password must be at least 8 characters');
  });

  it('should extract error property from API response envelope', () => {
    const error = new AxiosError(
      'Request failed with status code 404',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {
          success: false,
          error: 'Monitor not found',
        },
      }
    );

    const message = getApiErrorMessage(error);
    expect(message).toBe('Monitor not found');
  });

  it('should return network error message when ERR_NETWORK occurs or response is missing', () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK');

    const message = getApiErrorMessage(error);
    expect(message).toBe('Cannot connect to server. Please ensure the backend is running.');
  });

  it('should extract message from standard Error instance', () => {
    const error = new Error('Custom runtime exception');

    const message = getApiErrorMessage(error);
    expect(message).toBe('Custom runtime exception');
  });

  it('should fallback to generic error message for unknown non-error values', () => {
    expect(getApiErrorMessage(null)).toBe('An unexpected error occurred. Please try again.');
    expect(getApiErrorMessage('string error')).toBe('An unexpected error occurred. Please try again.');
    expect(getApiErrorMessage(42)).toBe('An unexpected error occurred. Please try again.');
  });
});
