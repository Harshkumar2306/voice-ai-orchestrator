import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  RefreshCw, PhoneForwarded, Users, Building2, AlertCircle, Phone, 
  CheckCircle2, XCircle, Clock, Search, Filter, UserCheck, UserX, 
  AlertTriangle, Download, Plus, Loader2, Mic, MicOff, Sparkles, 
  Trash2, RotateCcw, ThumbsUp, ThumbsDown, ChevronRight, Mail, Calendar
} from 'lucide-react';
import { 
  getCompanies, getCustomers, triggerCampaign, getAnalytics, 
  exportLeadsCsv, addCustomer, updateCustomerStatus, deleteCustomer 
} from '../api';
import VapiPkg from '@vapi-ai/web';

const Vapi = VapiPkg.default || VapiPkg;

const StatusBadge = ({ status }) => {
  const statusConfig = {
    PENDING: { 
      color: 'bg-slate-100 text-slate-700 border-slate-200', 
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
      icon: AlertTriangle,
      label: 'Needs Review' 
    },
  };

  const config = statusConfig[status] || statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-medium border ${config.color} shadow-2xs whitespace-nowrap`}>
      <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
      {config.label}
    </span>
  );
};

const AnimatedCounter = ({ value, label, icon: Icon, color, bgColor, isActive, onClick }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = typeof value === 'number' ? value : parseInt(value) || 0;
    if (end === 0) { setDisplayValue(0); return; }
    const duration = 500;
    const stepTime = Math.max(Math.floor(duration / end), 25);
    const timer = setInterval(() => {
      start += 1;
      setDisplayValue(start);
      if (start >= end) clearInterval(timer);
    }, stepTime);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <button
      onClick={onClick}
      className={`glass-panel rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-3.5 group transition-all text-left w-full border relative overflow-hidden ${
        isActive 
          ? 'ring-2 ring-blue-500/40 border-blue-300 bg-white/95 shadow-md -translate-y-0.5' 
          : 'border-white/70 hover:border-blue-200 hover:shadow-md hover:-translate-y-0.5'
      }`}
    >
      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-xl ${bgColor} flex items-center justify-center ${color} shrink-0 group-hover:scale-105 transition-transform shadow-2xs`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg sm:text-xl font-semibold text-gray-900 tracking-tight leading-tight">
          {displayValue}
          {typeof value === 'string' && value.includes('%') ? '%' : ''}
        </p>
        <p className="text-[11px] sm:text-xs text-gray-500 font-medium truncate mt-0.5">
          {label}
        </p>
      </div>
      {isActive && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      )}
    </button>
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
  const [statusFilter, setStatusFilter] = useState('ALL');
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
    if (!window.vapiInstance && import.meta.env.VITE_VAPI_PUBLIC_KEY) {
      window.vapiInstance = new Vapi(import.meta.env.VITE_VAPI_PUBLIC_KEY);
    }
    
    if (!window.vapiInstance) return;

    const onCallStart = () => setWebCallState('active');
    const onCallEnd = () => {
      setWebCallState('inactive');
      setActiveWebCustomer(null);
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
      setError("Please add VITE_VAPI_PUBLIC_KEY to your frontend .env to enable in-browser Web Calling.");
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

  // Real-time updates via WebSockets
  useEffect(() => {
    let ws;
    let reconnectTimeout;
    let attempt = 0;

    const connectWebSocket = () => {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws/leads';
      
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        attempt = 0;
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
        const httpHealthUrl = apiUrl.replace(/\/+$/, '') + '/health';
        fetch(httpHealthUrl).catch(() => {});

        const delay = Math.min(1000 * (2 ** attempt), 30000);
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
        ws.onclose = null;
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
      setError('Failed to load tenants. Please verify your backend server.');
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
      // Non-critical
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
      setError(err.response?.data?.detail || 'Failed to initiate outbound campaign.');
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
      setAddLeadError(err.response?.data?.detail || 'Failed to add lead. Check phone format (+91...).');
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
    if (!window.confirm('Are you sure you want to delete this lead? Associated call history will be removed.')) return;
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
  
  // Multi-filtering by search term & active status pill
  const filteredCustomers = customers
    .filter(c => {
      const matchesSearch = !activeSearch ||
        c.name.toLowerCase().includes(activeSearch) || 
        c.phone_number.includes(activeSearch) ||
        (c.email && c.email.toLowerCase().includes(activeSearch)) ||
        (c.status && c.status.toLowerCase().includes(activeSearch));

      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const pendingCount = customers.filter(c => c.status === 'PENDING').length;
  const qualifiedCount = customers.filter(c => c.status === 'QUALIFIED').length;
  const notInterestedCount = customers.filter(c => c.status === 'NOT_INTERESTED').length;
  const needsReviewCount = customers.filter(c => c.status === 'NEEDS_REVIEW').length;
  const failedCount = customers.filter(c => c.status === 'FAILED').length;

  const filterTabs = [
    { id: 'ALL', label: 'All Leads', count: customers.length },
    { id: 'PENDING', label: 'Pending', count: pendingCount },
    { id: 'QUALIFIED', label: 'Qualified', count: qualifiedCount },
    { id: 'NEEDS_REVIEW', label: 'Needs Review', count: needsReviewCount },
    { id: 'NOT_INTERESTED', label: 'Not Interested', count: notInterestedCount },
    ...(failedCount > 0 ? [{ id: 'FAILED', label: 'Failed', count: failedCount }] : []),
  ];

  return (
    <div className="space-y-3 sm:space-y-3.5 flex-1 min-h-0 flex flex-col overflow-hidden h-full">
      
      {/* Header and Controls Card */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 relative overflow-hidden shrink-0 border border-white/70">
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-blue-500 to-teal-400" />
        
        <div className="pl-2.5 sm:pl-3">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 tracking-tight">Campaign Overview</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 max-w-xl leading-relaxed">
            Automate outbound calls and qualify leads in real time.
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 group">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors pointer-events-none" />
            <select
              value={selectedCompanyId}
              onChange={(e) => {
                setSelectedCompanyId(e.target.value);
                setStatusFilter('ALL');
              }}
              className="appearance-none block w-full rounded-xl border border-gray-200/90 bg-white/70 py-2 sm:py-2.5 pl-9 pr-8 text-xs sm:text-sm font-semibold text-gray-900 shadow-2xs focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all hover:bg-white cursor-pointer"
            >
              <option value="" disabled>Select Tenant Space</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-gray-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          <button
            onClick={() => { fetchCustomers(selectedCompanyId); fetchAnalytics(selectedCompanyId); }}
            className="p-2 sm:p-2.5 text-gray-500 bg-white border border-gray-200/80 hover:border-blue-300 hover:text-blue-600 shadow-2xs rounded-xl transition-all active:scale-95 shrink-0 flex items-center justify-center"
            title="Refresh Leads Data"
            aria-label="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50/95 border border-rose-200 text-rose-700 p-3 sm:p-4 rounded-xl flex items-start gap-3 shadow-2xs animate-fade-in shrink-0">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* Analytics Cards with Click-to-Filter */}
      {selectedCompanyId && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 shrink-0">
          <AnimatedCounter 
            value={customers.length} 
            label="Total Leads" 
            icon={Users} 
            color="text-blue-600" 
            bgColor="bg-blue-50"
            isActive={statusFilter === 'ALL'}
            onClick={() => setStatusFilter('ALL')}
          />
          <AnimatedCounter 
            value={qualifiedCount} 
            label="Qualified" 
            icon={UserCheck} 
            color="text-emerald-600" 
            bgColor="bg-emerald-50"
            isActive={statusFilter === 'QUALIFIED'}
            onClick={() => setStatusFilter(statusFilter === 'QUALIFIED' ? 'ALL' : 'QUALIFIED')}
          />
          <AnimatedCounter 
            value={notInterestedCount} 
            label="Not Interested" 
            icon={UserX} 
            color="text-rose-600" 
            bgColor="bg-rose-50"
            isActive={statusFilter === 'NOT_INTERESTED'}
            onClick={() => setStatusFilter(statusFilter === 'NOT_INTERESTED' ? 'ALL' : 'NOT_INTERESTED')}
          />
          <AnimatedCounter 
            value={needsReviewCount} 
            label="Needs Review" 
            icon={AlertTriangle} 
            color="text-amber-600" 
            bgColor="bg-amber-50"
            isActive={statusFilter === 'NEEDS_REVIEW'}
            onClick={() => setStatusFilter(statusFilter === 'NEEDS_REVIEW' ? 'ALL' : 'NEEDS_REVIEW')}
          />
        </div>
      )}

      {/* Main Data Section: Leads Directory */}
      {selectedCompanyId && (
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col flex-1 min-h-0 shadow-sm border border-gray-200/70">
          
          {/* Table Toolbar */}
          <div className="border-b border-gray-100 p-3 sm:p-4 lg:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 bg-white/50 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900 tracking-tight">Lead Directory</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                      {customers.length} Total
                    </span>
                    <span className="text-[11px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                      {pendingCount} Pending
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Search & Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
              <div className="relative w-full sm:w-56 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Filter leads..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 h-9 sm:h-10 w-full bg-white border border-gray-200/90 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setAddLeadError('');
                    setShowAddLeadModal(true);
                  }}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 h-9 sm:h-10 rounded-xl font-semibold text-xs sm:text-sm bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-all shadow-2xs active:scale-95"
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
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 h-9 sm:h-10 rounded-xl font-semibold text-xs sm:text-sm bg-white border border-gray-200 text-gray-700 hover:text-emerald-700 hover:border-emerald-300 transition-all shadow-2xs active:scale-95"
                  title="Export leads to CSV"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>

                <button
                  onClick={handleTriggerCampaign}
                  disabled={triggering || pendingCount === 0}
                  className={`flex-1 sm:flex-none relative overflow-hidden flex items-center justify-center gap-1.5 px-4 h-9 sm:h-10 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-sm group ${
                    triggering || pendingCount === 0
                      ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                      : 'bg-gradient-to-r from-gray-900 to-slate-800 text-white hover:from-black hover:to-gray-900 border border-transparent hover:shadow active:scale-95'
                  }`}
                >
                  {!triggering && pendingCount > 0 && (
                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-[shimmer_1.5s_infinite]" />
                  )}
                  {triggering ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <PhoneForwarded className="w-4 h-4" />
                  )}
                  <span>{triggering ? 'Dialing...' : 'Launch Campaign'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Status Filter Pills Bar */}
          <div className="px-3 sm:px-5 py-2 border-b border-gray-100 bg-gray-50/40 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
            {filterTabs.map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-2xs' 
                      : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-gray-200/80 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Table Container (Desktop & Tablet) / Mobile Cards */}
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 custom-scrollbar">
            
            {/* Loading State */}
            {loading ? (
              <div className="p-8 sm:p-12 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                <p className="text-xs sm:text-sm font-semibold text-gray-500">Loading leads data...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-8 sm:p-14 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mx-auto mb-3">
                  <Filter className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-gray-800">No matching leads found</h4>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  {activeSearch || statusFilter !== 'ALL'
                    ? "Try adjusting your search query or status filter to view more results."
                    : "Add your first lead using the '+ Add Lead' button to get started."}
                </p>
                {(activeSearch || statusFilter !== 'ALL') && (
                  <button 
                    onClick={() => { setSearchTerm(''); setStatusFilter('ALL'); }}
                    className="mt-3 text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Clear active filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop/Tablet Table View (Hidden on mobile < 640px) */}
                <table className="hidden sm:table min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm shadow-2xs">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Customer Name</th>
                      <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Contact Details</th>
                      <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Added On</th>
                      <th scope="col" className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Current Status</th>
                      <th scope="col" className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/60 divide-y divide-gray-100/80">
                    {filteredCustomers.map((customer) => (
                      <tr 
                        key={customer._id} 
                        onClick={() => setSelectedLead(customer)}
                        className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-100 to-teal-100 border border-white flex items-center justify-center text-blue-700 font-semibold text-xs uppercase shadow-2xs shrink-0">
                              {customer.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs sm:text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors block truncate">
                                {customer.name}
                              </span>
                              {customer.email && (
                                <span className="text-[11px] text-gray-400 block truncate">{customer.email}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 font-medium font-mono">
                            <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            {customer.phone_number}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="text-xs text-gray-500">
                            {customer.created_at ? new Date(customer.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <StatusBadge status={customer.status} />
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs font-semibold">
                          <div className="flex justify-end items-center gap-2" onClick={e => e.stopPropagation()}>
                            {customer.status === 'PENDING' && (
                              <button 
                                onClick={() => {
                                  if (webCallState === 'active' || webCallState === 'connecting') {
                                    endWebCall();
                                  } else {
                                    handleWebCall(customer);
                                  }
                                }}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                                  (webCallState === 'active' || webCallState === 'connecting') && activeWebCustomer?._id === customer._id
                                    ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100'
                                }`}
                              >
                                {(webCallState === 'active' || webCallState === 'connecting') && activeWebCustomer?._id === customer._id ? (
                                  <>
                                    <MicOff className="w-3.5 h-3.5" /> End
                                  </>
                                ) : (
                                  <>
                                    <Mic className="w-3.5 h-3.5" /> Call
                                  </>
                                )}
                              </button>
                            )}
                            <button 
                              onClick={() => setSelectedLead(customer)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50/80 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <span>Details</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile Responsive Cards (Visible on mobile < 640px) */}
                <div className="sm:hidden divide-y divide-gray-100 p-2 space-y-2">
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer._id}
                      onClick={() => setSelectedLead(customer)}
                      className="p-3.5 rounded-xl bg-white/80 border border-gray-200/80 shadow-2xs flex flex-col gap-2.5 active:bg-blue-50/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-100 to-teal-100 border border-white flex items-center justify-center text-blue-700 font-semibold text-xs uppercase shadow-2xs shrink-0">
                            {customer.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-gray-900 leading-tight">{customer.name}</p>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{customer.phone_number}</p>
                          </div>
                        </div>
                        <StatusBadge status={customer.status} />
                      </div>

                      {customer.email && (
                        <p className="text-[11px] text-gray-400 truncate flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {customer.email}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {customer.created_at ? new Date(customer.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent'}
                        </span>
                        
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          {customer.status === 'PENDING' && (
                            <button
                              onClick={() => handleWebCall(customer)}
                              className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg font-semibold text-xs flex items-center gap-1 border border-indigo-100"
                            >
                              <Mic className="w-3 h-3" /> Call
                            </button>
                          )}
                          <span className="text-blue-600 font-semibold flex items-center gap-0.5">
                            View <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lead Detail Modal - Portaled to document.body */}
      {selectedLead && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in" 
          onClick={() => setSelectedLead(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 sm:p-6 relative border border-gray-100 overflow-hidden max-h-[92vh] flex flex-col" 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedLead(null)} 
              className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
            
            {/* Modal Header */}
            <div className="flex items-center gap-3.5 mb-4 shrink-0">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-blue-100 via-teal-100 to-indigo-100 border-2 border-white shadow-md flex items-center justify-center text-blue-700 font-semibold text-base uppercase shrink-0">
                {selectedLead.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{selectedLead.name}</h3>
                <p className="text-xs sm:text-sm text-gray-600 font-medium font-mono flex items-center gap-1.5 mt-0.5 truncate">
                  <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {selectedLead.phone_number}
                </p>
                {selectedLead.email && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{selectedLead.email}</p>
                )}
              </div>
            </div>

            {statusFeedback && (
              <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                {statusFeedback}
              </div>
            )}

            {/* Scrollable Modal Content */}
            <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
              <div className="flex items-center justify-between p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-500 font-semibold">Current Lead Status</span>
                <StatusBadge status={selectedLead.status} />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-500 font-semibold">Tenant Space</span>
                <span className="text-xs font-semibold text-gray-900">{selectedCompany?.name || 'Dream Homes Realty'}</span>
              </div>

              {selectedLead.created_at && (
                <div className="flex items-center justify-between p-3 bg-gray-50/80 rounded-xl border border-gray-100">
                  <span className="text-xs text-gray-500 font-semibold">Record Created</span>
                  <span className="text-xs text-gray-700">
                    {new Date(selectedLead.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
              )}

              {/* AI Analysis Insights */}
              {(selectedLead.confidence_score !== undefined || selectedLead.sentiment) && (
                <div className="p-3.5 sm:p-4 bg-gradient-to-br from-indigo-50/70 to-blue-50/70 border border-indigo-100 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-semibold text-indigo-700 flex items-center gap-1.5 tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> LangGraph AI Insights
                    </span>
                    {selectedLead.sentiment && (
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
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
                      <div className="flex justify-between text-xs text-gray-600 font-semibold mb-1">
                        <span>Evaluation Confidence</span>
                        <span className="font-semibold text-gray-900">{(selectedLead.confidence_score * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-200/80 rounded-full overflow-hidden">
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
                    <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100/70 text-xs text-gray-700 leading-relaxed font-medium">
                      {selectedLead.review_notes}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Human-in-the-Loop Resolution Action Buttons */}
            <div className="mt-4 pt-3.5 border-t border-gray-100 shrink-0">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Human-in-the-loop actions
              </p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  onClick={() => handleStatusChange('QUALIFIED')}
                  disabled={updatingStatus || selectedLead.status === 'QUALIFIED'}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  Mark Qualified
                </button>
                <button
                  onClick={() => handleStatusChange('NOT_INTERESTED')}
                  disabled={updatingStatus || selectedLead.status === 'NOT_INTERESTED'}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
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
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Pending
                </button>
                <button
                  onClick={() => handleDeleteLead(selectedLead._id)}
                  disabled={updatingStatus}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white text-rose-600 border border-rose-200 hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
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

      {/* Add Lead Modal */}
      {showAddLeadModal && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" 
          onClick={() => setShowAddLeadModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowAddLeadModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <XCircle className="w-5 h-5" />
            </button>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">Add Custom Lead</h3>
            <p className="text-xs sm:text-sm text-gray-500 mb-5 leading-relaxed">
              Add a customer to test AI outbound qualification with any phone number.
            </p>

            {addLeadError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {addLeadError}
              </div>
            )}

            <form onSubmit={handleAddLead} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200/50 transition-all outline-none"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number (with country code)</label>
                <input 
                  type="text" 
                  required
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200/50 transition-all outline-none font-mono"
                  placeholder="e.g. +919876543210"
                />
                <p className="text-[11px] text-gray-400 mt-1">Include country code with + (e.g. +91 for India, +1 for US)</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address (Optional)</label>
                <input 
                  type="email" 
                  value={newLeadEmail}
                  onChange={(e) => setNewLeadEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200/50 transition-all outline-none"
                  placeholder="e.g. rahul@example.com"
                />
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={addingLead}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-70"
                >
                  {addingLead ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>{addingLead ? 'Adding Lead...' : 'Add Lead to Campaign'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Shimmer animation keyframes */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
};

export default Dashboard;
