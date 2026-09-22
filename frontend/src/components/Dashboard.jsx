import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, PhoneForwarded, Users, Building2, AlertCircle, Phone, CheckCircle2, XCircle, Clock, Search, Filter, TrendingUp, BarChart3, UserCheck, UserX, AlertTriangle, Download, Plus, Loader2, Mic, MicOff, Sparkles, Trash2, RotateCcw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { getCompanies, getCustomers, triggerCampaign, getAnalytics, exportLeadsCsv, addCustomer, updateCustomerStatus, deleteCustomer } from '../api';
import VapiPkg from '@vapi-ai/web';

const Vapi = VapiPkg.default || VapiPkg;

const StatusBadge = ({ status }) => {
  const statusConfig = {
    PENDING: { 
      color: 'bg-gray-100 text-gray-700 border-gray-200', 
      icon: Clock,
      label: 'Pending' 
    },
    CALL_INITIATED: { 
      color: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse', 
      icon: Phone,
      label: 'Calling...' 
    },
    QUALIFIED: { 
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200', 
      icon: CheckCircle2,
      label: 'Qualified' 
    },
    NOT_INTERESTED: { 
      color: 'bg-rose-50 text-rose-700 border-rose-200', 
      icon: XCircle,
      label: 'Not Interested' 
    },
    FAILED: { 
      color: 'bg-orange-50 text-orange-700 border-orange-200', 
      icon: AlertCircle,
      label: 'Failed' 
    },
    NEEDS_REVIEW: { 
      color: 'bg-amber-50 text-amber-700 border-amber-200', 
      icon: AlertCircle,
      label: 'Needs Review' 
    },
  };

  const config = statusConfig[status] || statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${config.color} shadow-sm transition-all`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </div>
  );
};

const AnimatedCounter = ({ value, label, icon: Icon, color, bgColor }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value || 0;
    if (end === 0) { setDisplayValue(0); return; }
    const duration = 600;
    const stepTime = Math.max(Math.floor(duration / end), 30);
    const timer = setInterval(() => {
      start += 1;
      setDisplayValue(start);
      if (start >= end) clearInterval(timer);
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <div className="glass-panel rounded-xl p-4 flex items-center gap-4 group hover:shadow-md transition-all">
      <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{displayValue}{typeof value === 'string' && value.includes('%') ? '%' : ''}</p>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
      </div>
    </div>
  );
};

const Dashboard = ({ globalSearch = '' }) => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [customers, setCustomers] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState('');

  // Add Lead Modal State
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [addingLead, setAddingLead] = useState(false);
  const [addLeadError, setAddLeadError] = useState('');

  // Web Call State
  const [webCallState, setWebCallState] = useState('inactive'); // 'inactive', 'connecting', 'active'
  const [activeWebCustomer, setActiveWebCustomer] = useState(null);

  useEffect(() => {
    // We only need one Vapi instance per session
    if (!window.vapiInstance && import.meta.env.VITE_VAPI_PUBLIC_KEY) {
      window.vapiInstance = new Vapi(import.meta.env.VITE_VAPI_PUBLIC_KEY);
    }
    
    if (!window.vapiInstance) return;

    const onCallStart = () => setWebCallState('active');
    const onCallEnd = () => {
      setWebCallState('inactive');
      setActiveWebCustomer(null);
      // Wait a moment for webhook to process, then refresh
      if (selectedCompanyId) {
        setTimeout(() => fetchCustomers(selectedCompanyId), 3000);
      }
    };
    const onError = (e) => {
      setWebCallState('inactive');
      setActiveWebCustomer(null);
      setError('Web call failed: ' + e.message);
    };

    window.vapiInstance.on('call-start', onCallStart);
    window.vapiInstance.on('call-end', onCallEnd);
    window.vapiInstance.on('error', onError);

    return () => {
      window.vapiInstance.off('call-start', onCallStart);
      window.vapiInstance.off('call-end', onCallEnd);
      window.vapiInstance.off('error', onError);
    };
  }, [selectedCompanyId]);

  const handleWebCall = async (customer) => {
    if (!import.meta.env.VITE_VAPI_PUBLIC_KEY) {
      setError("Please add VITE_VAPI_PUBLIC_KEY to your environment variables to use Web Calling.");
      return;
    }
    if (!window.vapiInstance) {
      window.vapiInstance = new Vapi(import.meta.env.VITE_VAPI_PUBLIC_KEY);
    }

    setWebCallState('connecting');
    setActiveWebCustomer(customer);
    setError('');
    
    const company = companies.find(c => c._id === selectedCompanyId);
    const systemPrompt = `You are an AI assistant calling on behalf of ${company?.name || 'our company'}.\nYou are speaking with ${customer.name}.\n${company?.instructions || ''}\nYour goal is to qualify the lead and collect information. Keep the conversation concise and natural.`;
    
    const assistant = {
      model: {
        provider: "openai",
        model: "gpt-3.5-turbo",
        messages: [{ role: "system", content: systemPrompt }]
      },
      voice: {
        provider: "11labs",
        voiceId: "bIHbv24MWmeRgasZH58o"
      },
      serverUrl: (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '') + '/webhooks/vapi',
      serverMessages: ["end-of-call-report", "status-update", "hang", "transcript"],
      firstMessage: `Hello ${customer.name}, this is calling from ${company?.name}. How are you today?`,
      metadata: {
        customer_id: customer._id,
        company_id: selectedCompanyId
      }
    };
    
    try {
      await window.vapiInstance.start(assistant);
    } catch (e) {
      setWebCallState('inactive');
      setActiveWebCustomer(null);
      setError('Failed to start web call: ' + e.message);
    }
  };

  const endWebCall = () => {
    if (window.vapiInstance) {
      window.vapiInstance.stop();
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCustomers(selectedCompanyId);
      fetchAnalytics(selectedCompanyId);
    } else {
      setCustomers([]);
      setAnalytics(null);
    }
  }, [selectedCompanyId]);

  // Real-time updates via WebSockets with Exponential Backoff Reconnection
  useEffect(() => {
    let ws;
    let reconnectTimeout;
    let attempt = 0;

    const connectWebSocket = () => {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/leads';
      
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("WebSocket connected");
        attempt = 0; // reset attempts on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'lead_updated') {
            if (selectedCompanyId && (!data.company_id || data.company_id === selectedCompanyId)) {
               fetchCustomers(selectedCompanyId);
               fetchAnalytics(selectedCompanyId);
            }
          }
        } catch (e) {
          console.error("WebSocket parsing error", e);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected. Attempting to reconnect...");
        const delay = Math.min(1000 * (2 ** attempt), 30000); // Max 30s delay
        reconnectTimeout = setTimeout(() => {
          attempt++;
          connectWebSocket();
        }, delay);
      };
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null; // Prevent reconnection trigger on intentional unmount
        ws.close();
      }
    };
  }, [selectedCompanyId]);

  const fetchCompanies = async () => {
    try {
      const data = await getCompanies();
      setCompanies(data.companies || []);
      if (data.companies && data.companies.length > 0) {
        setSelectedCompanyId(data.companies[0]._id);
      }
    } catch (err) {
      setError('Failed to load tenants. Please ensure the backend is running.');
    }
  };

  const fetchCustomers = async (companyId) => {
    setLoading(true);
    setError('');
    try {
      const data = await getCustomers(companyId);
      setCustomers(data.customers || []);
    } catch (err) {
      setError('Failed to load leads for this tenant.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async (companyId) => {
    try {
      const data = await getAnalytics(companyId);
      setAnalytics(data);
    } catch (err) {
      // Analytics is optional, don't show error
    }
  };

  const handleTriggerCampaign = async () => {
    if (!selectedCompanyId) return;
    setTriggering(true);
    setError('');
    try {
      await triggerCampaign(selectedCompanyId);
      await fetchCustomers(selectedCompanyId);
    } catch (err) {
      setError('Failed to initiate outbound campaign.');
    } finally {
      setTriggering(false);
    }
  };

  const handleAddLead = async (e) => {
    e.preventDefault();
    if (!newLeadName || !newLeadPhone) {
      setAddLeadError('Name and Phone Number are required.');
      return;
    }
    setAddingLead(true);
    setAddLeadError('');
    try {
      await addCustomer({
        company_id: selectedCompanyId,
        name: newLeadName,
        phone_number: newLeadPhone,
        email: newLeadEmail
      });
      setShowAddLeadModal(false);
      setNewLeadName('');
      setNewLeadPhone('');
      setNewLeadEmail('');
      await fetchCustomers(selectedCompanyId);
      await fetchAnalytics(selectedCompanyId);
    } catch (err) {
      setAddLeadError('Failed to add lead. Please check the details and try again.');
    } finally {
      setAddingLead(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedLead) return;
    setUpdatingStatus(true);
    setStatusFeedback('');
    try {
      await updateCustomerStatus(selectedLead._id, newStatus);
      setSelectedLead(prev => ({ ...prev, status: newStatus }));
      await fetchCustomers(selectedCompanyId);
      await fetchAnalytics(selectedCompanyId);
      setStatusFeedback(`Status updated to ${newStatus}`);
      setTimeout(() => setStatusFeedback(''), 2500);
    } catch (e) {
      setError('Failed to update lead status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteLead = async (customerId) => {
    if (!window.confirm('Are you sure you want to delete this lead? This will also remove associated call logs.')) return;
    setUpdatingStatus(true);
    try {
      await deleteCustomer(customerId);
      setSelectedLead(null);
      await fetchCustomers(selectedCompanyId);
      await fetchAnalytics(selectedCompanyId);
    } catch (e) {
      setError('Failed to delete lead');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const selectedCompany = companies.find((c) => c._id === selectedCompanyId);
  const activeSearch = (searchTerm || globalSearch || '').trim().toLowerCase();
  const filteredCustomers = customers
    .filter(c => 
      !activeSearch ||
      c.name.toLowerCase().includes(activeSearch) || 
      c.phone_number.includes(activeSearch) ||
      (c.email && c.email.toLowerCase().includes(activeSearch)) ||
      (c.status && c.status.toLowerCase().includes(activeSearch))
    )
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const pendingCount = customers.filter(c => c.status === 'PENDING').length;
  const qualifiedCount = customers.filter(c => c.status === 'QUALIFIED').length;
  const notInterestedCount = customers.filter(c => c.status === 'NOT_INTERESTED').length;
  const needsReviewCount = customers.filter(c => c.status === 'NEEDS_REVIEW').length;

  return (
    <div className="space-y-6 h-full flex flex-col overflow-hidden">
      {/* Header and Controls */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden shrink-0">
        {/* Subtle gradient accent */}
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-blue-500 to-teal-400" />
        
        <div className="pl-4">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Campaign Overview</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Select a tenant space to monitor active voice agents and launch outbound lead qualification campaigns.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative group">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="appearance-none block w-full sm:w-64 rounded-xl border border-gray-200/80 bg-white/50 py-2.5 pl-10 pr-10 text-gray-900 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:text-sm transition-all hover:bg-white"
            >
              <option value="" disabled>Select Tenant Space</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
          
          <button
            onClick={() => { fetchCustomers(selectedCompanyId); fetchAnalytics(selectedCompanyId); }}
            className="p-2.5 text-gray-500 bg-white border border-gray-200/80 hover:border-blue-300 hover:text-blue-600 shadow-sm rounded-xl transition-all active:scale-95 flex items-center justify-center"
            title="Refresh Leads Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>



      {error && (
        <div className="bg-red-50/90 backdrop-blur-md border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Analytics Cards */}
      {selectedCompanyId && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AnimatedCounter value={customers.length} label="Total Leads" icon={Users} color="text-blue-600" bgColor="bg-blue-50" />
          <AnimatedCounter value={qualifiedCount} label="Qualified" icon={UserCheck} color="text-emerald-600" bgColor="bg-emerald-50" />
          <AnimatedCounter value={notInterestedCount} label="Not Interested" icon={UserX} color="text-rose-600" bgColor="bg-rose-50" />
          <AnimatedCounter value={needsReviewCount} label="Needs Review" icon={AlertTriangle} color="text-amber-600" bgColor="bg-amber-50" />
        </div>
      )}

      {/* Lead Detail Modal - Portaled to document.body */}
      {selectedLead && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" 
          onClick={() => setSelectedLead(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative border border-gray-100 overflow-hidden" 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedLead(null)} 
              className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-100 to-teal-100 border-2 border-white shadow-md flex items-center justify-center text-blue-700 font-bold text-xl uppercase">
                {selectedLead.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedLead.name}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" /> {selectedLead.phone_number}
                </p>
                {selectedLead.email && <p className="text-xs text-gray-400 mt-0.5">{selectedLead.email}</p>}
              </div>
            </div>

            {statusFeedback && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium rounded-xl flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {statusFeedback}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-600 font-medium">Current Status</span>
                <StatusBadge status={selectedLead.status} />
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm text-gray-600 font-medium">Company Space</span>
                <span className="text-sm font-semibold text-gray-900">{selectedCompany?.name}</span>
              </div>
              {selectedLead.created_at && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-600 font-medium">Added On</span>
                  <span className="text-sm text-gray-700">{new Date(selectedLead.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
              )}

              {/* AI Analysis Insights if available */}
              {(selectedLead.confidence_score !== undefined || selectedLead.sentiment) && (
                <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-bold text-indigo-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> AI Evaluation Insights
                    </span>
                    {selectedLead.sentiment && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        selectedLead.sentiment === 'POSITIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        selectedLead.sentiment === 'NEGATIVE' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-gray-50 text-gray-700 border-gray-200'
                      }`}>
                        {selectedLead.sentiment === 'POSITIVE' ? '😊 Positive' : selectedLead.sentiment === 'NEGATIVE' ? '😞 Negative' : '😐 Neutral'}
                      </span>
                    )}
                  </div>
                  {selectedLead.confidence_score !== undefined && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 font-medium mb-1">
                        <span>Confidence Score</span>
                        <span>{(selectedLead.confidence_score * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            selectedLead.confidence_score >= 0.8 ? 'bg-emerald-500' :
                            selectedLead.confidence_score >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(Math.max(selectedLead.confidence_score * 100, 5), 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {selectedLead.review_notes && (
                    <p className="text-xs text-gray-600 italic mt-1 bg-white/70 p-2 rounded-lg border border-indigo-100/60">
                      {selectedLead.review_notes}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Human-in-the-Loop Resolution Action Buttons */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                Human Resolution Actions
              </p>
              <div className="grid grid-cols-2 gap-2 mb-2.5">
                <button
                  onClick={() => handleStatusChange('QUALIFIED')}
                  disabled={updatingStatus || selectedLead.status === 'QUALIFIED'}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  title="Approve as Qualified Lead"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  Mark Qualified
                </button>
                <button
                  onClick={() => handleStatusChange('NOT_INTERESTED')}
                  disabled={updatingStatus || selectedLead.status === 'NOT_INTERESTED'}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  title="Mark as Not Interested"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  Not Interested
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStatusChange('PENDING')}
                  disabled={updatingStatus || selectedLead.status === 'PENDING'}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  title="Reset status back to Pending for redial"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Pending
                </button>
                <button
                  onClick={() => handleDeleteLead(selectedLead._id)}
                  disabled={updatingStatus}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                  title="Delete this lead permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Main Data Section */}
      {selectedCompanyId && (
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0 shadow-sm border border-gray-200/60 mb-2">
          {/* Table Toolbar */}
          <div className="border-b border-gray-100 p-4 lg:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/40 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Lead Directory</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{customers.length} Total</span>
                  <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">{pendingCount} Pending</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Filter leads..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 h-10 w-full bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setAddLeadError('');
                    setShowAddLeadModal(true);
                  }}
                  className="flex items-center justify-center gap-1.5 px-4 h-10 rounded-lg font-medium text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 transition-all shadow-sm active:scale-95"
                  title="Add custom lead"
                >
                <Plus className="w-4 h-4" />
                Add Lead
              </button>

              <button
                onClick={async () => {
                  try {
                    const blob = await exportLeadsCsv(selectedCompanyId);
                    const url = window.URL.createObjectURL(new Blob([blob]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `${selectedCompany?.name || 'leads'}_export.csv`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                  } catch (e) { console.error('Export failed', e); }
                }}
                className="flex items-center justify-center gap-1.5 px-4 h-10 rounded-lg font-medium text-sm bg-white border border-gray-200 text-gray-600 hover:text-emerald-600 hover:border-emerald-300 transition-all shadow-sm active:scale-95"
                title="Export leads as CSV"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>

              <button
                onClick={handleTriggerCampaign}
                disabled={triggering || pendingCount === 0}
                className={`relative overflow-hidden flex items-center justify-center gap-2 px-5 h-10 rounded-lg font-medium text-sm transition-all shadow-md group ${
                  triggering || pendingCount === 0
                    ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                    : 'bg-gray-900 text-white hover:bg-black border border-transparent hover:shadow-lg active:scale-95'
                }`}
              >
                {/* Button shine effect for non-disabled state */}
                {!triggering && pendingCount > 0 && (
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
                )}
                
                {triggering ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <PhoneForwarded className={`w-4 h-4 ${pendingCount > 0 ? 'group-hover:-rotate-12 transition-transform' : ''}`} />
                )}
                {triggering ? 'Dialing...' : 'Launch Campaign'}
              </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 rounded-b-2xl">
            <table className="min-w-full divide-y divide-gray-100 relative">
              <thead className="bg-gray-50/90 backdrop-blur-md sticky top-0 z-10 shadow-sm">
                <tr>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Customer Name
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Contact Details
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Added On
                  </th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Current Status
                  </th>
                  <th scope="col" className="px-4 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/60 divide-y divide-gray-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                      <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                      <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                      <td className="px-4 py-4"><div className="h-6 bg-gray-200 rounded-full w-24"></div></td>
                      <td className="px-4 py-4 text-right"><div className="h-4 bg-gray-200 rounded w-8 ml-auto"></div></td>
                    </tr>
                  ))
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
                          <Filter className="w-6 h-6" />
                        </div>
                        <p className="text-gray-500 font-medium">No leads match your criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer._id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-100 to-gray-200 border border-gray-300 flex items-center justify-center text-gray-600 font-bold text-xs uppercase shadow-sm">
                            {customer.name.charAt(0)}
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                              {customer.name}
                            </span>
                            {customer.email && (
                              <p className="text-xs text-gray-400">{customer.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 font-medium">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {customer.phone_number}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {customer.created_at ? new Date(customer.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <StatusBadge status={customer.status} />
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end items-center gap-2">
                          {customer.status === 'PENDING' && (
                            <button 
                              onClick={() => {
                                if (webCallState === 'active' || webCallState === 'connecting') {
                                  endWebCall();
                                } else {
                                  handleWebCall(customer);
                                }
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                (webCallState === 'active' || webCallState === 'connecting') && activeWebCustomer?._id === customer._id
                                  ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                              }`}
                            >
                              {(webCallState === 'active' || webCallState === 'connecting') && activeWebCustomer?._id === customer._id ? (
                                <>
                                  <MicOff className="w-4 h-4" /> End Call
                                </>
                              ) : (
                                <>
                                  <Mic className="w-4 h-4" /> Web Call
                                </>
                              )}
                            </button>
                          )}
                          <button 
                            onClick={() => setSelectedLead(customer)}
                            className="text-gray-400 hover:text-blue-600 transition-colors px-2 py-1 rounded"
                          >
                            View details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Lead Modal */}
      {showAddLeadModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowAddLeadModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAddLeadModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <XCircle className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Add Custom Lead</h3>
            <p className="text-sm text-gray-500 mb-6">Add a new customer to test the AI voice agent with your own phone number.</p>

            {addLeadError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {addLeadError}
              </div>
            )}

            <form onSubmit={handleAddLead} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input 
                  type="text" 
                  required
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                  placeholder="e.g. +1234567890"
                />
                <p className="text-xs text-gray-400 mt-1">Must include country code (e.g. +91...)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address (Optional)</label>
                <input 
                  type="email" 
                  value={newLeadEmail}
                  onChange={(e) => setNewLeadEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                  placeholder="e.g. john@example.com"
                />
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={addingLead}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                >
                  {addingLead ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {addingLead ? 'Adding...' : 'Add Lead to Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Shimmer animation keyframes added via a style tag since tailwind arb isn't easiest here */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
};

export default Dashboard;
