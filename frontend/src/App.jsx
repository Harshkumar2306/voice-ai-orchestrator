import React, { useState, useRef, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AgentsConfig from './components/AgentsConfig';
import CallLogs from './components/CallLogs';
import AuthForm from './components/AuthForm';
import { getMe, updateSettings, getNotifications, markNotificationRead, markAllNotificationsRead, updatePassword, healthCheck } from './api';
import { 
  LayoutDashboard, Settings, Bell, Search, Mic, User, CreditCard, 
  LogOut, X, ScrollText, Loader2, Check, Menu, Moon, Sun, 
  ChevronRight, Shield, Activity, PhoneCall
} from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isColdStarting, setIsColdStarting] = useState(false);
  
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

  // Keep-alive heartbeat: ping /api/health every 10 minutes to prevent Render free-tier sleep
  useEffect(() => {
    const heartbeat = setInterval(() => {
      healthCheck();
    }, 10 * 60 * 1000);
    return () => clearInterval(heartbeat);
  }, []);

  // Timer to detect cold start when auth takes >2.5s
  useEffect(() => {
    let timer;
    if (isAuthLoading) {
      timer = setTimeout(() => {
        setIsColdStarting(true);
      }, 2500);
    } else {
      setIsColdStarting(false);
    }
    return () => clearTimeout(timer);
  }, [isAuthLoading]);

  // Poll for notifications if user is logged in
  useEffect(() => {
    let intervalId;
    if (user) {
      fetchNotifications();
      intervalId = setInterval(() => {
        fetchNotifications();
      }, 10000);
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
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          setUser(null);
        } else {
          console.warn("Backend server may be waking up from sleep. Keeping session active.");
        }
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
    setTimeout(() => setIsSearching(false), 400);
  };

  const handleToggleSetting = async (key) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    try {
      await updateSettings(newSettings);
    } catch (e) {
      console.error("Failed to update settings", e);
      setSettings(settings);
    }
  };

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#f0fdfa] via-[#e0f2fe] to-[#eff6ff] p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center shadow-xl shadow-blue-500/25 mb-5 transform hover:scale-105 transition-transform">
          <Mic className="w-8 h-8 text-white" />
        </div>
        <div className="flex items-center gap-2.5 mb-2">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 tracking-tight">Connecting to Vocalize AI</h2>
        </div>
        {isColdStarting ? (
          <div className="mt-4 max-w-sm px-5 py-4 bg-white/90 backdrop-blur-md border border-blue-200/70 rounded-2xl text-blue-900 text-xs shadow-lg shadow-blue-500/5 animate-fade-in space-y-1.5">
            <p className="font-semibold flex items-center justify-center gap-1.5 text-blue-700">
              <span>⚡</span> Cloud Server Waking Up
            </p>
            <p className="text-gray-600 leading-relaxed">
              Free-tier cloud servers spin down after 15 minutes of inactivity. The backend is spinning up now (~30s). Please keep this tab open!
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Initializing your secure workspace...</p>
        )}
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
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const navItems = [
    { id: 'campaigns', label: 'Campaigns', icon: LayoutDashboard, color: 'text-blue-600', activeClass: 'text-blue-700 bg-white border-blue-100 shadow-sm' },
    { id: 'agents', label: 'Agents Configuration', icon: Mic, color: 'text-indigo-600', activeClass: 'text-indigo-700 bg-white border-indigo-100 shadow-sm' },
    { id: 'logs', label: 'Call Logs', icon: ScrollText, color: 'text-orange-600', activeClass: 'text-orange-700 bg-white border-orange-100 shadow-sm' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'campaigns': return <Dashboard globalSearch={searchQuery} />;
      case 'agents': return <AgentsConfig />;
      case 'logs': return <CallLogs />;
      default: return <Dashboard globalSearch={searchQuery} />;
    }
  };

  return (
    <div className={`h-[100dvh] flex flex-col relative overflow-hidden select-none ${settings.dark_mode ? 'bg-gray-950 text-white' : 'bg-gradient-to-br from-[#f0fdfa] via-[#e0f2fe] to-[#eff6ff] text-slate-800'}`}>
      {/* Decorative ambient background glows */}
      {!settings.dark_mode && (
        <>
          <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-blue-300/25 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-teal-300/25 blur-[120px] pointer-events-none" />
        </>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={() => setShowSettings(false)}>
          <div className={`rounded-2xl shadow-2xl w-full max-w-md p-6 relative border ${settings.dark_mode ? 'bg-gray-900 text-white border-gray-800' : 'bg-white text-gray-900 border-gray-100'}`} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowSettings(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              Global Settings
            </h2>
            
            <div className="space-y-3.5">
              <div className={`flex items-center justify-between p-3.5 rounded-xl border ${settings.dark_mode ? 'bg-gray-800/60 border-gray-700/60' : 'bg-gray-50 border-gray-100'}`}>
                <div>
                  <p className="font-semibold text-sm">Email Alerts</p>
                  <p className={`text-xs mt-0.5 ${settings.dark_mode ? 'text-gray-400' : 'text-gray-500'}`}>Receive alerts for leads needing human review</p>
                </div>
                <button 
                  onClick={() => handleToggleSetting('email_alerts')} 
                  className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors focus:outline-none ${settings.email_alerts ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${settings.email_alerts ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>

              <div className={`flex items-center justify-between p-3.5 rounded-xl border ${settings.dark_mode ? 'bg-gray-800/60 border-gray-700/60' : 'bg-gray-50 border-gray-100'}`}>
                <div>
                  <p className="font-semibold text-sm">Auto-Polling</p>
                  <p className={`text-xs mt-0.5 ${settings.dark_mode ? 'text-gray-400' : 'text-gray-500'}`}>Real-time WebSocket & status synchronization</p>
                </div>
                <button 
                  onClick={() => handleToggleSetting('auto_polling')} 
                  className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors focus:outline-none ${settings.auto_polling ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${settings.auto_polling ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>

              <div className={`flex items-center justify-between p-3.5 rounded-xl border ${settings.dark_mode ? 'bg-gray-800/60 border-gray-700/60' : 'bg-gray-50 border-gray-100'}`}>
                <div>
                  <p className="font-semibold text-sm">Dark Theme</p>
                  <p className={`text-xs mt-0.5 ${settings.dark_mode ? 'text-gray-400' : 'text-gray-500'}`}>Toggle interface contrast</p>
                </div>
                <button 
                  onClick={() => handleToggleSetting('dark_mode')} 
                  className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors focus:outline-none ${settings.dark_mode ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${settings.dark_mode ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className={`glass-header sticky top-0 z-30 shrink-0 ${settings.dark_mode ? 'bg-gray-900/90 border-b border-gray-800' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="p-2 -ml-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100/80 lg:hidden transition-colors"
              aria-label="Toggle navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div 
              className="flex items-center gap-2.5 cursor-pointer group" 
              onClick={() => setActiveTab('campaigns')}
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 via-blue-500 to-teal-400 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-all">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 via-blue-600 to-teal-600 tracking-tight leading-none">
                  Vocalize AI
                </h1>
                <p className="text-[9px] sm:text-[10px] uppercase font-semibold text-gray-400 tracking-widest leading-none mt-1">Orchestrator</p>
              </div>
            </div>
          </div>

          {/* Center Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search leads, phone, transcripts..." 
                className={`w-full pl-10 pr-10 py-2 rounded-full text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${
                  settings.dark_mode 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'bg-white/90 border border-gray-200/80 text-gray-900 shadow-sm'
                }`}
              />
              {isSearching && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2 rounded-xl transition-all ${
                  showNotifications 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50/80'
                }`}
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-semibold bg-rose-500 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className={`absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-80 rounded-2xl shadow-2xl border overflow-hidden z-50 animate-fade-in ${
                  settings.dark_mode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
                }`}>
                  <div className={`p-4 border-b flex justify-between items-center ${
                    settings.dark_mode ? 'bg-gray-800/70 border-gray-700' : 'bg-gray-50/80 border-gray-100'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-blue-600" />
                      <h3 className="font-semibold text-sm">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs text-blue-600 font-semibold hover:underline">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-gray-100">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center">
                        <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-xs text-gray-500">No new notifications</p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div 
                          key={notif._id} 
                          className={`p-3.5 transition-colors ${
                            !notif.is_read 
                              ? (settings.dark_mode ? 'bg-blue-950/30' : 'bg-blue-50/40') 
                              : ''
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <p className={`text-xs font-semibold ${
                                notif.type === 'error' ? 'text-rose-600' : 
                                notif.type === 'warning' ? 'text-amber-600' : 
                                notif.type === 'success' ? 'text-emerald-600' : 'text-blue-600'
                              }`}>{notif.title}</p>
                              <p className={`text-xs mt-0.5 line-clamp-2 ${settings.dark_mode ? 'text-gray-300' : 'text-gray-600'}`}>
                                {notif.message}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                {new Date(notif.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </p>
                            </div>
                            {!notif.is_read && (
                              <button 
                                onClick={(e) => handleMarkRead(notif._id, e)}
                                className="p-1 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100 transition-colors"
                                title="Mark read"
                              >
                                <Check className="w-3.5 h-3.5" />
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
              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50/80 rounded-xl transition-colors"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button 
                onClick={() => setShowProfile(!showProfile)}
                className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-100 via-teal-100 to-emerald-100 flex items-center justify-center border border-white shadow-sm ml-1 hover:shadow transition-all focus:outline-none"
                aria-label="User Profile"
              >
                <span className="text-blue-800 font-semibold text-xs">{getInitials(user.full_name)}</span>
              </button>

              {showProfile && (
                <div className={`absolute right-0 mt-2 w-56 rounded-2xl shadow-2xl border py-2 z-50 animate-fade-in ${
                  settings.dark_mode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
                }`}>
                  <div className={`px-4 py-3 border-b mb-1 ${settings.dark_mode ? 'bg-gray-800/40 border-gray-800' : 'bg-gray-50/60 border-gray-100'}`}>
                    <p className="text-xs font-semibold truncate text-gray-900">{user.full_name}</p>
                    <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-semibold uppercase rounded-md border border-blue-100">
                      {user.role || 'Admin'}
                    </span>
                  </div>
                  <button 
                    onClick={() => { setShowProfileModal(true); setShowProfile(false); }} 
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    <User className="w-4 h-4 text-blue-600" /> My Profile
                  </button>
                  <button 
                    onClick={() => { setShowBillingModal(true); setShowProfile(false); }} 
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    <CreditCard className="w-4 h-4 text-indigo-600" /> Billing
                  </button>
                  <div className={`border-t my-1 pt-1 ${settings.dark_mode ? 'border-gray-800' : 'border-gray-100'}`}>
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
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

      {/* Mobile Slide-Out Drawer Navigation */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 flex lg:hidden animate-fade-in">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)} />
          <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-2xl p-5 flex flex-col z-10">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <Mic className="w-4 h-4" />
                </div>
                <span className="font-semibold text-gray-900 text-sm">Vocalize AI</span>
              </div>
              <button onClick={() => setShowMobileMenu(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav Links */}
            <nav className="mt-5 space-y-1.5 flex-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                      isActive 
                        ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm' 
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            {/* Sign out */}
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-rose-600 bg-rose-50/70 border border-rose-100 rounded-xl"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      )}
      
      {/* Main Workspace Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 pt-3 pb-3 sm:pt-4 sm:pb-4 flex gap-5 overflow-hidden min-h-0 h-full">
        
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-60 flex-col shrink-0">
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button 
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all text-sm font-semibold border ${
                    isActive 
                      ? (settings.dark_mode ? 'bg-gray-800 text-blue-400 border-gray-700' : item.activeClass)
                      : (settings.dark_mode ? 'text-gray-400 hover:bg-gray-800 border-transparent' : 'text-gray-600 hover:bg-white/60 border-transparent hover:text-gray-900')
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? item.color : 'text-gray-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden h-full min-h-0">
          {renderContent()}
        </main>
      </div>

      {/* Mobile Bottom Navigation Dock (Visible only on mobile/tablet < 1024px) */}
      <nav className="lg:hidden shrink-0 bg-white/95 backdrop-blur-lg border-t border-gray-200/80 px-2 py-1.5 flex items-center justify-around z-20 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive 
                  ? 'text-blue-600 font-semibold' 
                  : 'text-gray-400 font-medium hover:text-gray-600'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[10px] mt-0.5">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowProfileModal(false)}>
          <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl relative border ${settings.dark_mode ? 'bg-gray-900 text-white border-gray-800' : 'bg-white border-gray-100'}`} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-semibold mb-5 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" /> My Profile
            </h2>
            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Full Name</label>
                <div className="p-3 rounded-xl border border-gray-200/80 bg-gray-50 text-sm font-medium text-gray-800">{user?.full_name}</div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Email Address</label>
                <div className="p-3 rounded-xl border border-gray-200/80 bg-gray-50 text-sm font-medium text-gray-800">{user?.email}</div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Account Role</label>
                <div className="p-3 rounded-xl border border-gray-200/80 bg-gray-50 text-sm font-medium text-gray-800 uppercase">{user?.role || 'Admin'}</div>
              </div>

              {!isChangingPassword ? (
                <button
                  onClick={() => setIsChangingPassword(true)}
                  className="mt-3 w-full py-2.5 px-4 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold transition-colors shadow-sm"
                >
                  Change Password
                </button>
              ) : (
                <form onSubmit={handleUpdatePassword} className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wider">Update Password</h3>
                  
                  {passwordError && <div className="p-2.5 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-100 font-medium">{passwordError}</div>}
                  {passwordSuccess && <div className="p-2.5 bg-emerald-50 text-emerald-700 text-xs rounded-xl border border-emerald-100 font-medium">{passwordSuccess}</div>}

                  <input 
                    type="password" 
                    placeholder="Current Password" 
                    required
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50"
                  />
                  <input 
                    type="password" 
                    placeholder="New Password (min 6 characters)" 
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50"
                  />
                  <input 
                    type="password" 
                    placeholder="Confirm New Password" 
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50"
                  />
                  <div className="flex gap-2 pt-1">
                    <button 
                      type="button" 
                      onClick={() => setIsChangingPassword(false)}
                      className="flex-1 py-2 px-3 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isUpdatingPassword}
                      className="flex-1 py-2 px-3 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-70 shadow-sm"
                    >
                      {isUpdatingPassword ? 'Saving...' : 'Save Password'}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowBillingModal(false)}>
          <div className="w-full max-w-md p-6 rounded-2xl shadow-2xl relative border border-gray-100 bg-white" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowBillingModal(false)} className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-base sm:text-lg font-semibold mb-5 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" /> Plan & Usage
            </h2>
            <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 mb-5">
              <p className="text-xs font-semibold text-indigo-800">Enterprise Voice AI Tier</p>
              <p className="text-xs text-gray-500 mt-0.5">Multi-tenant automated orchestration enabled</p>
            </div>
            <div className="space-y-3 divide-y divide-gray-100 text-xs">
              <div className="flex justify-between items-center pt-2">
                <span className="text-gray-600">Vapi Minutes Allocated</span>
                <span className="font-semibold text-gray-900">10,000 / mo</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-gray-600">LangGraph AI Triggers</span>
                <span className="font-semibold text-emerald-600">Unlimited</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-gray-600">Active Tenants</span>
                <span className="font-semibold text-gray-900">Multi-tenant</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
