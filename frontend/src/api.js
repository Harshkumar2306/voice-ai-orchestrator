import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000, // 60s timeout to allow free-tier cold starts to boot
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Automatic retry interceptor for free-tier cold starts (502, 503, 504, or network errors)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    // Only retry for server wake-up errors (network error, timeout, or 502/503/504)
    const isColdStartError = 
      !error.response || 
      [502, 503, 504, 524].includes(error.response?.status) ||
      error.code === 'ECONNABORTED' ||
      error.message?.includes('Network Error');

    config.__retryCount = config.__retryCount || 0;

    // Retry up to 3 times
    if (isColdStartError && config.__retryCount < 3) {
      config.__retryCount += 1;
      const delay = config.__retryCount * 2000;
      console.warn(`[ColdStart] Cloud server waking up. Retrying request (${config.__retryCount}/3) in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return api(config);
    }

    return Promise.reject(error);
  }
);

export const healthCheck = async () => {
  try {
    const response = await api.get('/health', { timeout: 15000 });
    return response.data;
  } catch (e) {
    return null;
  }
};

export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const register = async (full_name, email, password) => {
  const response = await api.post('/auth/register', { full_name, email, password });
  return response.data;
};

export const resetPassword = async (email) => {
  const response = await api.post('/auth/reset-password', { email });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const getCompanies = async () => {
  const response = await api.get('/companies');
  return response.data;
};

export const getCustomers = async (companyId) => {
  const response = await api.get(`/customers/${companyId}`);
  return response.data;
};

export const triggerCampaign = async (companyId) => {
  const response = await api.post('/campaign/trigger', { company_id: companyId });
  return response.data;
};

export const getCallLogs = async (companyId) => {
  const response = await api.get(`/call-logs/${companyId}`);
  return response.data;
};

export const getAnalytics = async (companyId) => {
  const response = await api.get(`/analytics/${companyId}`);
  return response.data;
};
export const updateSettings = async (settingsData) => {
  const response = await api.put('/auth/me/settings', settingsData);
  return response.data;
};

export const updatePassword = async (passwordData) => {
  const response = await api.put('/auth/me/password', passwordData);
  return response.data;
};

export const getNotifications = async () => {
  const response = await api.get('/notifications');
  return response.data;
};

export const markNotificationRead = async (id) => {
  const response = await api.put(`/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsRead = async () => {
  const response = await api.put('/notifications/read-all');
  return response.data;
};

export const updateCompanyInstructions = async (companyId, instructions) => {
  const response = await api.put(`/companies/${companyId}/instructions`, { instructions });
  return response.data;
};

export const exportLeadsCsv = async (companyId) => {
  const response = await api.get(`/customers/${companyId}/export`, { responseType: 'blob' });
  return response.data;
};

export const addCustomer = async (customerData) => {
  const response = await api.post('/customers', customerData);
  return response.data;
};

export const updateCustomerStatus = async (customerId, status, notes = null) => {
  const response = await api.patch(`/customers/${customerId}/status`, { status, notes });
  return response.data;
};

export const deleteCustomer = async (customerId) => {
  const response = await api.delete(`/customers/${customerId}`);
  return response.data;
};

export default api;

