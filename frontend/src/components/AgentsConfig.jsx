import React, { useState, useEffect } from 'react';
import { getCompanies, updateCompanyInstructions } from '../api';
import { 
  Bot, Save, AlertCircle, Loader2, CheckCircle, Sparkles, 
  RotateCcw, Building2, Code2, Layers
} from 'lucide-react';
import PipelineVisualizer from './PipelineVisualizer';

const PROMPT_TEMPLATES = {
  REAL_ESTATE: `You are an AI sales assistant for Dream Homes Realty calling interested prospects.
Your goals:
1. Greet the client courteously and confirm their interest in buying, selling, or investing in real estate.
2. If interested, inquire about their timeframe (e.g., within 3 months), property type (residential, land, commercial), and target location.
3. Keep answers concise, natural, and friendly.
4. If they decline or request no calls, respect their choice immediately and end the call politely.`,
  
  MORTGAGE: `You are an AI loan advisor for Premier Mortgage Partners.
Your goals:
1. Verify if the customer is seeking pre-approval or refinancing for a home loan.
2. Inquire about their approximate credit tier and down payment readiness.
3. Collect their preferred timeline for home purchase.
4. Thank them and confirm a loan specialist will follow up with loan estimates.`,
  
  B2B_SAAS: `You are an AI sales executive for TechFlow Enterprise.
Your goals:
1. Confirm if the lead is actively exploring workflow automation software for their team.
2. Identify current challenges and approximate team seat count.
3. Book a discovery demo session for qualified teams.
4. Maintain a professional, consultative, and articulate demeanor throughout.`
};

const AgentsConfig = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    const company = companies.find(c => c._id === selectedCompanyId);
    if (company) {
      setInstructions(company.instructions || '');
    }
  }, [selectedCompanyId, companies]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const data = await getCompanies();
      setCompanies(data.companies || []);
      if (data.companies && data.companies.length > 0) {
        setSelectedCompanyId(data.companies[0]._id);
      }
    } catch (err) {
      setError('Failed to load tenants.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCompanyId) return;
    setSaving(true);
    setError('');
    try {
      await updateCompanyInstructions(selectedCompanyId, instructions);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save agent instructions.');
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = (templateKey) => {
    if (PROMPT_TEMPLATES[templateKey]) {
      setInstructions(PROMPT_TEMPLATES[templateKey]);
    }
  };

  const selectedCompany = companies.find((c) => c._id === selectedCompanyId);
  const charCount = instructions.length;
  const lineCount = instructions.split('\n').length;

  return (
    <div className="space-y-3 sm:space-y-3.5 flex-1 min-h-0 flex flex-col overflow-hidden h-full animate-fade-in">
      
      {/* Header */}
      <div className="glass-panel rounded-2xl p-3.5 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 relative overflow-hidden shrink-0 border border-white/70">
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-indigo-500 to-purple-500" />
        
        <div className="pl-2.5 sm:pl-3">
          <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            Voice Agents Configuration
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 max-w-xl leading-relaxed">
            Configure dynamic system prompts, tone instructions, and behavioral rules per tenant space.
          </p>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64 group">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors pointer-events-none" />
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="appearance-none block w-full rounded-xl border border-gray-200/90 bg-white/70 py-2 sm:py-2.5 pl-9 pr-8 text-xs sm:text-sm font-semibold text-gray-900 shadow-2xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all hover:bg-white cursor-pointer"
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
        </div>
      </div>

      {error && (
        <div className="bg-rose-50/95 border border-rose-200 text-rose-700 p-3 sm:p-4 rounded-xl flex items-start gap-3 shadow-2xs animate-fade-in shrink-0">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm font-semibold">{error}</p>
        </div>
      )}

      {selectedCompanyId && (
        <div className="glass-panel rounded-2xl p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto custom-scrollbar border border-gray-200/70 shadow-sm space-y-6">
          
          {/* Prompt Editor Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <Code2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                {selectedCompany?.name || 'Agent'} — System Prompt
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Injected dynamically into Vapi call assistants and LangGraph evaluation state.
              </p>
            </div>

            {/* Quick Templates Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-1">
                Templates:
              </span>
              <button
                onClick={() => applyTemplate('REAL_ESTATE')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors shrink-0"
              >
                Real Estate
              </button>
              <button
                onClick={() => applyTemplate('MORTGAGE')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors shrink-0"
              >
                Mortgage
              </button>
              <button
                onClick={() => applyTemplate('B2B_SAAS')}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors shrink-0"
              >
                B2B SaaS
              </button>
            </div>
          </div>

          {/* Text Area */}
          <div className="relative">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={8}
              className="w-full rounded-2xl border border-gray-200/90 p-4 text-xs sm:text-sm text-gray-800 font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner bg-gray-50/60 resize-none leading-relaxed outline-none"
              placeholder="Enter system instructions for this tenant's AI voice agent..."
            />
            <div className="absolute bottom-3 right-3 text-[11px] font-semibold text-gray-400 bg-white/90 px-2 py-0.5 rounded-md border border-gray-200/60 shadow-2xs">
              {charCount} chars • {lineCount} lines
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <p className="text-xs text-gray-400 leading-relaxed">
              Updates take effect immediately on all subsequent outbound campaign dials and web calls.
            </p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>

          {/* LangGraph Pipeline Section */}
          <div className="pt-6 border-t border-gray-200/80">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                LangGraph Decision Engine
              </h3>
            </div>
            <p className="text-xs text-gray-500 mb-4 max-w-xl">
              Multi-node autonomous workflow with sentiment pre-analysis, structured evaluation, and confidence routing.
            </p>
            <PipelineVisualizer />
          </div>
        </div>
      )}

      {/* Success Toast */}
      {saveSuccess && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <div className="flex items-center gap-2.5 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-xl shadow-emerald-600/20 text-xs sm:text-sm font-bold">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>Agent instructions saved successfully!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsConfig;
