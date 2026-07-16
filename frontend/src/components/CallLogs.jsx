import React, { useState, useEffect } from 'react';
import { getCompanies, getCallLogs } from '../api';
import { ScrollText, AlertCircle, Clock, ChevronDown, ChevronUp, User, Building2, MessageSquareText } from 'lucide-react';

const CallLogs = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [callLogs, setCallLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedLog, setExpandedLog] = useState(null);

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCallLogs(selectedCompanyId);
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
      // It's okay if there are no call logs yet
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
      PENDING_EVALUATION: 'bg-blue-50 text-blue-700 border-blue-200',
      FAILED: 'bg-orange-50 text-orange-700 border-orange-200',
    };
    return config[outcome] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  return (
    <div className="space-y-6 h-full flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-orange-500 to-amber-400" />
        <div className="pl-4">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-orange-500" />
            Call Transcript Logs
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Review AI call transcripts, LangGraph evaluation reasoning, and sentiment analysis results.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="appearance-none block w-full sm:w-64 rounded-xl border border-gray-200/80 bg-white/50 py-2.5 pl-10 pr-10 text-gray-900 shadow-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 sm:text-sm transition-all"
            >
              <option value="" disabled>Select Tenant Space</option>
              {companies.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50/90 backdrop-blur-md border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Call Logs List */}
      <div className="glass-panel rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col shadow-sm border border-gray-200/60 mb-2">
        {loading ? (
          <div className="p-8 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm text-gray-500">Loading call logs...</p>
          </div>
        ) : callLogs.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center text-orange-400 mb-4">
              <MessageSquareText className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No Call Logs Yet</h3>
            <p className="text-sm text-gray-500 max-w-md">
              Call logs will appear here after you launch a campaign and the AI completes conversations with your leads.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
            {callLogs.map((log, index) => (
              <div key={log._id || index} className="group">
                <button
                  onClick={() => setExpandedLog(expandedLog === index ? null : index)}
                  className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-100 to-amber-100 flex items-center justify-center text-orange-600">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">{log.customer_name || 'Unknown Lead'}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        Call ID: {log.vapi_call_id?.slice(0, 12) || 'N/A'}...
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getOutcomeBadge(log.outcome)}`}>
                      {log.outcome || 'PENDING'}
                    </span>
                    {log.confidence_score !== undefined && (
                      <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded-lg">
                        {(log.confidence_score * 100).toFixed(0)}% conf
                      </span>
                    )}
                    {expandedLog === index ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {expandedLog === index && (
                  <div className="px-5 pb-5 animate-fade-in">
                    <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                      {/* Sentiment & Confidence */}
                      {(log.sentiment || log.confidence_score !== undefined) && (
                        <div className="flex gap-4">
                          {log.sentiment && (
                            <div className="flex-1 bg-white rounded-lg p-3 border border-gray-100">
                              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Sentiment</p>
                              <p className={`text-sm font-bold ${
                                log.sentiment === 'POSITIVE' ? 'text-emerald-600' :
                                log.sentiment === 'NEGATIVE' ? 'text-rose-600' : 'text-gray-600'
                              }`}>
                                {log.sentiment === 'POSITIVE' ? '😊 Positive' :
                                 log.sentiment === 'NEGATIVE' ? '😞 Negative' : '😐 Neutral'}
                              </p>
                            </div>
                          )}
                          {log.confidence_score !== undefined && (
                            <div className="flex-1 bg-white rounded-lg p-3 border border-gray-100">
                              <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">AI Confidence</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      log.confidence_score >= 0.8 ? 'bg-emerald-500' :
                                      log.confidence_score >= 0.6 ? 'bg-amber-500' : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${log.confidence_score * 100}%` }}
                                  />
                                </div>
                                <span className="text-sm font-bold text-gray-700">{(log.confidence_score * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* AI Reasoning */}
                      {log.reasoning && (
                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">🧠 LangGraph AI Reasoning</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{log.reasoning}</p>
                        </div>
                      )}

                      {/* Summary */}
                      {log.summary && (
                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Call Summary</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{log.summary}</p>
                        </div>
                      )}

                      {/* Transcript */}
                      {log.transcript && (
                        <div className="bg-white rounded-lg p-3 border border-gray-100">
                          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">Full Transcript</p>
                          <div className="mt-2 max-h-48 overflow-y-auto">
                            <p className="text-sm text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">{log.transcript}</p>
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
