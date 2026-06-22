import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import AgentsConfig from './components/AgentsConfig';
import { LayoutDashboard, Settings, Bell, Search, Mic } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('campaigns');

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-300/30 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-teal-300/30 blur-[100px] pointer-events-none" />

      {/* Top Navigation */}
      <header className="glass-header sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-teal-500 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-all">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-teal-600 tracking-tight">
                Vocalize AI
              </h1>
              <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest leading-none">Orchestrator</p>
            </div>
          </div>

          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search leads, campaigns..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-100/50 border border-gray-200/50 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-100 to-teal-100 flex items-center justify-center border-2 border-white shadow-sm ml-2 cursor-pointer hover:shadow-md transition-shadow">
              <span className="text-blue-800 font-semibold text-sm">JS</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Layout Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 space-y-1 flex-shrink-0">
          <nav className="space-y-2">
            <button 
              onClick={() => setActiveTab('campaigns')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium border ${
                activeTab === 'campaigns' 
                  ? 'bg-white text-blue-700 shadow-sm border-blue-100' 
                  : 'text-gray-600 hover:bg-white/60 border-transparent hover:text-gray-900'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              Campaigns
            </button>
            <button 
              onClick={() => setActiveTab('agents')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium border ${
                activeTab === 'agents' 
                  ? 'bg-white text-indigo-700 shadow-sm border-indigo-100' 
                  : 'text-gray-600 hover:bg-white/60 border-transparent hover:text-gray-900'
              }`}
            >
              <Mic className="w-5 h-5" />
              Agents Configuration
            </button>
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {activeTab === 'campaigns' ? <Dashboard /> : <AgentsConfig />}
        </main>
      </div>
    </div>
  );
}

export default App;
