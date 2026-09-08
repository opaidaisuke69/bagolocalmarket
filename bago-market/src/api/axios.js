import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.PROD ? '/server/api' : '/api',
  // Do NOT set a global Content-Type here — axios sets it automatically
  // (including the correct boundary for multipart/form-data)
});

// Request interceptor — attach token but never override Content-Type
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Let axios handle Content-Type automatically:
    // - FormData → multipart/form-data  (with boundary)
    // - plain object → application/json
    // Forcing it breaks multipart uploads, so we only set it for JSON bodies.
    if (
      config.data &&
      !(config.data instanceof FormData) &&
      !config.headers['Content-Type']
    ) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Don't redirect - let the app handle it via context
    }
    return Promise.reject(error);
  }
);

export default api;
