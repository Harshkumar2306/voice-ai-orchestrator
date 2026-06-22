import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
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

export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const register = async (full_name, email, password) => {
  const response = await api.post('/auth/register', { full_name, email, password });
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

export default api;
