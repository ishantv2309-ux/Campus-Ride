import React, { useState, useEffect, useRef } from 'react';
import AuthView from './AuthView.jsx';
import LiveRouteMap, { getNearestHub } from './LiveRouteMap.jsx';
import { useGeolocation } from './useGeolocation.js';
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
  Zap,
  Trash2,
  X,
  Radar,
  Radio
} from 'lucide-react';

// Relative API base path allows frontend to dynamically target the active host
// (e.g., https://campus-ride-f16x.onrender.com/api in production or Vite proxy in dev)
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

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
  
  // Intelligent Pickup Hub Default (defaults to primary corridor instead of forcing 'All Hubs')
  const [selectedHubFilter, setSelectedHubFilter] = useState('Noida 62');
  const [detectedAutoHub, setDetectedAutoHub] = useState('Noida 62');
  const userManuallyChangedHubRef = useRef(false);
  const [showLiveMap, setShowLiveMap] = useState(true);

  // Live Radar Corridor Scan Simulation State
  const [scanningRouteId, setScanningRouteId] = useState(null);
  const [radarMatchedCorridor, setRadarMatchedCorridor] = useState(null);
  const [isMapPulsing, setIsMapPulsing] = useState(false);

  // Live GPS Geolocation Hook (Prompts on initial dispatch view access)
  const {
    location: userLocation,
    loading: isLocating,
    error: locationError,
    requestLocation,
  } = useGeolocation(true);

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

  // Dashboard Data State - Initialized with localStorage persistence
  const [savedRoutes, setSavedRoutes] = useState(() => {
    try {
      const cached = localStorage.getItem('campusride_saved_routes');
      const deletedIds = JSON.parse(localStorage.getItem('campusride_deleted_route_ids') || '[]');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed.filter(r => !deletedIds.includes(r.id)) : [];
      }
    } catch (e) {}
    return [];
  });
  const [activeRides, setActiveRides] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [myPostedRides, setMyPostedRides] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);

  // Intelligently detect nearest pickup hub from GPS coordinates
  useEffect(() => {
    try {
      if (userLocation?.lat && userLocation?.lng) {
        const nearest = getNearestHub(userLocation.lat, userLocation.lng);
        if (nearest?.name) {
          setDetectedAutoHub(nearest.name);
          if (!userManuallyChangedHubRef.current) {
            setSelectedHubFilter(nearest.name);
          }
        }
      }
    } catch (err) {
      console.warn('Safe GPS detection fallback triggered:', err);
    }
  }, [userLocation]);

  // Fallback to user's primary configured commuter corridor or default corridor (Noida 62) if GPS is unavailable
  useEffect(() => {
    try {
      if (!userLocation && !userManuallyChangedHubRef.current) {
        if (savedRoutes?.length > 0) {
          const primaryOrigin = savedRoutes[0]?.origin_zone;
          if (primaryOrigin) {
            const match = ['Noida 62', 'NH-3', 'Chapraula', 'Lal Kuan'].find(
              h => primaryOrigin.toLowerCase().includes(h.toLowerCase())
            );
            if (match) {
              setDetectedAutoHub(match);
              setSelectedHubFilter(match);
              return;
            }
          }
        }
        // Deterministic default corridor fallback when geolocation is blocked
        setDetectedAutoHub(prev => prev || 'Noida 62');
        setSelectedHubFilter(prev => prev || 'Noida 62');
      }
    } catch (err) {
      console.warn('Safe corridor fallback triggered:', err);
    }
  }, [savedRoutes, userLocation]);

  const handleHubSelect = (hub) => {
    userManuallyChangedHubRef.current = true;
    setSelectedHubFilter(hub);
    setRadarMatchedCorridor(null);
  };

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

  // Student Academic Tag Helper (authentic KCC ITM department/year trust cues)
  const getStudentAcademicTag = (name = '', emailOrId = '') => {
    const branches = [
      'B.Tech CSE',
      'B.Tech IT',
      'B.Tech AI & ML',
      'B.Tech Data Science',
      'B.Tech ECE',
      'B.Tech ME'
    ];
    const years = ['2nd Year', '3rd Year', '4th Year', '1st Year'];
    let hash = 0;
    const seed = (name + emailOrId) || 'KCC ITM';
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
    }
    const b = branches[Math.abs(hash) % branches.length];
    const y = years[Math.abs(hash >> 2) % years.length];
    return `${b} • ${y}`;
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

        // Filter out locally deleted routes to ensure persistence across API reloads
        const deletedIds = JSON.parse(localStorage.getItem('campusride_deleted_route_ids') || '[]');
        const validRoutes = (Array.isArray(routes) ? routes : []).filter(r => !deletedIds.includes(r.id));
        setSavedRoutes(validRoutes);
        try {
          localStorage.setItem('campusride_saved_routes', JSON.stringify(validRoutes));
        } catch (e) {}

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
      if (!res.ok) {
        let errDetail = 'Booking failed';
        try {
          const errData = await res.json();
          errDetail = errData.detail || errData.message || (typeof errData === 'string' ? errData : JSON.stringify(errData));
        } catch {
          const rawText = await res.text();
          if (rawText) errDetail = rawText;
        }
        throw new Error(errDetail);
      }
      const data = await res.json();

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
          origin: postOrigin,
          destination_gate: postGate,
          destination: postGate,
          departure_time: postTime,
          seats_total: parseInt(postSeats) || 1,
          seats_available: parseInt(postSeats) || 1,
          vehicle_type: postVehicle,
          notes: postNotes,
          pickup_notes: postNotes
        })
      });

      if (!res.ok) {
        let errDetail = 'Failed to post ride';
        try {
          const errData = await res.json();
          errDetail = errData.detail || errData.message || (typeof errData === 'string' ? errData : JSON.stringify(errData));
        } catch {
          const rawText = await res.text();
          if (rawText) errDetail = rawText;
        }
        throw new Error(errDetail);
      }

      const data = await res.json();
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
      // Update local storage cache
      try {
        const deletedIds = JSON.parse(localStorage.getItem('campusride_deleted_route_ids') || '[]');
        const updatedDeleted = deletedIds.filter(id => id !== data.id);
        localStorage.setItem('campusride_deleted_route_ids', JSON.stringify(updatedDeleted));
      } catch (e) {}
      refreshDashboard();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  // 1-Click Route Autofill & Live Radar Corridor Scan
  const handleUseSavedRoute = (route) => {
    if (scanningRouteId) return;

    setScanningRouteId(route.id);
    setIsMapPulsing(true);
    setShowLiveMap(true);
    setActiveTab('rider');

    // Immediate scanning interactive feedback
    notify(`Scanning Corridor Radar for ${route.origin_zone}...`, 'info');

    // 1.8-second simulated live radar sweep
    setTimeout(() => {
      // 1. Match route corridor to closest hub filter
      const standardHubs = ['Noida 62', 'NH-3', 'Chapraula', 'Lal Kuan'];
      const matchedHub =
        standardHubs.find((h) =>
          (route.origin_zone || '').toLowerCase().includes(h.toLowerCase())
        ) || 'Noida 62';

      // 2. Filter available rides & highlight matching corridor
      userManuallyChangedHubRef.current = true;
      setSelectedHubFilter(matchedHub);
      setRadarMatchedCorridor(matchedHub);

      // 3. Autofill routine parameters
      setPostOrigin(route.origin_zone);
      setPostGate(route.campus_gate);
      setPostTime(route.preferred_time);
      setSandboxOrigin(route.origin_zone);
      setSandboxGate(route.campus_gate);

      // 4. Reset scanning state
      setScanningRouteId(null);
      setIsMapPulsing(false);

      // 5. Success confirmation toast
      notify('Matched with verified student commuter on this corridor!', 'success');

      // Scroll to available rides section smoothly
      const ridesSection = document.getElementById('available-rides-section');
      if (ridesSection) {
        ridesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // Auto-clear highlight badge after 8 seconds
      setTimeout(() => {
        setRadarMatchedCorridor((curr) => (curr === matchedHub ? null : curr));
      }, 8000);
    }, 1800);
  };

  // Delete / Remove Saved Corridor Item
  const handleDeleteSavedRoute = async (routeId, e) => {
    if (e) e.stopPropagation();

    // 1. Remove from local component state immediately
    const updatedRoutes = savedRoutes.filter((r) => r.id !== routeId);
    setSavedRoutes(updatedRoutes);

    // 2. Persist in localStorage and update deleted tombstones
    try {
      localStorage.setItem('campusride_saved_routes', JSON.stringify(updatedRoutes));
      const deletedIds = JSON.parse(localStorage.getItem('campusride_deleted_route_ids') || '[]');
      if (!deletedIds.includes(routeId)) {
        deletedIds.push(routeId);
        localStorage.setItem('campusride_deleted_route_ids', JSON.stringify(deletedIds));
      }
    } catch (err) {
      console.error('Error saving deleted route to localStorage:', err);
    }

    notify('Saved commute corridor removed.');

    // 3. Sync deletion to backend if authenticated
    if (token) {
      try {
        await fetch(`${API_BASE}/routes/saved/${routeId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (err) {
        console.warn('Backend route deletion sync note:', err);
      }
    }
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
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#09090B] text-[#0F172A] dark:text-[#FAFAFA] flex flex-col font-sans w-full overflow-x-hidden">
      {/* Tactical Toast Notification */}
      {notification && (
        <div className={`fixed top-3 left-3 right-3 sm:left-auto sm:right-4 z-[10050] max-w-sm sm:max-w-md px-3.5 sm:px-4 py-2.5 rounded border flex items-center gap-2.5 text-xs font-mono shadow-xl transition-all ${
          notification.type === 'error'
            ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-[#1c1012] dark:text-rose-300 dark:border-rose-800/80'
            : notification.type === 'info'
            ? 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-[#0f172a] dark:text-sky-300 dark:border-sky-800/80'
            : 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-[#062016] dark:text-emerald-300 dark:border-emerald-700/80'
        }`}>
          {notification.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />}
          <span className="truncate">{notification.msg}</span>
        </div>
      )}

      {/* Top Header: Campus Navigation & Student Trust Console */}
      <header className="bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800/80 sticky top-0 z-40 transition-colors w-full">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-4">
          <div className="flex items-center justify-between md:justify-start gap-2.5 sm:gap-3 min-w-0 w-full md:w-auto">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 shrink-0 bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-xs rounded-xl shadow-sm">
                CR
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white font-sans">
                    CAMPUS<span className="text-emerald-500">RIDE</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
                    <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                    KCC Verified
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block truncate max-w-[200px] xs:max-w-[260px] sm:max-w-none">
                  KCC Institute of Technology & Management • Knowledge Park II
                </span>
              </div>
            </div>
          </div>

          {/* User Status Bar & Controls */}
          <div className="flex items-center justify-between md:justify-end gap-1.5 sm:gap-2.5 w-full md:w-auto shrink-0 pt-1 md:pt-0 border-t border-slate-100 dark:border-zinc-800/50 md:border-t-0">
            {/* Tactile Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold uppercase tracking-wider bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-zinc-200 rounded-full active:scale-[0.98] transition-all cursor-pointer shadow-sm shrink-0"
            >
              {theme === 'dark' ? (
                <>
                  <Sun key="sun-icon" className="w-3.5 h-3.5 text-amber-400 theme-toggle-icon shrink-0" />
                  <span className="text-[11px] font-mono">LIGHT</span>
                </>
              ) : (
                <>
                  <Moon key="moon-icon" className="w-3.5 h-3.5 text-slate-700 theme-toggle-icon shrink-0" />
                  <span className="text-[11px] font-mono">DARK</span>
                </>
              )}
            </button>

            {/* Student Profile Identity Badge with Academic Trust Cue */}
            <div className="flex-1 md:flex-none flex items-center gap-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 px-2.5 sm:px-3 py-1 min-h-[38px] rounded-full text-xs min-w-0 max-w-[180px] xs:max-w-[220px] sm:max-w-[260px] shadow-sm">
              <div className="w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold text-[11px] shrink-0">
                {currentUser.full_name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 truncate">
                <span className="font-semibold text-slate-900 dark:text-white block truncate leading-tight">
                  {currentUser.full_name}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 block truncate leading-tight mt-0.5">
                  {getStudentAcademicTag(currentUser.full_name, currentUser.college_email)}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-slate-200/80 dark:border-zinc-800 hover:border-rose-300 dark:hover:border-rose-700 text-slate-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-300 active:scale-[0.98] transition-all cursor-pointer shadow-sm shrink-0"
            >
              <LogOut className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      {/* Sub-Header & Sleek Pill-Segmented Mode Navigation */}
      <div className="bg-slate-50/70 dark:bg-[#09090b]/70 backdrop-blur-sm border-b border-slate-200/80 dark:border-zinc-800/80 py-2 sm:py-2.5 px-3 sm:px-6 transition-colors w-full">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2">
          {/* Mode Switcher: Sleek Pill-Segmented Control */}
          <div className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap scrollbar-none py-0.5">
            <div className="inline-flex w-full md:w-auto p-1 bg-slate-100/90 dark:bg-zinc-900/90 rounded-full border border-slate-200/80 dark:border-zinc-800 shadow-inner whitespace-nowrap">
              <button
                type="button"
                onClick={() => setActiveTab('rider')}
                className={`flex-1 md:flex-none justify-center px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-[0.98] cursor-pointer ${
                  activeTab === 'rider'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-zinc-700'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Rider Dispatch</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('driver')}
                className={`flex-1 md:flex-none justify-center px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-[0.98] cursor-pointer ${
                  activeTab === 'driver'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-zinc-700'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Car className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Driver Mode</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('matcher')}
                className={`flex-1 md:flex-none justify-center px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-[0.98] cursor-pointer ${
                  activeTab === 'matcher'
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/20'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>AutoML Route Engine</span>
              </button>
            </div>
          </div>

          <div className="shrink-0 flex items-center justify-end gap-2">
            <button
              onClick={refreshDashboard}
              title="Refresh Live State"
              aria-label="Refresh Live State"
              className="p-2 sm:p-2 rounded-full min-h-[36px] min-w-[36px] flex items-center justify-center bg-white/80 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] transition-all cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingFeed ? 'animate-spin text-emerald-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 flex-1 w-full space-y-4 sm:space-y-6">

        {/* 1. SAVED ROUTES SECTION */}
        <div className="bg-white/85 dark:bg-[#121215]/85 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 rounded-2xl p-5 sm:p-6 transition-all shadow-sm w-full">
          <div className="flex justify-between items-center mb-3.5">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Saved Commute Corridors</h2>
              <span className="text-[11px] bg-slate-100 dark:bg-zinc-800/90 border border-slate-200 dark:border-zinc-700/80 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded-full font-medium">
                1-Click Autofill
              </span>
            </div>
            <button
              onClick={() => setShowNewRouteModal(true)}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Add Corridor
            </button>
          </div>

          {savedRoutes.length === 0 ? (
            <div className="text-center py-6 text-slate-500 dark:text-zinc-400 text-xs bg-slate-50/60 dark:bg-zinc-900/40 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
              No saved routes yet. Add your daily home commute corridor for 1-click autofill.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {savedRoutes.map((route) => (
                <div
                  key={route.id}
                  className="bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 p-3.5 rounded-xl flex flex-col justify-between transition-all"
                >
                  <div>
                    <div className="font-semibold text-xs text-slate-900 dark:text-white mb-1.5 flex items-center justify-between gap-2">
                      <span className="truncate">{route.route_label}</span>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono font-bold shrink-0">{route.preferred_time}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1 truncate mb-2">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className="font-medium text-slate-700 dark:text-zinc-300 truncate">{route.origin_zone}</span>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-400 dark:text-zinc-600" />
                      <span className="text-slate-600 dark:text-zinc-400 truncate">{route.campus_gate}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800/80">
                    <button
                      type="button"
                      disabled={scanningRouteId === route.id}
                      onClick={() => handleUseSavedRoute(route)}
                      className={`flex-1 text-xs font-semibold py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 border active:scale-[0.98] min-w-0 ${
                        scanningRouteId === route.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-600 animate-pulse cursor-wait'
                          : 'bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-zinc-700 shadow-sm cursor-pointer'
                      }`}
                    >
                      {scanningRouteId === route.id ? (
                        <>
                          <Radar className="w-3.5 h-3.5 text-emerald-500 animate-spin shrink-0" />
                          <span className="truncate">Scanning Corridor Radar...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span className="truncate">Apply Route</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={scanningRouteId === route.id}
                      onClick={(e) => handleDeleteSavedRoute(route.id, e)}
                      title="Remove saved corridor"
                      aria-label="Remove saved corridor"
                      className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-zinc-700 hover:border-rose-300 dark:hover:border-rose-800 text-xs font-medium transition-all flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer disabled:opacity-50 shadow-sm shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. MODE CONTENT: RIDER VIEW */}
        {activeTab === 'rider' && (
          <div id="available-rides-section" className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
            {/* Live Ride Feed (2 cols on lg, stacked on md/sm) */}
            <div className="lg:col-span-2 space-y-4 w-full">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-500 shrink-0" /> Available Rides to Campus
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Verified student driver carpools bound for KCC Institute of Technology & Management</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLiveMap(!showLiveMap)}
                    className="text-xs bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-800 hover:border-emerald-500 px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-[0.98] shadow-sm"
                  >
                    <Compass className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{showLiveMap ? 'Hide Radar' : 'Live Radar'}</span>
                  </button>
                  <span className="text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 px-3 py-1 rounded-full font-semibold whitespace-nowrap shadow-sm">
                    {filteredRides.length} active
                  </span>
                </div>
              </div>

              {/* Live Interactive Corridor Radar & Geolocation Map */}
              {showLiveMap && (
                <div className={`w-full relative z-0 transition-all duration-300 rounded-2xl overflow-hidden ${
                  isMapPulsing ? 'ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/25 animate-pulse' : ''
                }`}>
                  <LiveRouteMap
                    theme={theme}
                    activeHubFilter={selectedHubFilter}
                    onSelectHub={(hub) => handleHubSelect(hub)}
                    userLocation={userLocation}
                    isLocating={isLocating}
                    locationError={locationError}
                    onRequestLocation={requestLocation}
                  />
                </div>
              )}

              {/* Hub Quick-Filter Bar - Horizontally scrollable on mobile with sleek pill styling */}
              <div className="bg-white/80 dark:bg-[#121215]/80 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 p-2 rounded-2xl flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none text-xs shadow-sm w-full min-w-0">
                <span className="text-slate-500 dark:text-zinc-400 text-[11px] font-medium uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1 pl-1">
                  <Filter className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Hubs:
                </span>
                {['All Hubs', 'Noida 62', 'NH-3', 'Chapraula', 'Lal Kuan'].map((hub) => {
                  const isNearest = detectedAutoHub === hub && hub !== 'All Hubs';
                  return (
                    <button
                      key={hub}
                      type="button"
                      onClick={() => handleHubSelect(hub)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 ${
                        selectedHubFilter === hub
                          ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm shadow-emerald-500/20'
                          : 'bg-slate-100 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200/60 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>{hub}</span>
                      {isNearest && (
                        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded-full font-bold ${
                          selectedHubFilter === hub
                            ? 'bg-black/20 text-slate-950'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-300/50 dark:border-emerald-700/50'
                        }`}>
                          Nearest
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {filteredRides.length === 0 ? (
                <div className="text-center py-12 bg-white/85 dark:bg-[#121215]/85 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 shadow-sm p-6">
                  <Car className="w-8 h-8 text-slate-400 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="text-slate-800 dark:text-zinc-200 text-sm font-semibold">No active student rides found for "{selectedHubFilter}".</p>
                  <p className="text-slate-500 dark:text-zinc-400 text-xs mt-1">Select "All Hubs" or switch to Driver Mode tab to publish seats.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredRides.map((ride) => {
                    const waypoints = getCorridorWaypoints(ride.origin_zone);
                    const isLalKuan = (ride.origin_zone || '').toLowerCase().includes('lal kuan');
                    const isRadarMatched = radarMatchedCorridor && (ride.origin_zone || '').toLowerCase().includes(radarMatchedCorridor.toLowerCase());

                    return (
                      <div
                        key={ride.id}
                        className={`bg-white/85 dark:bg-[#121215]/85 backdrop-blur-md border rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-3.5 transition-all shadow-sm hover:shadow-md w-full ${
                          isRadarMatched
                            ? 'border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/50 shadow-md shadow-emerald-500/10'
                            : 'border-slate-200/80 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        {/* Driver & Status Header with Academic Trust Cues */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-100 dark:border-zinc-800/80 pb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center font-bold text-sm text-emerald-600 dark:text-emerald-400 shrink-0 shadow-sm">
                              {ride.driver.full_name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-sm text-slate-900 dark:text-white truncate max-w-[140px] xs:max-w-[200px] sm:max-w-none">{ride.driver.full_name}</span>
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0">
                                  <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                                  Verified @college.edu.in
                                </span>
                                {isRadarMatched && (
                                  <span className="text-[10px] bg-emerald-500 text-slate-950 font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1 shadow-sm animate-pulse shrink-0">
                                    <Radio className="w-2.5 h-2.5 shrink-0" />
                                    Matched Corridor
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                                <span className="truncate">{getStudentAcademicTag(ride.driver.full_name, ride.driver.college_email || ride.id)}</span>
                                <span className="text-slate-300 dark:text-zinc-700">•</span>
                                <span>{ride.vehicle_type === 'two_wheeler' ? 'Motorcycle' : 'Car'}</span>
                                <span className="text-slate-300 dark:text-zinc-700">•</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">KCC Commuter</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-left sm:text-right shrink-0 flex items-baseline sm:block gap-1.5">
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider block font-medium">Available</span>
                            <span className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
                              {ride.seats_available} <span className="text-xs text-slate-400 dark:text-zinc-500 font-normal">/ {ride.seats_total} seats</span>
                            </span>
                          </div>
                        </div>

                        {/* Interactive Corridor Visualizer (Node-and-line Timeline - Responsive wrapping layout) */}
                        <div className="bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/70 dark:border-zinc-800/70 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                            <span className="uppercase tracking-wider flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-semibold text-[10px]">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                              Route Stops
                            </span>
                            {isLalKuan && (
                              <span className="text-amber-700 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider whitespace-nowrap">
                                ⚡ Fastest Route
                              </span>
                            )}
                          </div>

                          {/* Node & Line Sequence: Wrapping flex layout on narrow screens, horizontal flow on wider */}
                          <div className="flex flex-wrap items-center gap-y-2 gap-x-1 sm:gap-x-1.5 py-1 text-xs">
                            {waypoints.map((node, idx) => (
                              <React.Fragment key={idx}>
                                <span className={`px-2.5 py-0.5 rounded-lg border whitespace-nowrap text-[11px] font-medium ${
                                  idx === 0
                                    ? 'bg-slate-200/80 dark:bg-zinc-800 text-slate-900 dark:text-zinc-200 border-slate-300 dark:border-zinc-700 font-semibold'
                                    : idx === waypoints.length - 1
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-600 font-bold'
                                    : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-800'
                                }`}>
                                  {node}
                                </span>
                                {idx < waypoints.length - 1 && (
                                  <div className="flex items-center px-0.5 text-slate-400 dark:text-zinc-600 shrink-0">
                                    <span className="h-[1px] w-1.5 sm:w-2.5 bg-slate-300 dark:bg-zinc-700"></span>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                    <span className="h-[1px] w-1.5 sm:w-2.5 bg-slate-300 dark:bg-zinc-700"></span>
                                  </div>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        {/* Telemetry Metrics Badges & Action Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px]">
                            <span className="bg-slate-100/80 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 px-2.5 py-1 rounded-lg text-slate-700 dark:text-zinc-300 flex items-center gap-1 font-mono whitespace-nowrap">
                              <Clock className="w-3 h-3 text-slate-400 dark:text-zinc-400 shrink-0" /> Dep: {ride.departure_time}
                            </span>
                            <span className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 px-2.5 py-1 rounded-lg text-emerald-700 dark:text-emerald-300 flex items-center gap-1 font-mono font-semibold whitespace-nowrap">
                              <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" /> ETA: {ride.predicted_eta_mins}m
                            </span>
                            <span className="bg-slate-100/80 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 px-2.5 py-1 rounded-lg text-slate-700 dark:text-zinc-300 flex items-center gap-1 font-mono whitespace-nowrap">
                              <Navigation className="w-3 h-3 text-slate-400 dark:text-zinc-400 shrink-0" /> {ride.distance_km} km
                            </span>
                            <span className="bg-slate-100/80 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 px-2.5 py-1 rounded-lg text-slate-700 dark:text-zinc-300 whitespace-nowrap font-medium text-[10px]">
                              {isLalKuan ? (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">Traffic: Lal Kuan Bypassed</span>
                              ) : (
                                <span>Traffic: Clear</span>
                              )}
                            </span>
                          </div>

                          <button
                            onClick={() => handleBookSeat(ride.id)}
                            disabled={ride.seats_available <= 0 || ride.driver.id === currentUser.id}
                            className="w-full sm:w-auto min-h-[44px] flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm shadow-emerald-500/20 disabled:opacity-40 disabled:bg-slate-100 dark:disabled:bg-zinc-800 disabled:text-slate-400 dark:disabled:text-zinc-500 disabled:border-slate-300 dark:disabled:border-zinc-700 active:scale-[0.98] cursor-pointer whitespace-nowrap"
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

            {/* Sidebar: Confirmed Bookings (Stacks cleanly below on mobile/tablet) */}
            <div className="space-y-4 w-full">
              <div className="bg-white/85 dark:bg-[#121215]/85 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 shadow-sm w-full">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3.5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> Confirmed Bookings
                </h3>

                {myBookings.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-zinc-400 py-4 text-center">No active bookings. Select a ride to confirm your seat.</p>
                ) : (
                  <div className="space-y-2.5">
                    {myBookings.map((b) => (
                      <div key={b.booking_id} className="bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 p-3.5 rounded-xl text-xs">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Confirmed
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">{b.ride.departure_time}</span>
                        </div>
                        <div className="text-slate-900 dark:text-white font-medium truncate mb-1">
                          {b.ride.origin_zone} ➔ {b.ride.destination_gate}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mt-2 border-t border-slate-200/60 dark:border-zinc-800/60 pt-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                          <span className="truncate">Driver: {b.ride.driver.full_name} ({b.ride.driver.phone || 'Campus Commuter'})</span>
                        </div>
                      </div>
                    ))}

                    {/* Passenger Live Tracking Map for Active Bookings (Desktop/Tablet multi-instance; hidden on mobile to enforce single map view) */}
                    <div className="hidden md:block relative z-0 mt-4 pt-3 border-t border-slate-200/60 dark:border-zinc-800/60 space-y-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block">
                        Live Passenger Route Tracking
                      </span>
                      <LiveRouteMap
                        compact={true}
                        theme={theme}
                        activeHubFilter={myBookings[0]?.ride?.origin_zone || 'All Hubs'}
                        userLocation={userLocation}
                        isLocating={isLocating}
                        locationError={locationError}
                        onRequestLocation={requestLocation}
                      />
                    </div>

                    {/* Mobile fallback indicator connecting user to primary interactive map */}
                    <div className="md:hidden mt-3 pt-2 border-t border-slate-200/60 dark:border-zinc-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1.5 truncate">
                        <Compass className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Live GPS route active in main radar</span>
                      </span>
                      {!showLiveMap && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowLiveMap(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="text-emerald-600 dark:text-emerald-400 font-semibold underline shrink-0 cursor-pointer text-xs"
                        >
                          Show Radar
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. MODE CONTENT: DRIVER VIEW */}
        {activeTab === 'driver' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
            {/* Post Ride Card (1 col on lg, stacked on md/sm) */}
            <div className="bg-white/85 dark:bg-[#121215]/85 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm w-full">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Car className="w-4 h-4 text-emerald-500 shrink-0" /> Post Empty Seats
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Offer seats along verified campus commuter corridors</p>
              </div>

              <form onSubmit={handlePostRide} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">Pickup Corridor (Origin)</label>
                  <select
                    value={postOrigin}
                    onChange={(e) => setPostOrigin(e.target.value)}
                    className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    {locations.corridors?.map((c) => (
                      <option key={c.zone} value={c.zone}>
                        {c.zone} (~{c.default_dist_km} km)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">Campus Gate Destination</label>
                  <select
                    value={postGate}
                    onChange={(e) => setPostGate(e.target.value)}
                    className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    {locations.campus_gates?.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">Departure Time</label>
                    <input
                      type="text"
                      placeholder="08:30 AM"
                      value={postTime}
                      onChange={(e) => setPostTime(e.target.value)}
                      className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">Seats Available</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={postSeats}
                      onChange={(e) => setPostSeats(e.target.value)}
                      className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">Vehicle Type</label>
                  <select
                    value={postVehicle}
                    onChange={(e) => setPostVehicle(e.target.value)}
                    className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    <option value="car">Car (Sedan / Hatchback / SUV)</option>
                    <option value="two_wheeler">Two-Wheeler (Motorcycle / Scooty)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">Pickup Notes / Landmark</label>
                  <input
                    type="text"
                    placeholder="e.g. Near Metro Gate 2, Leaving sharp."
                    value={postNotes}
                    onChange={(e) => setPostNotes(e.target.value)}
                    className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={postLoading}
                  className="w-full min-h-[44px] bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm shadow-emerald-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50 mt-2 text-xs active:scale-[0.98] cursor-pointer"
                >
                  {postLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><PlusCircle className="w-3.5 h-3.5" /> Publish Ride</>}
                </button>
              </form>
            </div>

            {/* My Posted Rides & Passenger Sync (2 cols on lg, stacked on md/sm) */}
            <div className="lg:col-span-2 space-y-4 w-full">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">My Posted Rides & Passengers</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Real-time synchronization of confirmed student bookings</p>
                </div>
              </div>

              {myPostedRides.length === 0 ? (
                <div className="text-center py-12 bg-white/85 dark:bg-[#121215]/85 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-zinc-800/80 text-xs text-slate-500 dark:text-zinc-400 shadow-sm p-6">
                  You haven't posted any rides yet. Use the form on the left to offer seats.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {myPostedRides.map((ride) => (
                    <div key={ride.id} className="bg-white/85 dark:bg-[#121215]/85 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-3.5 shadow-sm hover:shadow-md transition-all w-full">
                      <div className="flex flex-wrap justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                            <span>{ride.origin_zone}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{ride.destination_gate}</span>
                          </div>
                          <span className="text-xs text-slate-500 dark:text-zinc-400 block mt-0.5 font-mono">
                            Departure: {ride.departure_time} • AutoML ETA: {ride.predicted_eta_mins} mins
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold font-mono whitespace-nowrap bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">
                            {ride.seats_available} of {ride.seats_total} seats free
                          </span>
                        </div>
                      </div>

                      {/* Passenger Bookings Table */}
                      <div className="bg-slate-50/80 dark:bg-zinc-900/60 rounded-xl p-3.5 border border-slate-200/70 dark:border-zinc-800/70 overflow-x-auto">
                        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-2">
                          Booked Passengers ({ride.passenger_bookings?.length || 0}):
                        </span>
                        {(!ride.passenger_bookings || ride.passenger_bookings.length === 0) ? (
                          <span className="text-xs text-slate-500 dark:text-zinc-500 italic">No students booked yet. Seats open in feed.</span>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs min-w-[280px]">
                              <thead>
                                <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 text-[10px] uppercase font-medium">
                                  <th className="pb-2">Passenger Name</th>
                                  <th className="pb-2">College Email</th>
                                  <th className="pb-2 text-right">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {ride.passenger_bookings.map((p) => (
                                  <tr key={p.booking_id}>
                                    <td className="py-2 font-semibold text-slate-900 dark:text-white truncate max-w-[120px]">{p.rider_name}</td>
                                    <td className="py-2 text-slate-500 dark:text-zinc-400 font-mono text-[11px] truncate max-w-[140px]">{p.rider_email}</td>
                                    <td className="py-2 text-right">
                                      <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap">
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
            <div className="bg-white/85 dark:bg-[#121215]/85 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-5 shadow-sm">
              <div className="flex flex-wrap justify-between items-start gap-3 border-b border-slate-100 dark:border-zinc-800/80 pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-1.5 border border-emerald-200 dark:border-emerald-800">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    AutoML Hybrid Routing Engine
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Target Destination:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">KCC Institute of Technology and Management</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Evaluates dynamic pickup points, applies Lal Kuan traffic bottleneck weights vs Expressway bypasses, and executes Dijkstra graph search.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-medium">Model Artifact:</span>
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full">
                    AutoML/kcc_route_bundle
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">Pickup Location</label>
                  <select
                    value={kccPickup}
                    onChange={(e) => setKccPickup(e.target.value)}
                    className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">Ride Departure Time</label>
                  <input
                    type="text"
                    value={kccTime}
                    onChange={(e) => setKccTime(e.target.value)}
                    placeholder="08:30 AM"
                    className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">Vehicle Type</label>
                  <select
                    value={kccVehicle}
                    onChange={(e) => setKccVehicle(e.target.value)}
                    className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
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
                    className="w-full min-h-[42px] bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-2 px-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-500/20 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
                  >
                    {kccLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <><Compass className="w-3.5 h-3.5" /> Predict Optimal Route</>}
                  </button>
                </div>
              </div>

              {/* KCC Prediction Result Display */}
              {kccResult && (
                <div className="bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl p-4 sm:p-5 space-y-4 shadow-inner">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 block uppercase tracking-wider font-semibold">Optimal Recommendation</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 block mt-1 leading-snug">
                        {kccResult.optimal_route_recommendation}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-zinc-400 mt-1 block">
                        {kccResult.optimal_route_description}
                      </span>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 block uppercase tracking-wider font-semibold">Predicted Door-to-Gate ETA</span>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono mt-1">
                        {kccResult.predicted_eta_mins} <span className="text-xs text-slate-400 dark:text-zinc-500 font-normal">mins</span>
                      </div>
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block mt-1 font-medium">
                        Target: KCC Institute Campus Gate
                      </span>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 block uppercase tracking-wider font-semibold">AutoML Confidence Score</span>
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                        {kccResult.confidence_score}%
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-1">
                        Model: VotingRegressor (GBR + RF)
                      </span>
                    </div>
                  </div>

                  {/* Graph-Based Pathfinding & Rerouting Node Visualization */}
                  {kccResult.optimal_path_nodes && (
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-3 shadow-sm">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Compass className="w-3.5 h-3.5 text-emerald-500" />
                          Hybrid Pathfinding Node Sequence (Dijkstra + AutoML Congestion Weights)
                        </span>
                        {kccResult.rerouted_around_bottlenecks ? (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 px-2.5 py-0.5 rounded-full font-bold">
                            ⚡ Fastest Route (Bypassed)
                          </span>
                        ) : (
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 px-2.5 py-0.5 rounded-full font-bold">
                            ✓ Direct Route
                          </span>
                        )}
                      </div>

                      {/* Optimal Sequence */}
                      <div>
                        <span className="text-xs text-slate-500 dark:text-zinc-400 block mb-1.5">
                          Optimal Node Sequence (<span className="font-mono font-semibold">{kccResult.total_distance_km} km</span>):
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          {kccResult.optimal_path_nodes.map((node, idx) => (
                            <React.Fragment key={idx}>
                              <span className={`px-2.5 py-1 rounded-lg border font-medium ${
                                idx === 0
                                  ? 'bg-slate-200/80 dark:bg-zinc-800 text-slate-900 dark:text-zinc-200 border-slate-300 dark:border-zinc-700 font-semibold'
                                  : idx === kccResult.optimal_path_nodes.length - 1
                                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-600 font-bold'
                                  : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
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
                        <div className="border-t border-slate-100 dark:border-zinc-800 pt-2.5 text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                          <div>
                            <span className="text-slate-900 dark:text-zinc-200 font-semibold">Physical Geometric Shortest Path: </span>
                            <span className="font-mono">{kccResult.physical_shortest_distance_km} km</span> ({kccResult.physical_shortest_path_nodes.join(' ➔ ')})
                          </div>
                          {kccResult.reroute_explanation && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 rounded-xl text-xs mt-1 leading-relaxed">
                              <strong>Engine Reroute Decision: </strong>{kccResult.reroute_explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Candidate Route Evaluation Structured Table */}
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-zinc-200 block mb-2 uppercase tracking-wider">
                      Candidate Corridor Evaluation & Bottleneck Filtering ({kccResult.evaluated_routes?.length || 0} Paths):
                    </span>
                    <div className="overflow-x-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 text-[10px] uppercase font-medium">
                            <th className="py-2.5 px-3.5">Route / Corridor</th>
                            <th className="py-2.5 px-3.5">Distance</th>
                            <th className="py-2.5 px-3.5">Bottleneck Penalty</th>
                            <th className="py-2.5 px-3.5">AutoML ETA</th>
                            <th className="py-2.5 px-3.5 text-right">Evaluation Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
                          {kccResult.evaluated_routes?.map((r, i) => (
                            <tr key={i} className={r.status === 'Optimal' ? 'bg-emerald-50/70 dark:bg-emerald-950/20' : ''}>
                              <td className="py-2.5 px-3.5 font-semibold text-slate-900 dark:text-white">
                                <div>{r.route_name}</div>
                                {r.filter_reason && (
                                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal mt-0.5">{r.filter_reason}</div>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-700 dark:text-zinc-300 font-mono">{r.distance_km} km</td>
                              <td className="py-2.5 px-3.5 text-slate-700 dark:text-zinc-300 font-bold font-mono">{r.bottleneck_penalty_weight}</td>
                              <td className="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white font-mono">{r.predicted_eta_mins} mins</td>
                              <td className="py-2.5 px-3.5 text-right">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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
            <div className="bg-white/85 dark:bg-[#121215]/85 backdrop-blur-md border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1 font-bold">
                  Feature Pipeline Telemetry
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Corridor Transit & Feature Vector Explorer</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Direct live pipeline inspection of the serialized scikit-learn GradientBoosting ensemble (<code className="text-emerald-600 dark:text-emerald-400 font-mono">backend/ml_bundle/pipeline.joblib</code>).
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
                {/* Trip Parameters */}
                <div className="bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl p-4 space-y-3 text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200 block text-[11px]">
                    Inference Inputs
                  </span>

                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 mb-1.5 font-semibold">Origin Zone</label>
                    <select
                      value={sandboxOrigin}
                      onChange={(e) => setSandboxOrigin(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {locations.corridors?.map((c) => (
                        <option key={c.zone} value={c.zone}>{c.zone} (~{c.default_dist_km} km)</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 mb-1.5 font-semibold">Campus Gate</label>
                    <select
                      value={sandboxGate}
                      onChange={(e) => setSandboxGate(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {locations.campus_gates?.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-zinc-400 mb-1.5 font-semibold">Vehicle Factor</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSandboxVehicle('car')}
                        className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer ${
                          sandboxVehicle === 'car'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-sm'
                            : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Car className="w-3.5 h-3.5" /> Car
                      </button>
                      <button
                        type="button"
                        onClick={() => setSandboxVehicle('two_wheeler')}
                        className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer ${
                          sandboxVehicle === 'two_wheeler'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-sm'
                            : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Bike className="w-3.5 h-3.5" /> Two-Wheeler
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-slate-600 dark:text-zinc-400 font-semibold font-mono">Hour: {sandboxHour}:00</label>
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
                    <div className="h-48 bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-emerald-500 animate-spin" />
                    </div>
                  ) : (
                    <div className="bg-slate-50/80 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-5 space-y-3.5 shadow-inner">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3.5 rounded-xl shadow-sm">
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 block uppercase font-semibold">Predicted ETA</span>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
                            {sandboxPrediction.predicted_eta_mins} <span className="text-xs text-slate-400 dark:text-zinc-500 font-normal">mins</span>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3.5 rounded-xl shadow-sm">
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 block uppercase font-semibold">Congestion Index</span>
                          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                            {sandboxPrediction.corridor_congestion_index}
                          </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3.5 rounded-xl shadow-sm">
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 block uppercase font-semibold">Match Compatibility</span>
                          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                            {sandboxPrediction.route_match_score}%
                          </div>
                        </div>
                      </div>

                      {/* Vector inspection */}
                      <div className="bg-white dark:bg-zinc-900 rounded-xl p-3.5 border border-slate-200 dark:border-zinc-800 text-xs shadow-sm">
                        <span className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1.5 text-xs">
                          Feature Vector Passed to Model Artifact:
                        </span>
                        <pre className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono bg-slate-50 dark:bg-zinc-950 p-3 rounded-lg overflow-x-auto border border-slate-200/80 dark:border-zinc-800/80">
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
        <div className="fixed inset-0 z-[9999] bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative z-[10000] bg-white/95 dark:bg-[#121215]/95 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-6 sm:p-7 w-[95vw] max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Add Saved Commute Route
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Save your daily home-to-campus corridor for instant 1-click radar scanning.
            </p>
            <form onSubmit={handleCreateSavedRoute} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">Route Label</label>
                <input
                  type="text"
                  placeholder="e.g. Daily Morning Metro Commute"
                  value={newRouteLabel}
                  onChange={(e) => setNewRouteLabel(e.target.value)}
                  className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">Pickup Corridor</label>
                <select
                  value={newRouteOrigin}
                  onChange={(e) => setNewRouteOrigin(e.target.value)}
                  className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  {locations.corridors?.map((c) => (
                    <option key={c.zone} value={c.zone}>{c.zone}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">Campus Gate</label>
                <select
                  value={newRouteGate}
                  onChange={(e) => setNewRouteGate(e.target.value)}
                  className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                >
                  {locations.campus_gates?.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 dark:text-zinc-300 font-semibold mb-1.5">Preferred Time</label>
                <input
                  type="text"
                  placeholder="08:30 AM"
                  value={newRouteTime}
                  onChange={(e) => setNewRouteTime(e.target.value)}
                  className="w-full min-h-[42px] bg-slate-50/80 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setShowNewRouteModal(false)}
                  className="w-full sm:w-auto min-h-[42px] px-5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 transition-all text-xs active:scale-[0.98] cursor-pointer flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto min-h-[42px] px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold transition-all text-xs shadow-sm shadow-emerald-500/20 active:scale-[0.98] cursor-pointer flex items-center justify-center"
                >
                  Save Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-md border-t border-slate-200/80 dark:border-zinc-800/80 py-4 px-4 text-center text-xs text-slate-500 dark:text-zinc-400 transition-colors">
        CampusRide • KCC Institute of Technology and Management Student Commute Network
      </footer>
    </div>
  );
}
