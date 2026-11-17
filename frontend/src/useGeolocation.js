import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to safely manage HTML5 Geolocation with permission state and safe mobile fallback handling.
 * Prevents mobile browsers from crashing on non-secure origins, missing APIs, or permission rejections.
 */
export function useGeolocation(autoPrompt = true) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied' | 'unavailable'

  // Query permissions API safely if available and supported
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.permissions?.query) {
        navigator.permissions.query({ name: 'geolocation' })
          .then((result) => {
            if (result) {
              setPermissionState(result.state || 'prompt');
              result.onchange = () => {
                try {
                  setPermissionState(result.state || 'prompt');
                } catch {
                  // Ignore permission change listener error
                }
              };
            }
          })
          .catch(() => {
            // Permissions API query not supported for geolocation in some mobile browsers (e.g. Safari)
          });
      }
    } catch {
      // Ignore permissions check exception
    }
  }, []);

  const requestLocation = useCallback(() => {
    try {
      // 1. Browser-only conditional check
      if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
        setError('Geolocation is not supported by your mobile browser.');
        setPermissionState('unavailable');
        return;
      }

      // 2. HTTPS / Secure context check for mobile devices
      // Mobile Safari and Chrome strictly block GPS on non-secure origins unless localhost
      const hostname = window.location?.hostname || '';
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';

      if (window.isSecureContext === false && !isLocal) {
        console.warn('Geolocation blocked: Insecure HTTP connection on mobile. Silently using default corridor coordinates.');
        setError('Location blocked on non-secure connection.');
        setPermissionState('denied');
        return;
      }

      setLoading(true);
      setError(null);

      // Safe invocation of navigator.geolocation.getCurrentPosition
      if (typeof window !== 'undefined' && navigator.geolocation) {
        try {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              try {
                if (position?.coords) {
                  const lat = position.coords.latitude;
                  const lng = position.coords.longitude;

                  // Guard against invalid NaN or non-number coordinates
                  if (typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng)) {
                    const coords = {
                      lat,
                      lng,
                      accuracy: position.coords.accuracy || 10,
                      timestamp: position.timestamp || Date.now(),
                    };
                    setLocation(coords);
                    setPermissionState('granted');
                  }
                }
              } catch (posErr) {
                console.warn('Geolocation coordinate extraction caught safely:', posErr);
              } finally {
                setLoading(false);
              }
            },
            (err) => {
              let msg = 'Unable to retrieve location.';
              if (err) {
                if (err.code === err.PERMISSION_DENIED || err.code === 1) {
                  msg = 'Location permission denied by user.';
                  setPermissionState('denied');
                } else if (err.code === err.POSITION_UNAVAILABLE || err.code === 2) {
                  msg = 'Location information is unavailable.';
                  setPermissionState('unavailable');
                } else if (err.code === err.TIMEOUT || err.code === 3) {
                  msg = 'Location request timed out.';
                  setPermissionState('unavailable');
                }
              }
              console.warn('Geolocation fallback active:', msg);
              setError(msg);
              setLoading(false);
            },
            {
              enableHighAccuracy: false, // Low power / fast fix to prevent cellular mobile GPS freeze
              timeout: 8000,
              maximumAge: 60000,
            }
          );
        } catch (callErr) {
          console.warn('getCurrentPosition call threw exception safely caught:', callErr);
          setError('Location unavailable');
          setPermissionState('unavailable');
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.warn('Geolocation request failed safely:', err);
      setError('Location unavailable');
      setPermissionState('unavailable');
      setLoading(false);
    }
  }, []);

  // Optionally prompt on initial mount safely
  useEffect(() => {
    if (autoPrompt) {
      try {
        requestLocation();
      } catch (err) {
        console.warn('Initial geolocation check caught safely:', err);
      }
    }
  }, [autoPrompt, requestLocation]);

  return {
    location,
    error,
    loading,
    permissionState,
    requestLocation,
  };
}
