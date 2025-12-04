import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  const tenantId = localStorage.getItem('tenant_id');
  if (tenantId) {
    config.headers = config.headers || {};
    config.headers['x-tenant-id'] = tenantId;
  }

  const userRole = localStorage.getItem('auth_role');
  if (userRole) {
    config.headers = config.headers || {};
    config.headers['x-user-role'] = userRole;
  }

  const userId = localStorage.getItem('auth_user_id');
  if (userId) {
    config.headers = config.headers || {};
    config.headers['x-user-id'] = userId;
  }

  const training = localStorage.getItem('nuru_training');
  if (training === '1') {
    config.headers = config.headers || {};
    config.headers['x-training-mode'] = 'true';
  }

  return config;
});