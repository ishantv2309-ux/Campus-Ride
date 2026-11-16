import React, { useState, useEffect } from 'react';
import AuthView from './AuthView.jsx';
import {
  Car,
  Bike,
  ShieldCheck,
  MapPin,
  Clock,
  Users,
  Compass,
  ArrowRight,
  Sparkles,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Download,
  Info,
  ChevronRight,
  TrendingUp,
  Search,
  PlusCircle,
  Calendar,
  Phone,
  UserCheck,
  Check,
  Sun,
  Moon,
  Filter,
  Activity,
  Navigation,
  Zap
} from 'lucide-react';

const API_BASE = window.location.port === '5173' ? '/api' : (window.location.origin.includes('8000') ? '/api' : 'http://localhost:8000/api');

export default function App() {
  // Theme State
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('campusride_theme') || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

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

  // Session State
  const [token, setToken] = useState(() => localStorage.getItem('campusride_jwt') || '');
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('campusride_user');
    return saved ? JSON.parse(saved) : null;
  });

  // UI Navigation Mode: 'welcome' (if no token) | 'rider' | 'driver' | 'matcher'
  const [activeTab, setActiveTab] = useState('rider');
  const [notification, setNotification] = useState(null);
  const [selectedHubFilter, setSelectedHubFilter] = useState('All Hubs');

  // Metadata
  const [locations, setLocations] = useState({ corridors: [], campus_gates: [], vehicle_types: [] });

  // Auth Form State
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFullName, setAuthFullName] = useState('');
  const [authRole, setAuthRole] = useState('rider');
  const [authVehicle, setAuthVehicle] = useState('car');
  const [authStudentId, setAuthStudentId] = useState('2024-CS-101');
  const [authPhone, setAuthPhone] = useState('+91 98765 43210');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Dashboard Data State
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [activeRides, setActiveRides] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [myPostedRides, setMyPostedRides] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);

  // Saved Route Modal / Form
  const [showNewRouteModal, setShowNewRouteModal] = useState(false);
  const [newRouteLabel, setNewRouteLabel] = useState('');
  const [newRouteOrigin, setNewRouteOrigin] = useState('');
  const [newRouteGate, setNewRouteGate] = useState('');
  const [newRouteTime, setNewRouteTime] = useState('08:30 AM');

  // Driver Post Ride Form
  const [postOrigin, setPostOrigin] = useState('');
  const [postGate, setPostGate] = useState('');
  const [postTime, setPostTime] = useState('08:30 AM');
  const [postSeats, setPostSeats] = useState(3);
  const [postVehicle, setPostVehicle] = useState('car');
  const [postNotes, setPostNotes] = useState('');
  const [postLoading, setPostLoading] = useState(false);

  // Live Route Matcher & AutoML Predictor Sandbox State
  const [sandboxOrigin, setSandboxOrigin] = useState('Noida 62');
  const [sandboxGate, setSandboxGate] = useState('KCC Institute of Technology and Management');
  const [sandboxVehicle, setSandboxVehicle] = useState('car');
  const [sandboxHour, setSandboxHour] = useState(8);
  const [sandboxPrediction, setSandboxPrediction] = useState(null);
  const [predictLoading, setPredictLoading] = useState(false);

  // KCC Institute AutoML Route Predictor State
  const [kccPickup, setKccPickup] = useState('Lal Kuan');
  const [kccTime, setKccTime] = useState('08:30 AM');
  const [kccVehicle, setKccVehicle] = useState('Car');
  const [kccResult, setKccResult] = useState(null);
  const [kccLoading, setKccLoading] = useState(false);

  // Waypoint helper for corridor visualizer
  const getCorridorWaypoints = (origin) => {
    const norm = (origin || '').toLowerCase();
    if (norm.includes('noida 62') || norm.includes('62')) {
      return ['Noida 62', 'Sector 71', 'FNG Expwy', 'Noida Expwy', 'Pari Chowk', 'KCC ITM'];
    }
    if (norm.includes('nh-3') || norm.includes('nh3')) {
      return ['NH-3 Crossings', 'Char Murti', '130m Expwy', 'Pari Chowk', 'KCC ITM'];
    }
    if (norm.includes('chapraula')) {
      return ['Chapraula', 'Surajpur Ind.', 'Dadri Bypass', 'Pari Chowk', 'KCC ITM'];
    }
    if (norm.includes('lal kuan') || norm.includes('lalkuan')) {
      return ['Lal Kuan', 'EPE Bypass', 'Dadri Bypass', 'Pari Chowk', 'KCC ITM'];
    }
    if (norm.includes('indirapuram')) {
      return ['Indirapuram', 'FNG Expwy', 'Noida Expwy', 'Pari Chowk', 'KCC ITM'];
    }
    return [origin || 'Pickup Hub', 'Corridor Link', 'Pari Chowk', 'KCC ITM'];
  };

  // Show Toast
  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4500);
  };

  // Fetch Locations Metadata
  useEffect(() => {
    fetch(`${API_BASE}/meta/locations`)
      .then(res => res.json())
      .then(data => {
        setLocations(data);
        if (data.corridors?.length > 0) {
          setPostOrigin(data.corridors[0].zone);
          setNewRouteOrigin(data.corridors[0].zone);
          setSandboxOrigin(data.corridors[0].zone);
        }
        if (data.campus_gates?.length > 0) {
          setPostGate(data.campus_gates[0]);
          setNewRouteGate(data.campus_gates[0]);
          setSandboxGate(data.campus_gates[0]);
        }
      })
      .catch(err => console.error('Error fetching locations:', err));
  }, []);

  // Fetch Dashboard Content when user is authenticated
  const refreshDashboard = () => {
    if (!token) return;
    setLoadingFeed(true);

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API_BASE}/rides`).then(r => r.json()),
      fetch(`${API_BASE}/routes/saved`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/bookings/my-bookings`, { headers }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/rides/my-posted`, { headers }).then(r => r.ok ? r.json() : [])
    ])
      .then(([rides, routes, bookings, posted]) => {
        setActiveRides(Array.isArray(rides) ? rides : []);
        setSavedRoutes(Array.isArray(routes) ? routes : []);
        setMyBookings(Array.isArray(bookings) ? bookings : []);
        setMyPostedRides(Array.isArray(posted) ? posted : []);
      })
      .catch(err => console.error('Error refreshing dashboard:', err))
      .finally(() => setLoadingFeed(false));
  };

  useEffect(() => {
    if (token) {
      refreshDashboard();
    }
  }, [token]);

  // KCC Institute AutoML Route Predictor Effect
  useEffect(() => {
    if (!kccPickup) return;
    setKccLoading(true);
    fetch(`${API_BASE}/predict-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickup_location: kccPickup,
        ride_time: kccTime,
        vehicle_type: kccVehicle
      })
    })
      .then(res => res.json())
      .then(data => setKccResult(data))
      .catch(err => console.error('KCC AutoML predict error:', err))
      .finally(() => setKccLoading(false));
  }, [kccPickup, kccTime, kccVehicle]);

  // Auth Submit
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (isRegisterMode) {
        // Enforce FR-AUTH.1 on client side as well for instant feedback
        if (!authEmail.trim().toLowerCase().endsWith('@college.edu.in')) {
          setAuthError("Registration rejected: Only verified college email addresses ending with '@college.edu.in' are permitted.");
          setAuthLoading(false);
          return;
        }

        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: authFullName,
            college_email: authEmail,
            password: authPassword,
            role: authRole,
            vehicle_type: authRole === 'driver' ? authVehicle : null,
            student_id: authStudentId,
            phone: authPhone
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Registration failed');

        localStorage.setItem('campusride_jwt', data.access_token);
        localStorage.setItem('campusride_user', JSON.stringify(data.user));
        setToken(data.access_token);
        setCurrentUser(data.user);
        notify(`Welcome to CampusRide, ${data.user.full_name}! Verified @college.edu.in account created.`);
      } else {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            college_email: authEmail,
            password: authPassword
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Login failed');

        localStorage.setItem('campusride_jwt', data.access_token);
        localStorage.setItem('campusride_user', JSON.stringify(data.user));
        setToken(data.access_token);
        setCurrentUser(data.user);
        notify(`Logged in as ${data.user.full_name} (${data.user.role.toUpperCase()})`);
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('campusride_jwt');
    localStorage.removeItem('campusride_user');
    setToken('');
    setCurrentUser(null);
    notify('Successfully signed out.', 'info');
  };

  // Demo Login Quick-Fill
  const quickDemoLogin = (email, pwd) => {
    setAuthEmail(email);
    setAuthPassword(pwd);
    setIsRegisterMode(false);
  };

  // Book a Seat (Step 4 state sync)
  const handleBookSeat = async (rideId) => {
    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ride_id: rideId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Booking failed');

      notify(`Seat Confirmed! Driver ${data.driver_name} notified. Remaining seats: ${data.seats_remaining}`);
      refreshDashboard();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  // Post a Ride (Driver)
  const handlePostRide = async (e) => {
    e.preventDefault();
    setPostLoading(true);
    try {
      const res = await fetch(`${API_BASE}/rides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          origin_zone: postOrigin,
          destination_gate: postGate,
          departure_time: postTime,
          seats_total: parseInt(postSeats),
          vehicle_type: postVehicle,
          notes: postNotes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to post ride');

      notify(`Ride published! Connected AutoML estimated ETA: ${data.ride.predicted_eta_mins} mins.`);
      setPostNotes('');
      refreshDashboard();
      setActiveTab('rider'); // Switch to view in feed
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setPostLoading(false);
    }
  };

  // Add Saved Route
  const handleCreateSavedRoute = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/routes/saved`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          route_label: newRouteLabel || `${newRouteOrigin.split(' ')[0]} to Campus`,
          origin_zone: newRouteOrigin,
          campus_gate: newRouteGate,
          preferred_time: newRouteTime
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to save route');

      notify(`Saved route "${data.route_label}" created!`);
      setShowNewRouteModal(false);
      setNewRouteLabel('');
      refreshDashboard();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  // 1-Click Route Autofill
  const handleUseSavedRoute = (route) => {
    setPostOrigin(route.origin_zone);
    setPostGate(route.campus_gate);
    setPostTime(route.preferred_time);
    setSandboxOrigin(route.origin_zone);
    setSandboxGate(route.campus_gate);
    notify(`Autofilled: ${route.origin_zone} ➔ ${route.campus_gate}`);
  };

  // Export Trips CSV (Continuous Learning Loop)
  const handleExportCSV = () => {
    window.open(`${API_BASE}/admin/export-trips`, '_blank');
    notify('Campus commute trip records exported to CSV for AutoML retraining.');
  };

  // =========================================================================
  // SCREEN 1: WELCOME & LOGIN SCREEN (High-Contrast Minimalist Tactile Interface)
  // =========================================================================
  if (!token || !currentUser) {
    return (
      <AuthView
        apiBase={API_BASE}
        onAuthSuccess={(data) => {
          localStorage.setItem('campusride_jwt', data.access_token);
          localStorage.setItem('campusride_user', JSON.stringify(data.user));
          setToken(data.access_token);
          setCurrentUser(data.user);
          notify(`Welcome to CampusRide, ${data.user.full_name}! Verified @college.edu.in account active.`);
        }}
      />
    );
  }

  // =========================================================================
  // SCREENS 2 & 3: MAIN COMMUTE DASHBOARD
  // =========================================================================
  // Filtered rides based on selected hub
  const filteredRides = activeRides.filter((ride) => {
    if (selectedHubFilter === 'All Hubs') return true;
    return (ride.origin_zone || '').toLowerCase().includes(selectedHubFilter.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#09090B] text-[#0F172A] dark:text-[#FAFAFA] flex flex-col font-sans">
      {/* Tactical Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded border flex items-center gap-2.5 text-xs font-mono shadow-lg transition-all ${
          notification.type === 'error'
            ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-[#1c1012] dark:text-rose-300 dark:border-rose-800/80'
            : notification.type === 'info'
            ? 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-[#0f172a] dark:text-sky-300 dark:border-sky-800/80'
            : 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-[#062016] dark:text-emerald-300 dark:border-emerald-700/80'
        }`}>
          {notification.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Top Header: Tactical Dispatch Console */}
      <header className="bg-white dark:bg-[#09090b] border-b border-[#E2E8F0] dark:border-[#27272a] sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-100 dark:bg-[#121215] text-emerald-500 border border-[#E2E8F0] dark:border-emerald-500/50 flex items-center justify-center font-mono font-bold text-xs rounded">
              CR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-[#0F172A] dark:text-white font-mono">CAMPUS<span className="text-emerald-500">RIDE</span></span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono block">
                KCC Institute of Technology & Management • Knowledge Park II, Greater Noida
              </span>
            </div>
          </div>

          {/* User Status Bar & Controls */}
          <div className="flex items-center gap-2.5">
            {/* Tactile Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] hover:border-slate-400 dark:hover:border-zinc-700 text-[#0F172A] dark:text-zinc-300 rounded active:scale-[0.98] transition-all cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun key="sun-icon" className="w-3.5 h-3.5 text-amber-400 theme-toggle-icon" />
                  <span className="font-mono">LIGHT</span>
                </>
              ) : (
                <>
                  <Moon key="moon-icon" className="w-3.5 h-3.5 text-slate-700 theme-toggle-icon" />
                  <span className="font-mono">DARK</span>
                </>
              )}
            </button>

            {/* Profile Info Badge */}
            <div className="hidden md:flex items-center gap-2 bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] px-3 py-1 rounded text-xs font-mono">
              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
              <div>
                <span className="font-semibold text-[#0F172A] dark:text-white">{currentUser.full_name}</span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 block font-mono">
                  {currentUser.college_email} • {currentUser.vehicle_type || 'Rider Only'}
                  {currentUser.vehicle_brand ? ` (${currentUser.vehicle_brand})` : ''}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded bg-white dark:bg-[#121215] hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-[#E2E8F0] dark:border-[#27272a] hover:border-rose-400 dark:hover:border-rose-700 text-slate-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-300 active:scale-[0.98] transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Sub-Header & Mode Navigation */}
      <div className="bg-slate-50 dark:bg-[#09090b] border-b border-[#E2E8F0] dark:border-[#27272a] py-2.5 px-4 sm:px-6 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3">
          {/* Mode Switch Tabs */}
          <div className="inline-flex bg-white dark:bg-[#121215] p-1 rounded border border-[#E2E8F0] dark:border-[#27272a]">
            <button
              onClick={() => setActiveTab('rider')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all flex items-center gap-1.5 active:scale-[0.98] cursor-pointer ${
                activeTab === 'rider'
                  ? 'bg-slate-200 dark:bg-zinc-800 text-[#0F172A] dark:text-white border border-slate-300 dark:border-zinc-700 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-500" />
              <span>Rider Dispatch</span>
            </button>
            <button
              onClick={() => setActiveTab('driver')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all flex items-center gap-1.5 active:scale-[0.98] cursor-pointer ${
                activeTab === 'driver'
                  ? 'bg-slate-200 dark:bg-zinc-800 text-[#0F172A] dark:text-white border border-slate-300 dark:border-zinc-700 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <Car className="w-3.5 h-3.5 text-emerald-500" />
              <span>Driver Mode</span>
            </button>
            <button
              onClick={() => setActiveTab('matcher')}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all flex items-center gap-1.5 active:scale-[0.98] cursor-pointer ${
                activeTab === 'matcher'
                  ? 'bg-emerald-500 text-black border border-emerald-400 font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AutoML Route Engine</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshDashboard}
              title="Refresh Live State"
              className="p-1.5 rounded bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] hover:border-slate-400 dark:hover:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white active:scale-[0.98] transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingFeed ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">

        {/* 1. SAVED ROUTES SECTION */}
        <div className="bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] hover:border-slate-300 dark:hover:border-[#3f3f46] rounded p-4 sm:p-5 transition-colors shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-emerald-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white font-mono">Saved Commute Corridors</h2>
              <span className="text-[10px] bg-slate-100 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-slate-600 dark:text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                1-Click Autofill
              </span>
            </div>
            <button
              onClick={() => setShowNewRouteModal(true)}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 font-mono font-semibold cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Corridor
            </button>
          </div>

          {savedRoutes.length === 0 ? (
            <div className="text-center py-4 text-slate-500 dark:text-zinc-500 text-xs bg-slate-50 dark:bg-[#09090b] rounded border border-dashed border-[#E2E8F0] dark:border-[#27272a] font-mono">
              No saved routes yet. Add your daily home commute corridor for 1-click autofill.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {savedRoutes.map((route) => (
                <div
                  key={route.id}
                  className="bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] hover:border-slate-300 dark:hover:border-zinc-700 p-3 rounded flex flex-col justify-between transition-colors"
                >
                  <div>
                    <div className="font-semibold text-xs text-[#0F172A] dark:text-white mb-1 flex items-center justify-between font-mono">
                      <span>{route.route_label}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">{route.preferred_time}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1 truncate mb-2 font-mono">
                      <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="font-medium text-slate-700 dark:text-zinc-300">{route.origin_zone}</span>
                      <ChevronRight className="w-3 h-3 shrink-0 text-slate-400 dark:text-zinc-600" />
                      <span className="text-slate-600 dark:text-zinc-400">{route.campus_gate}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUseSavedRoute(route)}
                    className="w-full mt-1 bg-white dark:bg-[#121215] hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-[#0F172A] dark:hover:text-white text-[11px] font-mono font-semibold py-1 rounded transition-all flex items-center justify-center gap-1.5 border border-[#E2E8F0] dark:border-[#27272a] active:scale-[0.98] cursor-pointer"
                  >
                    <Check className="w-3 h-3 text-emerald-500" /> Apply Route
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. MODE CONTENT: RIDER VIEW */}
        {activeTab === 'rider' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Ride Feed (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] dark:text-white flex items-center gap-2 font-mono">
                    <Activity className="w-4 h-4 text-emerald-500" /> Available Rides to Campus
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono">Verified student driver carpools bound for KCC Institute of Technology & Management</p>
                </div>
                <span className="text-xs font-mono bg-white dark:bg-[#121215] text-emerald-600 dark:text-emerald-400 border border-[#E2E8F0] dark:border-emerald-500/30 px-2 py-0.5 rounded font-semibold">
                  {filteredRides.length} active
                </span>
              </div>

              {/* Hub Quick-Filter Bar */}
              <div className="bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] p-2 rounded flex items-center gap-1.5 overflow-x-auto text-xs font-mono shadow-sm">
                <span className="text-slate-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-emerald-500" /> Pickup Hub:
                </span>
                {['All Hubs', 'Noida 62', 'NH-3', 'Chapraula', 'Lal Kuan'].map((hub) => (
                  <button
                    key={hub}
                    type="button"
                    onClick={() => setSelectedHubFilter(hub)}
                    className={`px-2.5 py-1 rounded border text-[11px] font-semibold transition-all active:scale-[0.98] cursor-pointer ${
                      selectedHubFilter === hub
                        ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                        : 'bg-slate-50 dark:bg-[#09090b] text-slate-600 dark:text-zinc-400 border-[#E2E8F0] dark:border-[#27272a] hover:border-slate-300 dark:hover:border-zinc-700 hover:text-[#0F172A] dark:hover:text-white'
                    }`}
                  >
                    {hub}
                  </button>
                ))}
              </div>

              {filteredRides.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-[#121215] rounded border border-[#E2E8F0] dark:border-[#27272a] font-mono shadow-sm">
                  <Car className="w-8 h-8 text-slate-400 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-slate-800 dark:text-zinc-300 text-xs font-semibold">No active student rides found for "{selectedHubFilter}".</p>
                  <p className="text-slate-500 dark:text-zinc-500 text-[11px] mt-1">Select "All Hubs" or switch to Driver Mode tab to publish seats.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRides.map((ride) => {
                    const waypoints = getCorridorWaypoints(ride.origin_zone);
                    const isLalKuan = (ride.origin_zone || '').toLowerCase().includes('lal kuan');

                    return (
                      <div
                        key={ride.id}
                        className="bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] hover:border-slate-300 dark:hover:border-zinc-700 rounded p-4 flex flex-col justify-between gap-3.5 transition-colors shadow-sm"
                      >
                        {/* Driver & Status Header */}
                        <div className="flex items-center justify-between gap-3 border-b border-[#E2E8F0] dark:border-[#27272a] pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded bg-slate-100 dark:bg-[#1c1c21] border border-slate-300 dark:border-zinc-700 flex items-center justify-center font-bold text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                              {ride.driver.full_name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-[#0F172A] dark:text-white">{ride.driver.full_name}</span>
                                <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 px-1.5 py-0.2 rounded font-mono uppercase tracking-wider font-semibold">
                                  Verified @college.edu.in
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                                {ride.vehicle_type === 'two_wheeler' ? 'Motorcycle' : 'Car'} • {ride.notes?.split('.')[0] || 'Verified Commuter'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right font-mono">
                            <span className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider block">Available</span>
                            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                              {ride.seats_available} <span className="text-xs text-slate-500 dark:text-zinc-500 font-normal">/ {ride.seats_total} seats</span>
                            </span>
                          </div>
                        </div>

                        {/* Interactive Corridor Visualizer (Node-and-line Timeline) */}
                        <div className="bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] rounded p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-zinc-400">
                            <span className="uppercase tracking-wider flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Route Stops
                            </span>
                            {isLalKuan && (
                              <span className="text-amber-700 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider">
                                ⚡ Fastest Route
                              </span>
                            )}
                          </div>

                          {/* Node & Line Sequence */}
                          <div className="flex items-center overflow-x-auto py-1 text-[11px] font-mono">
                            {waypoints.map((node, idx) => (
                              <React.Fragment key={idx}>
                                <span className={`px-2 py-0.5 rounded border whitespace-nowrap text-[10px] font-semibold ${
                                  idx === 0
                                    ? 'bg-slate-200 dark:bg-[#1a1a22] text-slate-800 dark:text-zinc-200 border-slate-300 dark:border-zinc-700'
                                    : idx === waypoints.length - 1
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-600 font-bold'
                                    : 'bg-white dark:bg-[#121215] text-slate-600 dark:text-zinc-400 border-[#E2E8F0] dark:border-[#27272a]'
                                }`}>
                                  {node}
                                </span>
                                {idx < waypoints.length - 1 && (
                                  <div className="flex items-center px-1 text-slate-400 dark:text-zinc-600">
                                    <span className="h-[1px] w-2.5 bg-slate-300 dark:bg-zinc-700"></span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                    <span className="h-[1px] w-2.5 bg-slate-300 dark:bg-zinc-700"></span>
                                  </div>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        {/* Telemetry Metrics Badges & Action */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                            <span className="bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] px-2 py-0.5 rounded text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400 dark:text-zinc-400" /> Dep: {ride.departure_time}
                            </span>
                            <span className="bg-slate-50 dark:bg-[#09090b] border border-emerald-500/40 px-2 py-0.5 rounded text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                              <TrendingUp className="w-3 h-3 text-emerald-500" /> AutoML ETA: {ride.predicted_eta_mins}m
                            </span>
                            <span className="bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] px-2 py-0.5 rounded text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                              <Navigation className="w-3 h-3 text-slate-400 dark:text-zinc-400" /> {ride.distance_km} km
                            </span>
                            <span className="bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] px-2 py-0.5 rounded text-slate-700 dark:text-zinc-300">
                              {isLalKuan ? (
                                <span className="text-amber-600 dark:text-amber-400 font-bold">Traffic: Lal Kuan Bypassed</span>
                              ) : (
                                <span>Traffic: Clear</span>
                              )}
                            </span>
                          </div>

                          <button
                            onClick={() => handleBookSeat(ride.id)}
                            disabled={ride.seats_available <= 0 || ride.driver.id === currentUser.id}
                            className="bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold px-3.5 py-1.5 rounded text-xs transition-all border border-emerald-400 disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-zinc-800 disabled:text-slate-400 dark:disabled:text-zinc-500 disabled:border-slate-300 dark:disabled:border-zinc-700 active:scale-[0.98] cursor-pointer"
                          >
                            {ride.driver.id === currentUser.id ? (
                              'Your Posted Ride'
                            ) : ride.seats_available <= 0 ? (
                              'Full (0 Seats)'
                            ) : (
                              'Book 1 Seat'
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sidebar: Confirmed Bookings */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] rounded p-4 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white mb-3 flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Confirmed Bookings
                </h3>

                {myBookings.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-zinc-500 py-3 text-center font-mono">No active bookings. Select a ride to confirm your seat.</p>
                ) : (
                  <div className="space-y-2">
                    {myBookings.map((b) => (
                      <div key={b.booking_id} className="bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] p-2.5 rounded text-xs font-mono">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Confirmed</span>
                          <span className="text-[10px] text-slate-500 dark:text-zinc-500">{b.ride.departure_time}</span>
                        </div>
                        <div className="text-slate-800 dark:text-zinc-300 font-medium truncate mb-1">
                          {b.ride.origin_zone} ➔ {b.ride.destination_gate}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mt-2 border-t border-[#E2E8F0] dark:border-[#27272a] pt-1.5">
                          <Phone className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                          <span>Driver: {b.ride.driver.full_name} ({b.ride.driver.phone || 'Campus Commuter'})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. MODE CONTENT: DRIVER VIEW */}
        {activeTab === 'driver' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Post Ride Card (1 col) */}
            <div className="bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] rounded p-5 space-y-4 shadow-sm">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white flex items-center gap-2 font-mono">
                  <Car className="w-4 h-4 text-emerald-500" /> Post Empty Seats
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-mono">Offer seats along verified campus commuter corridors</p>
              </div>

              <form onSubmit={handlePostRide} className="space-y-3 text-xs font-mono">
                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Pickup Corridor (Origin)</label>
                  <select
                    value={postOrigin}
                    onChange={(e) => setPostOrigin(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-zinc-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    {locations.corridors?.map((c) => (
                      <option key={c.zone} value={c.zone}>
                        {c.zone} (~{c.default_dist_km} km)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Campus Gate Destination</label>
                  <select
                    value={postGate}
                    onChange={(e) => setPostGate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-zinc-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    {locations.campus_gates?.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Departure Time</label>
                    <input
                      type="text"
                      placeholder="08:30 AM"
                      value={postTime}
                      onChange={(e) => setPostTime(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-zinc-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Seats Available</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={postSeats}
                      onChange={(e) => setPostSeats(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-zinc-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Vehicle Type</label>
                  <select
                    value={postVehicle}
                    onChange={(e) => setPostVehicle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-zinc-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value="car">Car (Sedan / Hatchback / SUV)</option>
                    <option value="two_wheeler">Two-Wheeler (Motorcycle / Scooty)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Pickup Notes / Landmark</label>
                  <input
                    type="text"
                    placeholder="e.g. Near Metro Gate 2, Leaving sharp."
                    value={postNotes}
                    onChange={(e) => setPostNotes(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-zinc-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={postLoading}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2.5 rounded transition-all border border-emerald-400 flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2 font-mono text-xs uppercase tracking-wider active:scale-[0.98] cursor-pointer"
                >
                  {postLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><PlusCircle className="w-3.5 h-3.5" /> Publish Ride</>}
                </button>
              </form>
            </div>

            {/* My Posted Rides & Passenger Sync (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white font-mono">My Posted Rides & Passengers</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono">Real-time synchronization of confirmed student bookings</p>
                </div>
              </div>

              {myPostedRides.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-[#121215] rounded border border-[#E2E8F0] dark:border-[#27272a] text-xs text-slate-500 dark:text-zinc-500 font-mono shadow-sm">
                  You haven't posted any rides yet. Use the form on the left to offer seats.
                </div>
              ) : (
                <div className="space-y-3">
                  {myPostedRides.map((ride) => (
                    <div key={ride.id} className="bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] rounded p-4 space-y-3 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 font-mono text-xs font-bold text-[#0F172A] dark:text-white">
                            <span>{ride.origin_zone}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                            <span>{ride.destination_gate}</span>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono block mt-0.5">
                            Departure: {ride.departure_time} • AutoML ETA: {ride.predicted_eta_mins} mins
                          </span>
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                            {ride.seats_available} of {ride.seats_total} seats free
                          </span>
                        </div>
                      </div>

                      {/* Passenger Bookings Table */}
                      <div className="bg-slate-50 dark:bg-[#09090b] rounded p-3 border border-[#E2E8F0] dark:border-[#27272a]">
                        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-2 font-mono">
                          Booked Passengers ({ride.passenger_bookings?.length || 0}):
                        </span>
                        {(!ride.passenger_bookings || ride.passenger_bookings.length === 0) ? (
                          <span className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono italic">No students booked yet. Seats open in feed.</span>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs font-mono">
                              <thead>
                                <tr className="border-b border-[#E2E8F0] dark:border-[#27272a] text-slate-500 dark:text-zinc-500 text-[10px] uppercase">
                                  <th className="pb-1.5">Passenger Name</th>
                                  <th className="pb-1.5">College Email</th>
                                  <th className="pb-1.5 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#27272a]">
                                {ride.passenger_bookings.map((p) => (
                                  <tr key={p.booking_id}>
                                    <td className="py-1.5 font-semibold text-[#0F172A] dark:text-white">{p.rider_name}</td>
                                    <td className="py-1.5 text-slate-500 dark:text-zinc-400">{p.rider_email}</td>
                                    <td className="py-1.5 text-right">
                                      <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                        Confirmed
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. MODE CONTENT: LIVE AUTOML ROUTE & HYBRID DIJKSTRA ENGINE */}
        {activeTab === 'matcher' && (
          <div className="space-y-6">
            {/* KCC Institute Specific AutoML Route Predictor Card */}
            <div className="bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] rounded p-5 space-y-4 shadow-sm">
              <div className="flex flex-wrap justify-between items-start gap-3 border-b border-[#E2E8F0] dark:border-[#27272a] pb-3">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-[#09090b] text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold uppercase mb-1 border border-emerald-500/40">
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    AutoML Hybrid Routing Engine
                  </div>
                  <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2 font-mono">
                    <span>Target Destination:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">KCC Institute of Technology and Management</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                    Evaluates dynamic pickup points, applies Lal Kuan traffic bottleneck weights vs Expressway bypasses, and executes Dijkstra graph search.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 block">Model Artifact:</span>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">AutoML/kcc_route_bundle</span>
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1 font-mono">Pickup Location</label>
                  <select
                    value={kccPickup}
                    onChange={(e) => setKccPickup(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-zinc-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value="Lal Kuan">Lal Kuan (Bottleneck Test)</option>
                    <option value="Noida 62">Noida 62 (Expressway Test)</option>
                    <option value="Chapraula">Chapraula (GT Road / Bypass)</option>
                    <option value="NH-3">NH-3 (Crossings Republik)</option>
                    <option value="Indirapuram">Indirapuram</option>
                    <option value="Pari Chowk">Pari Chowk (Knowledge Park)</option>
                    <option value="Char Murti / Gaur City">Gaur City (Gr. Noida West)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1 font-mono">Ride Departure Time</label>
                  <input
                    type="text"
                    value={kccTime}
                    onChange={(e) => setKccTime(e.target.value)}
                    placeholder="08:30 AM"
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-zinc-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1 font-mono">Vehicle Type</label>
                  <select
                    value={kccVehicle}
                    onChange={(e) => setKccVehicle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-zinc-100 rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value="Car">Car</option>
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="Scooty">Scooty</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setKccLoading(true);
                      fetch(`${API_BASE}/predict-route`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          pickup_location: kccPickup,
                          ride_time: kccTime,
                          vehicle_type: kccVehicle
                        })
                      })
                        .then(r => r.json())
                        .then(d => setKccResult(d))
                        .finally(() => setKccLoading(false));
                    }}
                    disabled={kccLoading}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold py-2 px-3 rounded text-xs transition-all flex items-center justify-center gap-1.5 border border-emerald-400 disabled:opacity-50 uppercase tracking-wider active:scale-[0.98] cursor-pointer"
                  >
                    {kccLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><Compass className="w-3.5 h-3.5" /> Predict Optimal Route</>}
                  </button>
                </div>
              </div>

              {/* KCC Prediction Result Display */}
              {kccResult && (
                <div className="bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] rounded p-4 space-y-4 font-mono shadow-inner">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-[#121215] p-3 rounded border border-[#E2E8F0] dark:border-[#27272a]">
                      <span className="text-[10px] text-slate-500 dark:text-zinc-500 block font-mono uppercase tracking-wider">Optimal Recommendation</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block mt-1 leading-snug">
                        {kccResult.optimal_route_recommendation}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono mt-1 block">
                        {kccResult.optimal_route_description}
                      </span>
                    </div>

                    <div className="bg-white dark:bg-[#121215] p-3 rounded border border-[#E2E8F0] dark:border-[#27272a]">
                      <span className="text-[10px] text-slate-500 dark:text-zinc-500 block font-mono uppercase tracking-wider">Predicted Door-to-Gate ETA</span>
                      <div className="text-2xl font-bold text-[#0F172A] dark:text-white font-mono mt-1">
                        {kccResult.predicted_eta_mins} <span className="text-xs text-slate-500 dark:text-zinc-400 font-normal">mins</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono block mt-1">
                        Target: KCC Institute Campus Gate
                      </span>
                    </div>

                    <div className="bg-white dark:bg-[#121215] p-3 rounded border border-[#E2E8F0] dark:border-[#27272a]">
                      <span className="text-[10px] text-slate-500 dark:text-zinc-500 block font-mono uppercase tracking-wider">AutoML Confidence Score</span>
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                        {kccResult.confidence_score}%
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono block mt-1">
                        Model: VotingRegressor (GBR + RF)
                      </span>
                    </div>
                  </div>

                  {/* Graph-Based Pathfinding & Rerouting Node Visualization */}
                  {kccResult.optimal_path_nodes && (
                    <div className="bg-white dark:bg-[#121215] p-3.5 rounded border border-[#E2E8F0] dark:border-[#27272a] space-y-3">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <span className="text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5 font-mono">
                          <Compass className="w-3.5 h-3.5 text-emerald-500" />
                          Hybrid Pathfinding Node Sequence (Dijkstra + AutoML Congestion Weights)
                        </span>
                        {kccResult.rerouted_around_bottlenecks ? (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded font-mono font-bold">
                            ⚡ Fastest Route (Bypassed)
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                            ✓ Direct Route
                          </span>
                        )}
                      </div>

                      {/* Optimal Sequence */}
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mb-1.5 font-mono">
                          Optimal Node Sequence ({kccResult.total_distance_km} km):
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                          {kccResult.optimal_path_nodes.map((node, idx) => (
                            <React.Fragment key={idx}>
                              <span className={`px-2 py-1 rounded border font-semibold ${
                                idx === 0
                                  ? 'bg-slate-200 dark:bg-[#1a1a24] text-slate-800 dark:text-zinc-200 border-slate-300 dark:border-zinc-700'
                                  : idx === kccResult.optimal_path_nodes.length - 1
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-600 font-bold'
                                  : 'bg-slate-50 dark:bg-[#121215] text-slate-700 dark:text-zinc-300 border-[#E2E8F0] dark:border-[#27272a]'
                              }`}>
                                {node}
                              </span>
                              {idx < kccResult.optimal_path_nodes.length - 1 && (
                                <ArrowRight className="w-3 h-3 text-emerald-500 shrink-0" />
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      {/* Comparison with Geometric Shortest Physical Path */}
                      {kccResult.physical_shortest_path_nodes && (
                        <div className="border-t border-[#E2E8F0] dark:border-[#27272a] pt-2 text-[11px] font-mono text-slate-600 dark:text-zinc-400 space-y-1">
                          <div>
                            <span className="text-[#0F172A] dark:text-zinc-200 font-semibold">Physical Geometric Shortest Path: </span>
                            <span>{kccResult.physical_shortest_distance_km} km ({kccResult.physical_shortest_path_nodes.join(' ➔ ')})</span>
                          </div>
                          {kccResult.reroute_explanation && (
                            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 text-amber-800 dark:text-amber-200 rounded text-[11px] mt-1">
                              <strong>Engine Reroute Decision: </strong>{kccResult.reroute_explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Candidate Route Evaluation Structured Table */}
                  <div>
                    <span className="text-xs font-bold text-[#0F172A] dark:text-zinc-200 block mb-2 font-mono uppercase tracking-wider">
                      Candidate Corridor Evaluation & Bottleneck Filtering ({kccResult.evaluated_routes?.length || 0} Paths):
                    </span>
                    <div className="overflow-x-auto border border-[#E2E8F0] dark:border-[#27272a] rounded">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-[#121215] border-b border-[#E2E8F0] dark:border-[#27272a] text-slate-600 dark:text-zinc-400 text-[10px] uppercase">
                            <th className="py-2 px-3">Route / Corridor</th>
                            <th className="py-2 px-3">Distance</th>
                            <th className="py-2 px-3">Bottleneck Penalty</th>
                            <th className="py-2 px-3">AutoML ETA</th>
                            <th className="py-2 px-3 text-right">Evaluation Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#27272a] bg-white dark:bg-[#09090b]">
                          {kccResult.evaluated_routes?.map((r, i) => (
                            <tr key={i} className={r.status === 'Optimal' ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : ''}>
                              <td className="py-2.5 px-3 font-semibold text-[#0F172A] dark:text-white">
                                <div>{r.route_name}</div>
                                {r.filter_reason && (
                                  <div className="text-[10px] text-slate-500 dark:text-zinc-500 font-normal mt-0.5">{r.filter_reason}</div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 dark:text-zinc-300">{r.distance_km} km</td>
                              <td className="py-2.5 px-3 text-slate-700 dark:text-zinc-300 font-bold">{r.bottleneck_penalty_weight}</td>
                              <td className="py-2.5 px-3 font-bold text-[#0F172A] dark:text-white">{r.predicted_eta_mins} mins</td>
                              <td className="py-2.5 px-3 text-right">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  r.status === 'Optimal'
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                                    : r.is_unsuitable
                                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700'
                                }`}>
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sandbox / Parameter Explorer */}
            <div className="bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] rounded p-5 space-y-4 shadow-sm">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1 font-bold">
                  Feature Pipeline Telemetry
                </span>
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-white font-mono">Corridor Transit & Feature Vector Explorer</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5">
                  Direct live pipeline inspection of the serialized scikit-learn GradientBoosting ensemble (<code className="text-emerald-600 dark:text-emerald-400 font-mono">backend/ml_bundle/pipeline.joblib</code>).
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                {/* Trip Parameters */}
                <div className="bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] rounded p-4 space-y-3 text-xs font-mono">
                  <span className="font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200 block text-[11px]">
                    Inference Inputs
                  </span>

                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 mb-1">Origin Zone</label>
                    <select
                      value={sandboxOrigin}
                      onChange={(e) => setSandboxOrigin(e.target.value)}
                      className="w-full bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-zinc-100 rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    >
                      {locations.corridors?.map((c) => (
                        <option key={c.zone} value={c.zone}>{c.zone} (~{c.default_dist_km} km)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 mb-1">Campus Gate</label>
                    <select
                      value={sandboxGate}
                      onChange={(e) => setSandboxGate(e.target.value)}
                      className="w-full bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-zinc-100 rounded px-2.5 py-1.5 text-xs focus:outline-none"
                    >
                      {locations.campus_gates?.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 mb-1">Vehicle Factor</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSandboxVehicle('car')}
                        className={`p-1.5 rounded border text-xs font-semibold flex items-center justify-center gap-1 transition-all active:scale-[0.98] cursor-pointer ${
                          sandboxVehicle === 'car'
                            ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                            : 'bg-white dark:bg-[#121215] border-[#E2E8F0] dark:border-[#27272a] text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white'
                        }`}
                      >
                        <Car className="w-3.5 h-3.5" /> Car
                      </button>
                      <button
                        type="button"
                        onClick={() => setSandboxVehicle('two_wheeler')}
                        className={`p-1.5 rounded border text-xs font-semibold flex items-center justify-center gap-1 transition-all active:scale-[0.98] cursor-pointer ${
                          sandboxVehicle === 'two_wheeler'
                            ? 'bg-emerald-500 text-black border-emerald-400 font-bold'
                            : 'bg-white dark:bg-[#121215] border-[#E2E8F0] dark:border-[#27272a] text-slate-600 dark:text-zinc-400 hover:text-[#0F172A] dark:hover:text-white'
                        }`}
                      >
                        <Bike className="w-3.5 h-3.5" /> Two-Wheeler
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-slate-600 dark:text-zinc-400">Hour: {sandboxHour}:00</label>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        {sandboxHour >= 8 && sandboxHour <= 10 ? 'Rush Hour' : 'Standard'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="6"
                      max="21"
                      value={sandboxHour}
                      onChange={(e) => setSandboxHour(e.target.value)}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Inference Output & Vector Breakdown */}
                <div className="lg:col-span-2 space-y-3">
                  {predictLoading || !sandboxPrediction ? (
                    <div className="h-48 bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] rounded flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-emerald-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] rounded p-4 space-y-3 font-mono shadow-inner">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] p-3 rounded">
                          <span className="text-[10px] text-slate-500 dark:text-zinc-500 block uppercase">Predicted ETA</span>
                          <div className="text-2xl font-bold text-[#0F172A] dark:text-white mt-1">
                            {sandboxPrediction.predicted_eta_mins} <span className="text-xs text-slate-500 dark:text-zinc-400 font-normal">mins</span>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] p-3 rounded">
                          <span className="text-[10px] text-slate-500 dark:text-zinc-500 block uppercase">Congestion Index</span>
                          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                            {sandboxPrediction.corridor_congestion_index}
                          </div>
                        </div>

                        <div className="bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] p-3 rounded">
                          <span className="text-[10px] text-slate-500 dark:text-zinc-500 block uppercase">Match Compatibility</span>
                          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                            {sandboxPrediction.route_match_score}%
                          </div>
                        </div>
                      </div>

                      {/* Vector inspection */}
                      <div className="bg-white dark:bg-[#121215] rounded p-3 border border-[#E2E8F0] dark:border-[#27272a] text-xs">
                        <span className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1 text-[11px]">
                          Feature Vector Passed to Model Artifact:
                        </span>
                        <pre className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono bg-slate-50 dark:bg-[#09090b] p-2 rounded overflow-x-auto border border-[#E2E8F0] dark:border-[#27272a]">
                          {JSON.stringify(sandboxPrediction.sanitized_features, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Add New Route Modal */}
      {showNewRouteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121215] border border-[#E2E8F0] dark:border-[#27272a] rounded p-6 max-w-md w-full shadow-2xl font-mono">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#0F172A] dark:text-white mb-3">
              Add Saved Commute Route
            </h3>
            <form onSubmit={handleCreateSavedRoute} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Route Label</label>
                <input
                  type="text"
                  placeholder="e.g. Daily Morning Metro Commute"
                  value={newRouteLabel}
                  onChange={(e) => setNewRouteLabel(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-white rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Pickup Corridor</label>
                <select
                  value={newRouteOrigin}
                  onChange={(e) => setNewRouteOrigin(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-white rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                >
                  {locations.corridors?.map((c) => (
                    <option key={c.zone} value={c.zone}>{c.zone}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Campus Gate</label>
                <select
                  value={newRouteGate}
                  onChange={(e) => setNewRouteGate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-white rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                >
                  {locations.campus_gates?.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1">Preferred Time</label>
                <input
                  type="text"
                  placeholder="08:30 AM"
                  value={newRouteTime}
                  onChange={(e) => setNewRouteTime(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#09090b] border border-[#E2E8F0] dark:border-[#27272a] text-[#0F172A] dark:text-white rounded px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E2E8F0] dark:border-[#27272a]">
                <button
                  type="button"
                  onClick={() => setShowNewRouteModal(false)}
                  className="px-3.5 py-1.5 rounded bg-slate-100 dark:bg-[#1c1c21] text-slate-700 dark:text-zinc-300 font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 border border-[#E2E8F0] dark:border-[#27272a] transition-colors text-xs active:scale-[0.98] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold transition-all text-xs border border-emerald-400 active:scale-[0.98] cursor-pointer"
                >
                  Save Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white dark:bg-[#09090b] border-t border-[#E2E8F0] dark:border-[#27272a] py-3.5 px-4 text-center text-xs font-mono text-slate-500 dark:text-zinc-500 transition-colors">
        CampusRide • KCC Institute Student Commute Network
      </footer>
    </div>
  );
}
