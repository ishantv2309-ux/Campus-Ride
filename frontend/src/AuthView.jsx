import React, { useState, useEffect } from 'react';
import { Sun, Moon, AlertCircle, CheckCircle2, Eye, EyeOff, ShieldCheck, ArrowRight, User, Mail, Lock, Car, Tag } from 'lucide-react';

export default function AuthView({ onAuthSuccess, apiBase = 'http://localhost:8000/api' }) {
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
    <div className="min-h-screen w-full bg-[#F8FAFC] dark:bg-[#09090B] text-[#0F172A] dark:text-[#FAFAFA] flex flex-col justify-between p-4 sm:p-8 font-sans">
      
      {/* Top Bar: Brand & Light/Dark Mode Toggle */}
      <header className="max-w-md w-full mx-auto flex items-center justify-between pb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-slate-100 dark:bg-[#121215] text-emerald-500 flex items-center justify-center font-bold text-xs rounded border border-[#E2E8F0] dark:border-emerald-500/40 font-mono">
            CR
          </div>
          <div>
            <span className="font-bold tracking-tight text-sm font-mono text-[#0F172A] dark:text-white uppercase">Campus<span className="text-emerald-500">Ride</span></span>
            <span className="text-[10px] block font-mono text-slate-500 dark:text-zinc-400 leading-none mt-0.5">
              KCC Institute Student Commute Network
            </span>
          </div>
        </div>

        {/* Tactile Light/Dark Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272A] hover:border-slate-400 dark:hover:border-zinc-700 text-[#0F172A] dark:text-zinc-200 rounded active:scale-[0.98] transition-all cursor-pointer select-none"
        >
          {theme === 'dark' ? (
            <>
              <Sun key="sun-icon-auth" className="w-3.5 h-3.5 text-amber-400 theme-toggle-icon" />
              <span className="font-mono">LIGHT</span>
            </>
          ) : (
            <>
              <Moon key="moon-icon-auth" className="w-3.5 h-3.5 text-slate-700 theme-toggle-icon" />
              <span className="font-mono">DARK</span>
            </>
          )}
        </button>
      </header>

      {/* Main Authentication Card */}
      <main className="max-w-md w-full mx-auto my-auto">
        <div className="bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272A] rounded shadow-sm">
          
          {/* Card Header & Tactile Tabs */}
          <div className="border-b border-[#E2E8F0] dark:border-[#27272A] bg-slate-50 dark:bg-[#09090B] grid grid-cols-2 p-1 gap-1 rounded-t">
            <button
              type="button"
              onClick={() => handleTabChange('signin')}
              className={`py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all select-none rounded border active:scale-[0.98] ${
                activeTab === 'signin'
                  ? 'bg-white dark:bg-[#121215] text-[#0F172A] dark:text-emerald-400 border-[#E2E8F0] dark:border-emerald-500/50'
                  : 'bg-transparent text-slate-500 dark:text-zinc-400 border-transparent hover:text-[#0F172A] dark:hover:text-zinc-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('signup')}
              className={`py-2 text-xs font-mono font-bold uppercase tracking-wider transition-all select-none rounded border active:scale-[0.98] ${
                activeTab === 'signup'
                  ? 'bg-white dark:bg-[#121215] text-[#0F172A] dark:text-emerald-400 border-[#E2E8F0] dark:border-emerald-500/50'
                  : 'bg-transparent text-slate-500 dark:text-zinc-400 border-transparent hover:text-[#0F172A] dark:hover:text-zinc-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          <div className="p-6 sm:p-7 space-y-5">
            
            {/* Header Text */}
            <div>
              <h1 className="text-lg font-bold font-mono tracking-tight text-[#0F172A] dark:text-white">
                {activeTab === 'signin' ? 'Access Student Dispatch' : 'Register Student Commuter'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-mono">
                {activeTab === 'signin'
                  ? 'Authenticate with your verified @college.edu.in account.'
                  : 'Connect your verified college identity to match campus rides.'}
              </p>
            </div>

            {/* Notification Banner */}
            {statusState.type && (
              <div
                role="alert"
                className={`p-3.5 border text-xs font-mono font-medium flex items-start gap-2.5 rounded transition-all ${
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-zinc-200 mb-1.5">
                    Full Name <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ishant Verma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#09090B] border border-[#E2E8F0] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] rounded px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Email (Both Tabs) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                    College Email <span className="text-rose-600">*</span>
                  </label>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 dark:bg-[#09090B] text-slate-600 dark:text-zinc-400 border border-[#E2E8F0] dark:border-[#27272A] rounded">
                    @college.edu.in
                  </span>
                </div>
                <input
                  type="email"
                  required
                  placeholder="rollnumber@college.edu.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full bg-slate-50 dark:bg-[#09090B] border rounded px-3.5 py-2 text-xs font-mono focus:outline-none transition-colors ${
                    hasTypedEmail
                      ? isCollegeEmail
                        ? 'border-emerald-500 text-[#0F172A] dark:text-[#FAFAFA]'
                        : 'border-rose-500 text-[#0F172A] dark:text-[#FAFAFA]'
                      : 'border-[#E2E8F0] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] focus:border-emerald-500'
                  }`}
                />
                <div className="flex items-center justify-between mt-1 text-[11px] font-mono">
                  <span className={hasTypedEmail && !isCollegeEmail ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500 dark:text-zinc-400'}>
                    Must terminate in @college.edu.in
                  </span>
                  {hasTypedEmail && (
                    <span className={isCollegeEmail ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400'}>
                      {isCollegeEmail ? '✓ Domain verified' : '✗ Invalid domain'}
                    </span>
                  )}
                </div>
              </div>

              {/* Password (Both Tabs) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-zinc-200 mb-1.5">
                  Password <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#09090B] border border-[#E2E8F0] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] rounded px-3.5 py-2 pr-10 text-xs font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 p-1"
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
                    <div className="p-3 border border-[#E2E8F0] dark:border-[#27272A] bg-slate-50 dark:bg-[#09090B] rounded">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                          Vehicle Brand
                        </label>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">Optional</span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Honda, Yamaha, Maruti, Hyundai"
                        value={vehicleBrand}
                        onChange={(e) => setVehicleBrand(e.target.value)}
                        className="w-full bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272A] text-[#0F172A] dark:text-[#FAFAFA] rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono block mt-1">
                        Helps fellow student passengers recognize your ride at pickup points.
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Tactile Primary Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs uppercase tracking-wider rounded border border-emerald-400 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer select-none"
              >
                {loading ? (
                  <span>Processing Dispatch...</span>
                ) : activeTab === 'signin' ? (
                  <>
                    <span>Authenticate Identity</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Complete Verification</span>
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Credentials Footer */}
            <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#27272A] text-[11px] font-mono text-slate-500 dark:text-zinc-400">
              <span className="font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300 block mb-1">
                Demo Commuter Quick Fill:
              </span>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('aarav.sharma@college.edu.in');
                    setPassword('Campus@2026');
                    setActiveTab('signin');
                  }}
                  className="p-2 text-left border border-[#E2E8F0] dark:border-[#27272A] bg-slate-50 dark:bg-[#09090b] hover:border-emerald-500/50 rounded text-[10px] transition-all active:scale-[0.98]"
                >
                  <span className="font-bold text-[#0F172A] dark:text-emerald-400 block font-mono">Driver Aarav (Car)</span>
                  <span className="text-slate-500 dark:text-zinc-500 font-mono">aarav.sharma@...</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail('rohan.verma@college.edu.in');
                    setPassword('Campus@2026');
                    setActiveTab('signin');
                  }}
                  className="p-2 text-left border border-[#E2E8F0] dark:border-[#27272A] bg-slate-50 dark:bg-[#09090b] hover:border-emerald-500/50 rounded text-[10px] transition-all active:scale-[0.98]"
                >
                  <span className="font-bold text-[#0F172A] dark:text-emerald-400 block font-mono">Rider Rohan</span>
                  <span className="text-slate-500 dark:text-zinc-500 font-mono">rohan.verma@...</span>
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
