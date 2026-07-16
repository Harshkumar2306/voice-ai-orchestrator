import React, { useState, useRef, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AgentsConfig from './components/AgentsConfig';
import CallLogs from './components/CallLogs';
import AuthForm from './components/AuthForm';
import { getMe, updateSettings, getNotifications, markNotificationRead, markAllNotificationsRead, updatePassword } from './api';
import { LayoutDashboard, Settings, Bell, Search, Mic, User, CreditCard, LogOut, X, ScrollText, Loader2, Check } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Password Update State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
  // Auth state
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Settings state
  const [settings, setSettings] = useState({
    email_alerts: false,
    auto_polling: true,
    dark_mode: false
  });

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter(n => !n.is_read).length;

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

  useEffect(() => {
    checkAuth();
  }, []);

  // Poll for notifications if user is logged in
  useEffect(() => {
    let intervalId;
    if (user) {
      fetchNotifications();
      intervalId = setInterval(() => {
        fetchNotifications();
      }, 10000); // every 10 seconds
    }
    return () => clearInterval(intervalId);
  }, [user]);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const userData = await getMe();
        setUser(userData);
        if (userData.settings) {
          setSettings(userData.settings);
        }
      } catch (error) {
        localStorage.removeItem('token');
        setUser(null);
      }
    }
    setIsAuthLoading(false);
  };

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data.notifications || []);
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 500);
  };

  const handleToggleSetting = async (key) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    // Update in DB
    try {
      await updateSettings(newSettings);
    } catch (e) {
      console.error("Failed to update settings", e);
      // Rollback on fail
      setSettings(settings);
    }
  };

  const handleMarkRead = async (id, e) => {
    e.stopPropagation(); // prevent closing
    try {
      await markNotificationRead(id);
      setNotifications(notifications.map(n => n._id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updatePassword({
        current_password: oldPassword,
        new_password: newPassword
      });
      setPasswordSuccess('Password updated successfully');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsChangingPassword(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (err) {
      setPasswordError(err.response?.data?.detail || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fdfa] via-[#e0f2fe] to-[#eff6ff]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm onAuthSuccess={(userData) => {
      setUser(userData);
      if (userData.settings) setSettings(userData.settings);
    }} />;
  }

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
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
    <div className={`h-screen flex flex-col relative overflow-hidden ${settings.dark_mode ? 'bg-gray-900 text-white' : 'bg-gradient-to-br from-[#f0fdfa] via-[#e0f2fe] to-[#eff6ff]'}`}>
      {/* Decorative background blobs - hide in dark mode for simplicity */}
      {!settings.dark_mode && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-300/30 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-teal-300/30 blur-[100px] pointer-events-none" />
        </>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md p-6 relative ${settings.dark_mode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`}>
            <button 
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-500" />
              Global Settings
            </h2>
            
            <div className="space-y-4">
              <div className={`flex items-center justify-between p-3 rounded-xl ${settings.dark_mode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div>
                  <p className="font-medium text-sm">Email Alerts</p>
                  <p className={`text-xs ${settings.dark_mode ? 'text-gray-400' : 'text-gray-500'}`}>Receive emails for NEEDS_REVIEW leads</p>
                </div>
                <div onClick={() => handleToggleSetting('email_alerts')} className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${settings.email_alerts ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.email_alerts ? 'left-5' : 'left-1'}`}></div>
                </div>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-xl ${settings.dark_mode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div>
                  <p className="font-medium text-sm">Auto-Polling</p>
                  <p className={`text-xs ${settings.dark_mode ? 'text-gray-400' : 'text-gray-500'}`}>Auto-refresh lead statuses during campaigns</p>
                </div>
                <div onClick={() => handleToggleSetting('auto_polling')} className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${settings.auto_polling ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.auto_polling ? 'left-5' : 'left-1'}`}></div>
                </div>
              </div>
              <div className={`flex items-center justify-between p-3 rounded-xl ${settings.dark_mode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div>
                  <p className="font-medium text-sm">Dark Mode</p>
                  <p className={`text-xs ${settings.dark_mode ? 'text-gray-400' : 'text-gray-500'}`}>Toggle application theme</p>
                </div>
                <div onClick={() => handleToggleSetting('dark_mode')} className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors ${settings.dark_mode ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.dark_mode ? 'left-5' : 'left-1'}`}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation */}
      <header className={`glass-header sticky top-0 z-20 ${settings.dark_mode ? 'bg-gray-800/80 border-b border-gray-700' : ''}`}>
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
                className={`w-full pl-10 pr-4 py-2 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${settings.dark_mode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-100/50 border border-gray-200/50 text-gray-900 bg-white focus:bg-white'}`}
              />
              {isSearching && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 min-w-[20px] h-[20px] px-1 text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center border-2 border-white translate-x-1/4 -translate-y-1/4 box-content">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className={`absolute right-0 mt-2 w-80 rounded-2xl shadow-xl border overflow-hidden z-50 animate-fade-in ${settings.dark_mode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                  <div className={`p-4 border-b flex justify-between items-center ${settings.dark_mode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-100'}`}>
                    <h3 className="font-semibold text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs text-blue-500 hover:underline">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-12 text-center">
                        <p className="text-sm text-gray-500">No new notifications</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif._id} 
                          className={`p-4 border-b relative cursor-default ${settings.dark_mode ? 'border-gray-700' : 'border-gray-50'} ${!notif.is_read ? (settings.dark_mode ? 'bg-gray-700/50' : 'bg-blue-50/30') : ''}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className={`text-sm font-medium ${
                                notif.type === 'error' ? 'text-red-600' : 
                                notif.type === 'warning' ? 'text-orange-600' : 
                                notif.type === 'success' ? 'text-green-600' : ''
                              }`}>{notif.title}</p>
                              <p className={`text-xs mt-1 ${settings.dark_mode ? 'text-gray-300' : 'text-gray-500'}`}>{notif.message}</p>
                              <p className="text-[10px] text-blue-500 mt-2">{new Date(notif.created_at).toLocaleString()}</p>
                            </div>
                            {!notif.is_read && (
                              <button 
                                onClick={(e) => handleMarkRead(notif._id, e)}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded-full hover:bg-gray-100"
                                title="Mark as read"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
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
                <span className="text-blue-800 font-semibold text-sm">{getInitials(user.full_name)}</span>
              </div>

              {showProfile && (
                <div className={`absolute right-0 mt-2 w-56 rounded-xl shadow-xl border py-2 z-50 animate-fade-in ${settings.dark_mode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                  <div className={`px-4 py-3 border-b mb-2 ${settings.dark_mode ? 'bg-gray-700/50 border-gray-700' : 'bg-gray-50/50 border-gray-100'}`}>
                    <p className="text-sm font-semibold truncate">{user.full_name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded-md">
                      {user.role}
                    </span>
                  </div>
                  <button onClick={() => { setShowProfileModal(true); setShowProfile(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition-colors">
                    <User className="w-4 h-4" /> My Profile
                  </button>
                  <button onClick={() => { setShowBillingModal(true); setShowProfile(false); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-blue-600 transition-colors">
                    <CreditCard className="w-4 h-4" /> Billing
                  </button>
                  <div className={`border-t mt-2 pt-2 ${settings.dark_mode ? 'border-gray-700' : 'border-gray-100'}`}>
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Layout Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-8 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 space-y-1 flex-shrink-0">
          <nav className="space-y-2">
            <button 
              onClick={() => setActiveTab('campaigns')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium border ${
                activeTab === 'campaigns' 
                  ? (settings.dark_mode ? 'bg-gray-800 text-blue-400 border-gray-700' : 'bg-white text-blue-700 shadow-sm border-blue-100')
                  : (settings.dark_mode ? 'text-gray-400 hover:bg-gray-800 border-transparent hover:text-gray-200' : 'text-gray-600 hover:bg-white/60 border-transparent hover:text-gray-900')
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              Campaigns
            </button>
            <button 
              onClick={() => setActiveTab('agents')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium border ${
                activeTab === 'agents' 
                  ? (settings.dark_mode ? 'bg-gray-800 text-indigo-400 border-gray-700' : 'bg-white text-indigo-700 shadow-sm border-indigo-100')
                  : (settings.dark_mode ? 'text-gray-400 hover:bg-gray-800 border-transparent hover:text-gray-200' : 'text-gray-600 hover:bg-white/60 border-transparent hover:text-gray-900')
              }`}
            >
              <Mic className="w-5 h-5" />
              Agents Configuration
            </button>
            <button 
              onClick={() => setActiveTab('logs')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-medium border ${
                activeTab === 'logs' 
                  ? (settings.dark_mode ? 'bg-gray-800 text-orange-400 border-gray-700' : 'bg-white text-orange-700 shadow-sm border-orange-100')
                  : (settings.dark_mode ? 'text-gray-400 hover:bg-gray-800 border-transparent hover:text-gray-200' : 'text-gray-600 hover:bg-white/60 border-transparent hover:text-gray-900')
              }`}
            >
              <ScrollText className="w-5 h-5" />
              Call Logs
            </button>
          </nav>

          {/* Sidebar Info Card */}
          <div className={`mt-8 p-4 rounded-xl border ${settings.dark_mode ? 'bg-gray-800 border-gray-700' : 'bg-gradient-to-br from-blue-50 to-teal-50 border-blue-100'}`}>
            <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">System Status</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <p className={`text-xs ${settings.dark_mode ? 'text-gray-300' : 'text-gray-600'}`}>All services operational</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <p className={`text-xs ${settings.dark_mode ? 'text-gray-300' : 'text-gray-600'}`}>LangGraph Agent: Active</p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <p className={`text-xs ${settings.dark_mode ? 'text-gray-300' : 'text-gray-600'}`}>Vapi Voice: Connected</p>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {renderContent()}
        </main>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowProfileModal(false)}>
          <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl relative ${settings.dark_mode ? 'bg-gray-800 text-white' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowProfileModal(false)} className={`absolute top-4 right-4 ${settings.dark_mode ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><User className="w-6 h-6 text-blue-500" /> My Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
                <div className={`p-3 rounded-lg border ${settings.dark_mode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>{user?.full_name}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email Address</label>
                <div className={`p-3 rounded-lg border ${settings.dark_mode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>{user?.email}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Role</label>
                <div className={`p-3 rounded-lg border ${settings.dark_mode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>{user?.role}</div>
              </div>

              {!isChangingPassword ? (
                <button
                  onClick={() => setIsChangingPassword(true)}
                  className={`mt-4 w-full py-2 px-4 border rounded-lg text-sm font-medium transition-colors ${settings.dark_mode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  Change Password
                </button>
              ) : (
                <form onSubmit={handleUpdatePassword} className="mt-6 pt-6 border-t border-gray-100 space-y-4">
                  <h3 className="text-sm font-bold">Update Password</h3>
                  
                  {passwordError && <div className="p-2 bg-red-50 text-red-600 text-xs rounded border border-red-100">{passwordError}</div>}
                  {passwordSuccess && <div className="p-2 bg-green-50 text-green-600 text-xs rounded border border-green-100">{passwordSuccess}</div>}

                  <div>
                    <input 
                      type="password" 
                      placeholder="Current Password" 
                      required
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${settings.dark_mode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                    />
                  </div>
                  <div>
                    <input 
                      type="password" 
                      placeholder="New Password" 
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${settings.dark_mode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                    />
                  </div>
                  <div>
                    <input 
                      type="password" 
                      placeholder="Confirm New Password" 
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${settings.dark_mode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setIsChangingPassword(false)}
                      className="flex-1 py-2 px-4 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isUpdatingPassword}
                      className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-70"
                    >
                      {isUpdatingPassword ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Billing Modal */}
      {showBillingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowBillingModal(false)}>
          <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl relative ${settings.dark_mode ? 'bg-gray-800 text-white' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowBillingModal(false)} className={`absolute top-4 right-4 ${settings.dark_mode ? 'text-gray-400 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><CreditCard className="w-6 h-6 text-indigo-500" /> Billing Details</h2>
            <div className={`p-4 rounded-xl border mb-6 ${settings.dark_mode ? 'bg-gray-700 border-gray-600' : 'bg-indigo-50 border-indigo-100'}`}>
              <p className="text-sm font-medium mb-1">Current Plan: <span className="font-bold text-indigo-600">Enterprise Voice AI</span></p>
              <p className={`text-xs ${settings.dark_mode ? 'text-gray-300' : 'text-gray-600'}`}>Active subscription. Renews on 1st of next month.</p>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className={`text-sm ${settings.dark_mode ? 'text-gray-300' : 'text-gray-600'}`}>Vapi Minutes Used</span>
                <span className="font-semibold">342 / 10,000</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className={`text-sm ${settings.dark_mode ? 'text-gray-300' : 'text-gray-600'}`}>LangGraph Triggers</span>
                <span className="font-semibold">342 / Unlimited</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className={`text-sm ${settings.dark_mode ? 'text-gray-300' : 'text-gray-600'}`}>Current Balance</span>
                <span className="font-bold text-green-600">$45.00</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
