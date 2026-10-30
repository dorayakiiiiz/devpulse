import axios, { AxiosInstance } from 'axios';

// Configured Axios instance with cookie credentials support
export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

