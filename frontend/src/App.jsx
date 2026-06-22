import React, { useState, useRef, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AgentsConfig from './components/AgentsConfig';
import CallLogs from './components/CallLogs';
import { LayoutDashboard, Settings, Bell, Search, Mic, User, CreditCard, LogOut, X, ScrollText } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Close dropdowns when clicking outside
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 500);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'campaigns': return <Dashboard />;
      case 'agents': return <AgentsConfig />;
      case 'logs': return <CallLogs />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-gradient-to-br from-[#f0fdfa] via-[#e0f2fe] to-[#eff6ff]">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-300/30 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-teal-300/30 blur-[100px] pointer-events-none" />

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button 
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-500" />
              Global Settings
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Email Alerts</p>
                  <p className="text-xs text-gray-500">Receive emails for NEEDS_REVIEW leads</p>
                </div>
                <div className="w-10 h-6 bg-indigo-500 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full transition-all"></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Auto-Polling</p>
                  <p className="text-xs text-gray-500">Auto-refresh lead statuses during campaigns</p>
                </div>
                <div className="w-10 h-6 bg-indigo-500 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full transition-all"></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Dark Mode</p>
                  <p className="text-xs text-gray-500">Toggle application theme</p>
                </div>
                <div className="w-10 h-6 bg-gray-300 rounded-full relative cursor-pointer">
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-all"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <header className="glass-header sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab('campaigns')}>
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
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search leads, campaigns..." 
                className="w-full pl-10 pr-4 py-2 bg-gray-100/50 border border-gray-200/50 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
              {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              {searchQuery && !isSearching && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 p-4 z-50 animate-fade-in">
                  <p className="text-sm text-gray-500">Search results for "{searchQuery}" will appear here.</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications Dropdown */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 rounded-full transition-colors ${showNotifications ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'}`}
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fade-in">
                  <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-semibold text-gray-900">Notifications</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                      <p className="text-sm font-medium text-gray-900">Campaign Finished</p>
                      <p className="text-xs text-gray-500 mt-1">Dream Homes Realty completed 5 outbound calls.</p>
                      <p className="text-xs text-blue-500 mt-2">10 mins ago</p>
                    </div>
                    <div className="p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer">
                      <p className="text-sm font-medium text-gray-900">Lead Needs Review</p>
                      <p className="text-xs text-gray-500 mt-1">Jane Smith had an ambiguous response. AI confidence: 45%</p>
                      <p className="text-xs text-blue-500 mt-2">1 hour ago</p>
                    </div>
                    <div className="p-4 hover:bg-gray-50 cursor-pointer">
                      <p className="text-sm font-medium text-gray-900">New Lead Qualified</p>
                      <p className="text-xs text-gray-500 mt-1">Bob Williams was marked as QUALIFIED with 92% confidence.</p>
                      <p className="text-xs text-blue-500 mt-2">2 hours ago</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Settings Button */}
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <div 
                onClick={() => setShowProfile(!showProfile)}
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-100 to-teal-100 flex items-center justify-center border-2 border-white shadow-sm ml-2 cursor-pointer hover:shadow-md transition-shadow"
              >
                <span className="text-blue-800 font-semibold text-sm">JS</span>
              </div>

              {showProfile && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-fade-in">
                  <div className="px-4 py-2 border-b border-gray-100 mb-2">
                    <p className="text-sm font-semibold text-gray-900">John Smith</p>
                    <p className="text-xs text-gray-500">Admin</p>
                  </div>
                  <a href="#" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors">
                    <User className="w-4 h-4" /> My Profile
                  </a>
                  <a href="#" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors">
                    <CreditCard className="w-4 h-4" /> Billing
                  </a>
                  <div className="border-t border-gray-100 mt-2 pt-2">
                    <a href="#" className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </a>
                  </div>
                </div>
              )}
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
            <button 
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium border ${
                activeTab === 'logs' 
                  ? 'bg-white text-orange-700 shadow-sm border-orange-100' 
                  : 'text-gray-600 hover:bg-white/60 border-transparent hover:text-gray-900'
              }`}
            >
              <ScrollText className="w-5 h-5" />
              Call Logs
            </button>
          </nav>

          {/* Sidebar Info Card */}
          <div className="mt-8 p-4 bg-gradient-to-br from-blue-50 to-teal-50 rounded-xl border border-blue-100">
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">System Status</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <p className="text-xs text-gray-600">All services operational</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <p className="text-xs text-gray-600">LangGraph Agent: Active</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <p className="text-xs text-gray-600">Vapi Voice: Connected</p>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;
