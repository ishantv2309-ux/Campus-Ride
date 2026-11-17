import React, { useState, useEffect } from 'react';
import { Sun, Moon, AlertCircle, CheckCircle2, Eye, EyeOff, ShieldCheck, ArrowRight, User, Mail, Lock, Car, Tag } from 'lucide-react';

export default function AuthView({ onAuthSuccess, apiBase = '/api' }) {
  // Theme state: 'light' | 'dark'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('campusride_theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  // Tab State: 'signin' | 'signup'
  const [activeTab, setActiveTab] = useState('signin');

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState('None / Rider Only');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Notification state
  const [statusState, setStatusState] = useState({ type: null, message: '' });
  const [loading, setLoading] = useState(false);

  // Sync theme to document element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('campusride_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Reset notifications on tab switch
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setStatusState({ type: null, message: '' });
  };

  // Email validation check
  const isCollegeEmail = email.trim().toLowerCase().endsWith('@college.edu.in');
  const hasTypedEmail = email.trim().length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusState({ type: null, message: '' });

    if (!email.trim() || !password.trim()) {
      setStatusState({ type: 'error', message: 'Please enter both your college email and password.' });
      return;
    }

    if (!isCollegeEmail) {
      setStatusState({
        type: 'error',
        message: 'Access Restricted: Only verified student emails ending with @college.edu.in are permitted.'
      });
      return;
    }

    if (activeTab === 'signup' && !fullName.trim()) {
      setStatusState({ type: 'error', message: 'Full name is required to complete profile setup.' });
      return;
    }

    setLoading(true);

    try {
      if (activeTab === 'signup') {
        const payload = {
          full_name: fullName.trim(),
          college_name: "KCC Institute of Technology and Management",
          college_email: email.trim().toLowerCase(),
          password: password,
          vehicle_type: vehicleType,
          vehicle_brand: vehicleType !== 'None / Rider Only' ? vehicleBrand.trim() : null
        };

        const res = await fetch(`${apiBase}/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Registration failed. Please verify your credentials.');
        }

        setStatusState({
          type: 'success',
          message: data.message || `Account created successfully for ${data.user.full_name}. Session token issued.`
        });

        if (onAuthSuccess) {
          setTimeout(() => onAuthSuccess(data), 600);
        }
      } else {
        const payload = {
          college_email: email.trim().toLowerCase(),
          password: password
        };

        const res = await fetch(`${apiBase}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.detail || 'Invalid email or password.');
        }

        setStatusState({
          type: 'success',
          message: `Welcome back, ${data.user.full_name}! Logging in...`
        });

        if (onAuthSuccess) {
          setTimeout(() => onAuthSuccess(data), 600);
        }
      }
    } catch (err) {
      setStatusState({
        type: 'error',
        message: err.message || 'Network error occurred. Ensure backend is running.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-[#09090B] text-[#0F172A] dark:text-[#FAFAFA] flex flex-col justify-between p-3 sm:p-8 font-sans overflow-x-hidden">
      
      {/* Top Bar: Brand & Light/Dark Mode Toggle */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between pb-4 sm:pb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs rounded-xl border border-emerald-500/30 font-sans shadow-sm">
            CR
          </div>
          <div className="min-w-0">
            <span className="font-bold tracking-tight text-base text-slate-900 dark:text-white block truncate">
              Campus<span className="text-emerald-500">Ride</span>
            </span>
            <span className="text-xs block text-slate-500 dark:text-zinc-400 leading-tight truncate">
              KCC Institute • Student Commute Network
            </span>
          </div>
        </div>

        {/* Tactile Light/Dark Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold uppercase tracking-wider bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-700 text-slate-900 dark:text-zinc-200 rounded-full active:scale-[0.98] transition-all cursor-pointer select-none shrink-0 shadow-sm"
        >
          {theme === 'dark' ? (
            <>
              <Sun key="sun-icon-auth" className="w-3.5 h-3.5 text-amber-400 theme-toggle-icon shrink-0" />
              <span className="font-mono text-[11px]">LIGHT</span>
            </>
          ) : (
            <>
              <Moon key="moon-icon-auth" className="w-3.5 h-3.5 text-slate-700 theme-toggle-icon shrink-0" />
              <span className="font-mono text-[11px]">DARK</span>
            </>
          )}
        </button>
      </header>

      {/* Main Authentication Card */}
      <main className="max-w-md w-full mx-auto my-auto">
        <div className="bg-white/90 dark:bg-[#121215]/90 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-black/60 overflow-hidden">
          
          {/* Card Header & Sleek Segmented Tabs */}
          <div className="border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/70 dark:bg-zinc-950/50 p-2">
            <div className="grid grid-cols-2 p-1 gap-1.5 bg-slate-100/90 dark:bg-zinc-900/90 rounded-xl border border-slate-200/60 dark:border-zinc-800 shadow-inner">
              <button
                type="button"
                onClick={() => handleTabChange('signin')}
                className={`py-2 min-h-[38px] text-xs font-semibold transition-all select-none rounded-lg active:scale-[0.98] ${
                  activeTab === 'signin'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-zinc-700 font-bold'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('signup')}
                className={`py-2 min-h-[38px] text-xs font-semibold transition-all select-none rounded-lg active:scale-[0.98] ${
                  activeTab === 'signup'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-zinc-700 font-bold'
                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                }`}
              >
                Register
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-7 space-y-4 sm:space-y-5">
            
            {/* Header Text */}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {activeTab === 'signin' ? 'Welcome Back, Commuter' : 'Register Student Commuter'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
                {activeTab === 'signin'
                  ? 'Sign in with your verified KCC Institute credentials.'
                  : 'Connect your verified college identity to match daily rides.'}
              </p>
            </div>

            {/* Notification Banner */}
            {statusState.type && (
              <div
                role="alert"
                className={`p-3.5 border text-xs font-medium flex items-start gap-2.5 rounded-xl transition-all ${
                  statusState.type === 'error'
                    ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800'
                }`}
              >
                {statusState.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                )}
                <div className="leading-relaxed">{statusState.message}</div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Sign Up: Full Name */}
              {activeTab === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200 mb-1.5">
                    Full Name <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ishant Verma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Email (Both Tabs) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    College Email <span className="text-rose-600">*</span>
                  </label>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 rounded-full font-medium">
                    @college.edu.in
                  </span>
                </div>
                <input
                  type="email"
                  required
                  placeholder="rollnumber@college.edu.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 transition-all ${
                    hasTypedEmail
                      ? isCollegeEmail
                        ? 'border-emerald-500 focus:ring-emerald-500/20 text-slate-900 dark:text-white'
                        : 'border-rose-500 focus:ring-rose-500/20 text-slate-900 dark:text-white'
                      : 'border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                  }`}
                />
                <div className="flex items-center justify-between mt-1 text-[11px]">
                  <span className={hasTypedEmail && !isCollegeEmail ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-slate-500 dark:text-zinc-400'}>
                    Must end with @college.edu.in
                  </span>
                  {hasTypedEmail && (
                    <span className={isCollegeEmail ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-medium'}>
                      {isCollegeEmail ? '✓ Domain verified' : '✗ Invalid domain'}
                    </span>
                  )}
                </div>
              </div>

              {/* Password (Both Tabs) */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200 mb-1.5">
                  Password <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 pr-10 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 p-1 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Sign Up: Vehicle Type & Optional Brand */}
              {activeTab === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-zinc-200 mb-1.5">
                      Vehicle Type
                    </label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#09090B] border border-[#E2E8F0] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                    >
                      <option value="None / Rider Only">None / Rider Only</option>
                      <option value="Car">Car</option>
                      <option value="Motorcycle">Motorcycle</option>
                      <option value="Scooty">Scooty</option>
                    </select>
                  </div>

                  {/* Vehicle Brand (Conditional/Optional) */}
                  {vehicleType !== 'None / Rider Only' && (
                    <div className="p-3 border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 rounded-xl">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-slate-800 dark:text-zinc-200">
                          Vehicle Brand
                        </label>
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400">Optional</span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Honda, Yamaha, Maruti, Hyundai"
                        value={vehicleBrand}
                        onChange={(e) => setVehicleBrand(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-950 dark:text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-1">
                        Helps fellow student passengers recognize your ride at pickup points.
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-3 min-h-[44px] py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer select-none"
              >
                {loading ? (
                  <span>Processing...</span>
                ) : activeTab === 'signin' ? (
                  <>
                    <span>Sign In to CampusRide</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Complete Student Registration</span>
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Credentials Footer */}
            <div className="pt-4 border-t border-slate-100 dark:border-zinc-800/80 text-[11px] text-slate-500 dark:text-zinc-400">
              <span className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                Demo Accounts (1-Click Fill):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('aarav.sharma@college.edu.in');
                    setPassword('Campus@2026');
                    setActiveTab('signin');
                  }}
                  className="p-2.5 min-h-[44px] text-left border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 hover:border-emerald-500/50 rounded-xl text-[11px] transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span className="font-semibold text-slate-900 dark:text-emerald-400 block">Driver Aarav (Car)</span>
                  <span className="text-slate-500 dark:text-zinc-400 font-mono text-[10px]">aarav.sharma@...</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('rohan.verma@college.edu.in');
                    setPassword('Campus@2026');
                    setActiveTab('signin');
                  }}
                  className="p-2.5 min-h-[44px] text-left border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 hover:border-emerald-500/50 rounded-xl text-[11px] transition-all active:scale-[0.98] cursor-pointer"
                >
                  <span className="font-semibold text-slate-900 dark:text-emerald-400 block">Rider Rohan</span>
                  <span className="text-slate-500 dark:text-zinc-400 font-mono text-[10px]">rohan.verma@...</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-md w-full mx-auto pt-6 text-center text-[10px] font-mono text-slate-500 dark:text-zinc-400">
        CampusRide • KCC Institute Student Commute Network
      </footer>
    </div>
  );
}
