import React, { useState } from 'react';
import { Mic, Mail, Lock, User, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { login, register, resetPassword } from '../api';

const AuthForm = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [formData, setFormData] = useState({ full_name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isResettingPassword) {
        const data = await resetPassword(formData.email);
        setTempPassword(data.temporary_password);
      } else {
        let data;
        if (isLogin) {
          data = await login(formData.email, formData.password);
        } else {
          data = await register(formData.full_name, formData.email, formData.password);
        }
        
        if (data.access_token) {
          localStorage.setItem('token', data.access_token);
          onAuthSuccess(data.user);
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f0fdfa] via-[#e0f2fe] to-[#eff6ff] p-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-300/30 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-300/30 blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white p-8 relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-teal-500 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4 transform -rotate-6 hover:rotate-0 transition-transform">
            <Mic className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {isResettingPassword ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Create Account')}
          </h1>
          <p className="text-gray-500 mt-2">
            {isResettingPassword 
              ? 'Enter your email to receive a temporary password.'
              : (isLogin ? 'Enter your credentials to access the orchestrator' : 'Join the AI Voice revolution')}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100 animate-fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {tempPassword && (
          <div className="mb-6 p-4 bg-green-50 text-green-800 rounded-xl flex flex-col items-center justify-center gap-2 border border-green-200 animate-fade-in text-center">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Password Reset Successful
            </div>
            <p className="text-sm">Your temporary password is:</p>
            <div className="text-2xl font-mono font-bold tracking-widest bg-white px-4 py-2 rounded shadow-inner my-1 select-all">
              {tempPassword}
            </div>
            <p className="text-xs text-green-700">Please copy this password, click "Log in", and change it immediately from your Profile.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                name="full_name"
                placeholder="Full Name"
                required
                value={formData.full_name}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm"
              />
            </div>
          )}
          
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm"
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm"
            />
          </div>

          {!isResettingPassword && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                name="password"
                placeholder="Password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-12 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm"
              />
            </div>
          )}

          {!isResettingPassword && isLogin && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setIsResettingPassword(true); setError(''); setTempPassword(''); }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline transition-all"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isResettingPassword ? 'Reset Password' : (isLogin ? 'Sign In' : 'Create Account'))}
          </button>
        </form>

        <div className="mt-8 text-center">
          {isResettingPassword ? (
            <p className="text-sm text-gray-600">
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => { setIsResettingPassword(false); setError(''); setTempPassword(''); setIsLogin(true); }}
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-all"
              >
                Log in
              </button>
            </p>
          ) : (
            <p className="text-sm text-gray-600">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-all"
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
