import React, { useState, useEffect } from 'react';
import { getCompanies } from '../api';
import { Bot, Save, AlertCircle } from 'lucide-react';

const AgentsConfig = () => {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    const company = companies.find(c => c._id === selectedCompanyId);
    if (company) {
      setInstructions(company.instructions);
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

  const handleSave = () => {
    // For now, just simulate a save. 
    // In a full implementation, this would call an API endpoint to update the DB.
    alert('Agent instructions saved successfully for this tenant space!');
  };

  const selectedCompany = companies.find((c) => c._id === selectedCompanyId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-purple-500 to-indigo-400" />
        
        <div className="pl-4">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-indigo-500" />
            Voice Agents Configuration
          </h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Configure the dynamic prompts and behavior rules for your AI voice agents per tenant.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="appearance-none block w-full sm:w-64 rounded-xl border border-gray-200/80 bg-white/50 py-2.5 pl-4 pr-10 text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm transition-all"
          >
            <option value="" disabled>Select Tenant Space</option>
            {companies.map((c) => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50/90 backdrop-blur-md border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {selectedCompanyId && (
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{selectedCompany?.name} - Agent System Prompt</h3>
          <p className="text-sm text-gray-600 mb-4">
            This prompt is injected dynamically into the LangGraph flow and Vapi configuration right before dialing out to a lead.
          </p>

          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-gray-200 p-4 text-gray-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner bg-gray-50/50 resize-none font-mono text-sm"
            placeholder="Enter the AI behavior instructions..."
          />

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-md hover:shadow-lg active:scale-95"
            >
              <Save className="w-4 h-4" />
              Save Configuration
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentsConfig;
