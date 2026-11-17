import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin, Compass, AlertCircle, CheckCircle2, Shield, RefreshCw } from 'lucide-react';

// Fixed Destination: KCC Institute of Technology and Management (Knowledge Park II, Greater Noida)
export const KCC_DESTINATION = {
  name: 'KCC Institute of Technology & Management',
  code: 'KCC ITM',
  lat: 28.4632,
  lng: 77.4912,
  address: 'Knowledge Park II, Greater Noida, UP 201306',
};

// Defined Student Commuter Corridors & Hub Coordinates
export const COMMUTER_HUBS = [
  {
    id: 'noida-62',
    name: 'Noida 62',
    fullTitle: 'Noida Sector 62 Hub',
    lat: 28.6256,
    lng: 77.3626,
    distanceKm: 28.5,
    etaMins: 34,
    traffic: 'Clear',
    waypoints: [
      [28.6256, 77.3626], // Noida 62
      [28.5880, 77.3820], // Sector 71
      [28.5355, 77.3910], // FNG / Noida Expwy
      [28.4732, 77.5108], // Pari Chowk
      [28.4632, 77.4912], // KCC ITM
    ],
  },
  {
    id: 'nh-3',
    name: 'NH-3',
    fullTitle: 'NH-3 / Crossings Republik',
    lat: 28.6360,
    lng: 77.4326,
    distanceKm: 24.2,
    etaMins: 31,
    traffic: 'Clear',
    waypoints: [
      [28.6360, 77.4326], // NH-3 Crossings
      [28.6080, 77.4420], // Char Murti
      [28.5400, 77.4700], // 130m Expwy
      [28.4732, 77.5108], // Pari Chowk
      [28.4632, 77.4912], // KCC ITM
    ],
  },
  {
    id: 'chapraula',
    name: 'Chapraula',
    fullTitle: 'Chapraula Commuter Hub',
    lat: 28.5950,
    lng: 77.4780,
    distanceKm: 19.8,
    etaMins: 26.5,
    traffic: 'Clear',
    waypoints: [
      [28.5950, 77.4780], // Chapraula
      [28.5400, 77.4920], // Surajpur Ind.
      [28.4850, 77.5020], // Dadri Bypass
      [28.4632, 77.4912], // KCC ITM
    ],
  },
  {
    id: 'lal-kuan',
    name: 'Lal Kuan',
    fullTitle: 'Lal Kuan Corridor (EPE Reroute)',
    lat: 28.6475,
    lng: 77.4572,
    distanceKm: 35.3,
    etaMins: 49.5,
    traffic: 'Lal Kuan Bypassed',
    isBypass: true,
    waypoints: [
      [28.6475, 77.4572], // Lal Kuan
      [28.6650, 77.5100], // EPE Interchange
      [28.5800, 77.5350], // EPE Corridor
      [28.4800, 77.5150], // Dadri Link
      [28.4732, 77.5108], // Pari Chowk
      [28.4632, 77.4912], // KCC ITM
    ],
  },
];

