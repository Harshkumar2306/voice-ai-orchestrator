import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export default api;
