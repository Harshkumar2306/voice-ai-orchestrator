import React, { useState, useEffect } from 'react';
import { RefreshCw, PhoneForwarded, Users, Building2, AlertCircle, Phone, CheckCircle2, XCircle, Clock, Search, Filter } from 'lucide-react';
import { getCompanies, getCustomers, triggerCampaign } from '../api';

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

const Dashboard = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCustomers(selectedCompanyId);
    } else {
      setCustomers([]);
    }
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

  const selectedCompany = companies.find((c) => c._id === selectedCompanyId);
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone_number.includes(searchTerm)
  );

  const pendingCount = customers.filter(c => c.status === 'PENDING').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header and Controls */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
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
            onClick={() => fetchCustomers(selectedCompanyId)}
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

      {/* Main Data Section */}
      {selectedCompanyId && (
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col">
          {/* Table Toolbar */}
          <div className="border-b border-gray-100 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedCompany?.name} Leads</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{customers.length} Total</span>
                  <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md">{pendingCount} Pending</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Filter leads..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 w-full lg:w-48 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-sm"
                />
              </div>

              <button
                onClick={handleTriggerCampaign}
                disabled={triggering || pendingCount === 0}
                className={`relative overflow-hidden flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all shadow-md group ${
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

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/80 backdrop-blur-sm">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Customer Name
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Contact Details
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Current Status
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white/60 divide-y divide-gray-100">
                {loading ? (
                  [...Array(3)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                      <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-24"></div></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-gray-200 rounded w-8 ml-auto"></div></td>
                    </tr>
                  ))
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center">
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
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-100 to-gray-200 border border-gray-300 flex items-center justify-center text-gray-600 font-bold text-xs uppercase shadow-sm">
                            {customer.name.charAt(0)}
                          </div>
                          <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                            {customer.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600 font-medium">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {customer.phone_number}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={customer.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button className="text-gray-400 hover:text-blue-600 transition-colors px-2 py-1 rounded">
                          View details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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