// Haversine distance helper with safe null/undefined guards
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return '0.0';
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return '0.0';

  const R = 6371; // Earth radius in km
  const dLat = (nLat2 - nLat1) * (Math.PI / 180);
  const dLon = (nLon2 - nLon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(nLat1 * (Math.PI / 180)) * Math.cos(nLat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

// Find nearest commuter hub from given coordinates with safe fallback
export function getNearestHub(lat, lng) {
  if (lat == null || lng == null) return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (isNaN(nLat) || isNaN(nLng)) return null;

  let minD = Infinity;
  let closest = null;
  for (const hub of (COMMUTER_HUBS || [])) {
    if (!hub || typeof hub.lat !== 'number' || typeof hub.lng !== 'number') continue;
    const d = parseFloat(calculateDistance(nLat, nLng, hub.lat, hub.lng));
    if (!isNaN(d) && d < minD) {
      minD = d;
      closest = { ...hub, distanceToUser: d };
    }
  }
  return closest;
}

// Marker Icon Factory
function getMarkerIcon(type, title, isSelected = false) {
  let html = '';

  if (type === 'destination') {
    html = `
      <div class="relative flex items-center justify-center">
        <span class="animate-ping absolute inline-flex h-9 w-9 rounded-full bg-emerald-400 opacity-60"></span>
        <div class="relative w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-black font-extrabold text-sm">
          🎓
        </div>
        <div class="absolute -bottom-5 whitespace-nowrap bg-emerald-900/95 text-emerald-200 border border-emerald-400/80 text-[10px] font-mono px-2 py-0.5 rounded font-bold shadow-md">
          ${title}
        </div>
      </div>
    `;
  } else if (type === 'user') {
    html = `
      <div class="relative flex items-center justify-center">
        <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-sky-400 opacity-70"></span>
        <div class="relative w-7 h-7 rounded-full bg-sky-500 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-bold">
          📍
        </div>
        <div class="absolute -bottom-5 whitespace-nowrap bg-sky-950/95 text-sky-200 border border-sky-400/80 text-[10px] font-mono px-2 py-0.5 rounded font-bold shadow-md">
          Your Location
        </div>
      </div>
    `;
  } else {
    // Hub
    const isAmber = title.includes('Lal Kuan');
    const borderColor = isSelected
      ? isAmber
        ? 'border-amber-400 ring-2 ring-amber-400/50'
        : 'border-emerald-400 ring-2 ring-emerald-400/50'
      : isAmber
      ? 'border-amber-500'
      : 'border-slate-400 dark:border-zinc-500';

    const bgBadge = isAmber ? 'bg-amber-950/90 text-amber-200 border-amber-600/70' : 'bg-slate-900/90 text-slate-100 border-slate-700';

    html = `
      <div class="relative flex items-center justify-center">
        <div class="w-6 h-6 rounded-md bg-white dark:bg-[#121215] ${borderColor} border-2 shadow-lg flex items-center justify-center text-xs font-bold">
          ${isAmber ? '⚡' : '🚘'}
        </div>
        <div class="absolute -bottom-5 whitespace-nowrap ${bgBadge} border text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold shadow">
          ${title}
        </div>
      </div>
    `;
  }

  return L.divIcon({
    html,
    className: 'custom-div-icon',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Controller component to smoothly pan/zoom map on changes with try/catch
function MapViewUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    try {
      if (center && typeof center[0] === 'number' && !isNaN(center[0]) && typeof center[1] === 'number' && !isNaN(center[1])) {
        map.flyTo(center, zoom || 11, { duration: 1.2 });
      }
    } catch (e) {
      console.warn('Map flyTo safe catch:', e);
    }
  }, [center, zoom, map]);
  return null;
}

export default function LiveRouteMap({
  theme = 'dark',
  activeHubFilter = 'All Hubs',
  onSelectHub,
  userLocation = null,
  isLocating = false,
  locationError = null,
  onRequestLocation,
  compact = false,
  className = '',
}) {
  // Determine active hub
  const activeHub = useMemo(() => {
    if (!activeHubFilter || activeHubFilter === 'All Hubs') return null;
    return (COMMUTER_HUBS || []).find((h) => h?.name?.toLowerCase() === activeHubFilter.toLowerCase()) || null;
  }, [activeHubFilter]);

  // Center coordinate
  const mapCenter = useMemo(() => {
    if (activeHub && typeof activeHub.lat === 'number' && !isNaN(activeHub.lat) && typeof activeHub.lng === 'number' && !isNaN(activeHub.lng)) {
      return [activeHub.lat, activeHub.lng];
    }
    // Midpoint between NCR hubs and KCC Institute
    return [28.5450, 77.4400];
  }, [activeHub]);

  const mapZoom = activeHub ? 12 : 11;

  // Compute nearest hub from user's GPS
  const nearestHub = useMemo(() => {
    if (userLocation?.lat == null || userLocation?.lng == null) return null;
    const nLat = Number(userLocation.lat);
    const nLng = Number(userLocation.lng);
    if (isNaN(nLat) || isNaN(nLng)) return null;

    let minD = Infinity;
    let closest = null;
    (COMMUTER_HUBS || []).forEach((h) => {
      if (!h || typeof h.lat !== 'number' || typeof h.lng !== 'number') return;
      const d = parseFloat(calculateDistance(nLat, nLng, h.lat, h.lng));
      if (!isNaN(d) && d < minD) {
        minD = d;
        closest = { ...h, distanceToUser: d };
      }
    });
    return closest;
  }, [userLocation]);

  return (
    <div className={`isolate relative z-0 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-zinc-800/80 bg-slate-100 dark:bg-zinc-950 shadow-sm transition-all w-full group ${className}`}>
      {/* Floating Top Overlay Controls - Stacks/wraps gracefully inside map card on mobile */}
      <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 right-2.5 sm:right-3 z-20 pointer-events-none flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        {/* Left Status Pill */}
        <div className="pointer-events-auto">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200/80 dark:border-zinc-700/80 shadow-md text-[11px] sm:text-xs font-sans">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">KCC Corridor Radar</span>
            <span className="text-slate-400 dark:text-zinc-500 text-[10px] hidden md:inline">• Live Commuter GPS</span>
          </div>
        </div>

        {/* Right Controls (GPS & Reset) */}
        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0 ml-auto">
          {userLocation ? (
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-300 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-emerald-300/80 dark:border-emerald-700/80 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium shadow-md">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="whitespace-nowrap">GPS Active</span>
            </div>
          ) : locationError ? (
            <button
              type="button"
              onClick={onRequestLocation}
              title={locationError}
              className="flex items-center gap-1 text-[11px] sm:text-xs text-amber-700 dark:text-amber-300 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-amber-300/80 dark:border-amber-700/80 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full font-medium shadow-md cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/40 shrink-0"
            >
              <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
              <span>Retry GPS</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onRequestLocation}
              disabled={isLocating}
              className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-700 dark:text-zinc-200 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200/80 dark:border-zinc-700/80 hover:border-emerald-500 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full font-medium shadow-md transition-all cursor-pointer active:scale-[0.98] shrink-0"
            >
              <Compass className={`w-3 h-3 text-emerald-500 shrink-0 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'Locating...' : 'Enable GPS'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onSelectHub && onSelectHub('All Hubs')}
            className="text-[11px] sm:text-xs text-slate-700 dark:text-zinc-200 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-slate-200/80 dark:border-zinc-700/80 hover:text-emerald-600 dark:hover:text-emerald-400 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-full font-medium shadow-md transition-all cursor-pointer active:scale-[0.98] shrink-0"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Floating Bottom Telemetry Banner (when available) */}
      {userLocation && nearestHub && (
        <div className="absolute bottom-2.5 sm:bottom-3 left-2.5 sm:left-3 right-2.5 sm:right-3 sm:left-auto sm:right-3 z-20 pointer-events-auto max-w-full">
          <div className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:py-2 rounded-xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-sky-200/90 dark:border-sky-800/80 shadow-lg text-[11px] sm:text-xs font-sans text-sky-950 dark:text-sky-200 w-full sm:w-auto sm:max-w-md">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <span className="truncate">Nearest: <strong>{nearestHub.fullTitle}</strong> (~{nearestHub.distanceToUser} km)</span>
            </div>
            <span className="text-[10px] sm:text-[11px] text-sky-700 dark:text-sky-400 font-mono">
              • Direct: ~{calculateDistance(userLocation.lat, userLocation.lng, KCC_DESTINATION.lat, KCC_DESTINATION.lng)} km
            </span>
          </div>
        </div>
      )}

      {/* Leaflet Map Surface */}
      <div className={`w-full relative z-0 ${compact ? 'h-[200px] md:h-[260px]' : 'h-[260px] md:h-[360px]'}`}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom={false}
          zoomControl={false}
          attributionControl={false}
          className="w-full h-full"
        >
          <MapViewUpdater center={mapCenter} zoom={mapZoom} />

          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution=""
            maxZoom={19}
          />

          {/* KCC Institute Destination Marker */}
          <Marker
            position={[KCC_DESTINATION.lat, KCC_DESTINATION.lng]}
            icon={getMarkerIcon('destination', KCC_DESTINATION.code)}
          >
            <Popup className="font-mono text-xs">
              <div className="space-y-1 p-1">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 block text-xs">
                  🎓 {KCC_DESTINATION.name}
                </span>
                <span className="text-[10px] text-slate-600 block">{KCC_DESTINATION.address}</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold block mt-1">
                  Fixed Campus Terminal Anchor
                </span>
              </div>
            </Popup>
          </Marker>

          {/* User Current Location Marker */}
          {typeof userLocation?.lat === 'number' && !isNaN(userLocation.lat) && typeof userLocation?.lng === 'number' && !isNaN(userLocation.lng) && (
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={getMarkerIcon('user', 'You')}
            >
              <Popup className="font-mono text-xs">
                <div className="space-y-1 p-1">
                  <span className="font-bold text-sky-600 block text-xs">📍 Your GPS Location</span>
                  <span className="text-[10px] text-slate-600 block">
                    Lat: {Number(userLocation.lat).toFixed(4)}, Lng: {Number(userLocation.lng).toFixed(4)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Accuracy: ±{Math.round(userLocation.accuracy || 10)} meters
                  </span>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Commuter Hub Markers */}
          {COMMUTER_HUBS.map((hub) => {
            const isSelected = activeHub?.id === hub.id;
            return (
              <Marker
                key={hub.id}
                position={[hub.lat, hub.lng]}
                icon={getMarkerIcon('hub', hub.name, isSelected)}
                eventHandlers={{
                  click: () => onSelectHub && onSelectHub(hub.name),
                }}
              >
                <Popup className="font-mono text-xs">
                  <div className="space-y-1 p-1">
                    <span className="font-bold text-[#0F172A] block text-xs">{hub.fullTitle}</span>
                    <span className="text-[10px] text-slate-600 block">
                      Distance to KCC: <strong>{hub.distanceKm} km</strong> • Avg ETA: ~{hub.etaMins}m
                    </span>
                    <span className={`text-[10px] px-1 py-0.2 rounded font-bold block mt-1 ${
                      hub.isBypass ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      Traffic: {hub.traffic}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectHub && onSelectHub(hub.name)}
                      className="mt-1 text-[10px] text-emerald-600 font-bold underline block"
                    >
                      Filter rides for this hub
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Active Corridor Polylines */}
          {COMMUTER_HUBS.map((hub) => {
            const isSelected = activeHub?.id === hub.id;
            const isLalKuan = hub.id === 'lal-kuan';
            const color = isLalKuan ? (isSelected ? '#F59E0B' : '#D97706') : (isSelected ? '#10B981' : '#64748B');
            const weight = isSelected ? 4 : 2;
            const opacity = isSelected ? 0.9 : 0.4;
            const dashArray = isSelected ? '6, 6' : undefined;

            return (
              <Polyline
                key={`route-${hub.id}`}
                positions={hub.waypoints}
                pathOptions={{
                  color,
                  weight,
                  opacity,
                  dashArray,
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* Map Legend & Corridor Quick Select */}
      <div className="p-2 sm:p-2.5 bg-slate-50 dark:bg-[#09090b] border-t border-[#E2E8F0] dark:border-[#27272a] flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-600 dark:text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            KCC ITM Gate
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span>
            Your GPS
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1 bg-amber-500 inline-block"></span>
            Lal Kuan EPE Bypass
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1 bg-emerald-500 inline-block"></span>
            Expressway Routes
          </span>
        </div>

        <div className="text-slate-500 dark:text-zinc-500 hidden md:block">
          Click any hub marker to filter active dispatches
        </div>
      </div>
    </div>
  );
}
