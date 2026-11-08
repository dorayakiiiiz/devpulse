import axios, { AxiosError } from 'axios';
import { ApiErrorResponse } from '../types/api';

// Extract human-readable error message from backend API or network failure
export function getApiErrorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) {
    if (err instanceof Error) {
      return err.message;
    }
    return 'An unexpected error occurred. Please try again.';
  }

  const axiosErr = err as AxiosError<ApiErrorResponse>;

  if (!axiosErr.response || axiosErr.code === 'ERR_NETWORK') {
    return 'Cannot connect to server. Please ensure the backend is running.';
  }

  if (axiosErr.response.data?.details && typeof axiosErr.response.data.details === 'object') {
    const fieldErrors = Object.values(axiosErr.response.data.details).flat().join(', ');
    if (fieldErrors) {
      return fieldErrors;
    }
  }

  if (axiosErr.response.data?.error) {
    return axiosErr.response.data.error;
  }

  return 'An unexpected error occurred. Please try again.';
}

