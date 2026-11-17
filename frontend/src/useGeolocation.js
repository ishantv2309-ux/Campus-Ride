import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to manage HTML5 Geolocation with permission state and safe mobile fallback handling.
 * Prevents mobile browsers from crashing on non-secure origins or when GPS access is blocked.
 */
export function useGeolocation(autoPrompt = true) {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied' | 'unavailable'

  // Query permissions API safely if available and supported
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && navigator?.permissions?.query) {
        navigator.permissions.query({ name: 'geolocation' })
          .then((result) => {
            if (result) {
              setPermissionState(result.state);
              result.onchange = () => {
                try {
                  setPermissionState(result.state);
                } catch (e) {}
              };
            }
          })
          .catch(() => {
            // Permissions API query not supported for geolocation in some browsers (e.g. Safari)
          });
      }
    } catch (e) {
      // Ignore permissions check exception
    }
  }, []);

  const requestLocation = useCallback(() => {
    try {
      // 1. Guard check: verify navigator.geolocation exists
      if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.geolocation) {
        setError('Geolocation is not supported by your browser.');
        setPermissionState('unavailable');
        return;
      }

      // 2. HTTPS / Secure context check for mobile browsers
      // Mobile Safari and Chrome strictly reject geolocation in non-secure contexts (e.g., plain http://) unless localhost
      const isLocal = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '[::1]'
      );

      if (typeof window !== 'undefined' && window.isSecureContext === false && !isLocal) {
        console.warn('Geolocation blocked: insecure HTTP origin on mobile. Falling back to default corridor.');
        setError('Location blocked on non-secure connection.');
        setPermissionState('denied');
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          try {
            if (position?.coords) {
              const coords = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp || Date.now(),
              };
              setLocation(coords);
              setPermissionState('granted');
            }
          } catch (err) {
            console.warn('Geolocation coordinate extraction error:', err);
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
    } catch (err) {
      console.warn('Geolocation invocation caught safely:', err);
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
