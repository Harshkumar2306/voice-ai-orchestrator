import React, { useState, useEffect } from 'react';
import { getCompanies, getCallLogs } from '../api';
import { 
  ScrollText, AlertCircle, Clock, ChevronDown, ChevronUp, User, 
  Building2, MessageSquareText, Search, Filter, Sparkles, Copy, 
  Check, RefreshCw, Phone, BarChart2
} from 'lucide-react';

const CallLogs = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [callLogs, setCallLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedLog, setExpandedLog] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCallLogs(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  // Real-time updates via WebSockets for Call Logs
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
               fetchCallLogs(selectedCompanyId);
            }
          }
        } catch (e) {
          console.error("WebSocket parsing error in CallLogs", e);
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
      setError('Failed to load tenants.');
    }
  };

  const fetchCallLogs = async (companyId) => {
    setLoading(true);
    setError('');
    try {
      const data = await getCallLogs(companyId);
      setCallLogs(data.call_logs || []);
    } catch (err) {
      setCallLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedCompany = companies.find((c) => c._id === selectedCompanyId);

  const getOutcomeBadge = (outcome) => {
    const config = {
      QUALIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      NOT_INTERESTED: 'bg-rose-50 text-rose-700 border-rose-200',
      NEEDS_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
      PENDING_EVALUATION: 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse',
      FAILED: 'bg-orange-50 text-orange-700 border-orange-200',
    };
    return config[outcome] || 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const handleCopyTranscript = (text, logId) => {
    navigator.clipboard.writeText(text);
    setCopiedId(logId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredLogs = callLogs.filter(log => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch = !q || 
      (log.customer_name && log.customer_name.toLowerCase().includes(q)) ||
      (log.phone_number && log.phone_number.includes(q)) ||
      (log.transcript && log.transcript.toLowerCase().includes(q)) ||
      (log.summary && log.summary.toLowerCase().includes(q)) ||
      (log.vapi_call_id && log.vapi_call_id.toLowerCase().includes(q));

    const matchesOutcome = outcomeFilter === 'ALL' || log.outcome === outcomeFilter;
    return matchesSearch && matchesOutcome;
  });

  return (
    <div className="space-y-3 sm:space-y-3.5 flex-1 min-h-0 flex flex-col overflow-hidden h-full animate-fade-in">
      
      {/* Header */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 relative overflow-hidden shrink-0 border border-white/70">
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-orange-500 to-amber-400" />
        
        <div className="pl-2.5 sm:pl-3">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 tracking-tight flex items-center gap-2">
            <ScrollText className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
            Call Transcript Logs
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 max-w-xl leading-relaxed">
            Review voice call transcripts, AI confidence ratings, and LangGraph multi-node reasoning trails.
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 group">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors pointer-events-none" />
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="appearance-none block w-full rounded-xl border border-gray-200/90 bg-white/70 py-2 sm:py-2.5 pl-9 pr-8 text-xs sm:text-sm font-semibold text-gray-900 shadow-2xs focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all hover:bg-white cursor-pointer"
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
            onClick={() => fetchCallLogs(selectedCompanyId)}
            className="p-2 sm:p-2.5 text-gray-500 bg-white border border-gray-200/80 hover:border-orange-300 hover:text-orange-600 shadow-2xs rounded-xl transition-all active:scale-95 shrink-0 flex items-center justify-center"
            title="Refresh Call Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-500' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50/95 border border-rose-200 text-rose-700 p-3 sm:p-4 rounded-xl flex items-start gap-3 shadow-2xs animate-fade-in shrink-0">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* Call Logs Main Container */}
      <div className="glass-panel rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col shadow-sm border border-gray-200/70">
        
        {/* Search & Filter Bar */}
        <div className="border-b border-gray-100 p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/50 shrink-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search caller, phone, transcript..."
              className="w-full pl-9 pr-3 h-9 sm:h-10 rounded-xl border border-gray-200/90 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}
                className="w-full sm:w-auto h-9 sm:h-10 px-3 rounded-xl border border-gray-200/90 bg-white text-xs font-semibold text-gray-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all cursor-pointer"
              >
                <option value="ALL">All Outcomes</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="NEEDS_REVIEW">Needs Review</option>
                <option value="NOT_INTERESTED">Not Interested</option>
                <option value="PENDING_EVALUATION">Pending Evaluation</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Logs List Container */}
        {loading ? (
          <div className="p-8 sm:p-14 flex flex-col items-center justify-center flex-1">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-3" />
            <p className="text-xs sm:text-sm font-semibold text-gray-500">Loading call records...</p>
          </div>
        ) : callLogs.length === 0 ? (
          <div className="p-8 sm:p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 mx-auto mb-3 shadow-2xs">
              <MessageSquareText className="w-7 h-7" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1">No Call Logs Yet</h3>
            <p className="text-xs sm:text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
              When you launch an outbound campaign or initiate web calls, real-time transcripts and AI evaluations will stream here.
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-gray-700">No matching call logs</h4>
            <p className="text-xs text-gray-400 mt-1">Try clearing your search query or filter selection.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
            {filteredLogs.map((log, index) => (
              <div key={log._id || index} className="group transition-colors">
                <button
                  onClick={() => setExpandedLog(expandedLog === index ? null : index)}
                  className="w-full p-3.5 sm:p-4.5 flex items-center justify-between hover:bg-orange-50/25 transition-all text-left"
                >
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-orange-100 via-amber-100 to-rose-100 flex items-center justify-center text-orange-700 font-semibold text-xs uppercase shadow-2xs shrink-0">
                      {log.customer_name ? log.customer_name.charAt(0) : <User className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                        {log.customer_name || 'Prospect Call'}
                      </p>
                      <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5 font-mono truncate">
                        <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                        {log.phone_number || log.customer_id?.slice(0, 10) || 'Direct Lead'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
                    <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border ${getOutcomeBadge(log.outcome)}`}>
                      {log.outcome || 'PENDING'}
                    </span>

                    {log.confidence_score !== undefined && (
                      <span className={`text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-lg border hidden sm:inline-flex ${
                        log.confidence_score >= 0.8 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        log.confidence_score >= 0.6 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {(log.confidence_score * 100).toFixed(0)}% conf
                      </span>
                    )}

                    <div className="p-1 rounded-lg text-gray-400 group-hover:text-gray-600 transition-colors">
                      {expandedLog === index ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded Details Drawer */}
                {expandedLog === index && (
                  <div className="px-3.5 sm:px-5 pb-4 animate-fade-in">
                    <div className="bg-gray-50/80 rounded-2xl p-4 sm:p-5 space-y-3.5 border border-gray-100">
                      
                      {/* Sentiment & Confidence Row */}
                      {(log.sentiment || log.confidence_score !== undefined) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {log.sentiment && (
                            <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-2xs">
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">
                                Call Sentiment
                              </p>
                              <p className={`text-sm font-semibold flex items-center gap-1.5 ${
                                log.sentiment === 'POSITIVE' ? 'text-emerald-700' :
                                log.sentiment === 'NEGATIVE' ? 'text-rose-700' : 'text-gray-700'
                              }`}>
                                {log.sentiment === 'POSITIVE' ? '😊 Positive' :
                                 log.sentiment === 'NEGATIVE' ? '😞 Negative' : '😐 Neutral'}
                              </p>
                            </div>
                          )}

                          {log.confidence_score !== undefined && (
                            <div className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-2xs">
                              <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                                  AI Confidence
                                </p>
                                <span className="text-xs font-semibold text-gray-800">
                                  {(log.confidence_score * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    log.confidence_score >= 0.8 ? 'bg-emerald-500' :
                                    log.confidence_score >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(Math.max(log.confidence_score * 100, 5), 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* LangGraph AI Reasoning */}
                      {log.reasoning && (
                        <div className="bg-gradient-to-br from-indigo-50/70 to-blue-50/70 rounded-xl p-3.5 sm:p-4 border border-indigo-100/90 shadow-2xs">
                          <p className="text-[11px] text-indigo-700 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            LangGraph AI Reasoning
                          </p>
                          <p className="text-xs sm:text-sm text-gray-800 leading-relaxed font-medium">
                            {log.reasoning}
                          </p>
                        </div>
                      )}

                      {/* Call Summary */}
                      {log.summary && (
                        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-100 shadow-2xs">
                          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">
                            Call Summary
                          </p>
                          <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
                            {log.summary}
                          </p>
                        </div>
                      )}

                      {/* Full Transcript with Copy Button */}
                      {log.transcript && (
                        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-100 shadow-2xs">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                              Full Call Transcript
                            </p>
                            <button
                              onClick={() => handleCopyTranscript(log.transcript, log._id || index)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold text-gray-500 hover:text-blue-600 hover:bg-gray-50 transition-colors"
                            >
                              {copiedId === (log._id || index) ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" /> Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" /> Copy
                                </>
                              )}
                            </button>
                          </div>
                          <div className="mt-1 max-h-56 overflow-y-auto custom-scrollbar p-3 bg-gray-50/80 rounded-lg border border-gray-200/60">
                            <p className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                              {log.transcript}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallLogs;
