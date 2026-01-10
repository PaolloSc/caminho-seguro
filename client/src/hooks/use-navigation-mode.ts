import { useState, useEffect, useCallback, useRef } from 'react';

interface NavigationState {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  timestamp: number;
}

interface UseNavigationModeOptions {
  enabled: boolean;
  enableHighAccuracy?: boolean;
  smoothingFactor?: number;
}

export function useNavigationMode({
  enabled,
  enableHighAccuracy = true,
  smoothingFactor = 0.3
}: UseNavigationModeOptions) {
  const [position, setPosition] = useState<NavigationState | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const watchIdRef = useRef<number | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  const headingHistoryRef = useRef<number[]>([]);

  const smoothHeading = useCallback((newHeading: number | null): number | null => {
    if (newHeading === null) return lastHeadingRef.current;
    
    headingHistoryRef.current.push(newHeading);
    if (headingHistoryRef.current.length > 5) {
      headingHistoryRef.current.shift();
    }
    
    if (headingHistoryRef.current.length < 2) {
      lastHeadingRef.current = newHeading;
      return newHeading;
    }
    
    const sinSum = headingHistoryRef.current.reduce((sum, h) => sum + Math.sin(h * Math.PI / 180), 0);
    const cosSum = headingHistoryRef.current.reduce((sum, h) => sum + Math.cos(h * Math.PI / 180), 0);
    const avgHeading = Math.atan2(sinSum, cosSum) * 180 / Math.PI;
    const normalizedHeading = avgHeading < 0 ? avgHeading + 360 : avgHeading;
    
    if (lastHeadingRef.current !== null) {
      const diff = normalizedHeading - lastHeadingRef.current;
      const shortestDiff = ((diff + 540) % 360) - 180;
      const smoothed = lastHeadingRef.current + shortestDiff * smoothingFactor;
      lastHeadingRef.current = ((smoothed % 360) + 360) % 360;
    } else {
      lastHeadingRef.current = normalizedHeading;
    }
    
    return lastHeadingRef.current;
  }, [smoothingFactor]);

  const getZoomForSpeed = useCallback((speed: number | null): number => {
    if (speed === null || speed < 1) return 18;
    if (speed < 5) return 18;
    if (speed < 15) return 17;
    if (speed < 30) return 16;
    return 15;
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada');
      return;
    }

    setIsTracking(true);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const smoothedHeading = smoothHeading(pos.coords.heading);
        
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: smoothedHeading,
          speed: pos.coords.speed !== null ? pos.coords.speed * 3.6 : null,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp
        });
      },
      (err) => {
        setError(err.message);
        setIsTracking(false);
      },
      {
        enableHighAccuracy,
        maximumAge: 1000,
        timeout: 10000
      }
    );
  }, [enableHighAccuracy, smoothHeading]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    lastHeadingRef.current = null;
    headingHistoryRef.current = [];
  }, []);

  useEffect(() => {
    if (enabled) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [enabled, startTracking, stopTracking]);

  useEffect(() => {
    if (!enabled || !isTracking) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        const compassHeading = 360 - event.alpha;
        const smoothedHeading = smoothHeading(compassHeading);
        if (smoothedHeading !== null) {
          setPosition(prev => prev ? { ...prev, heading: smoothedHeading } : null);
        }
      }
    };

    if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [enabled, isTracking, smoothHeading]);

  return {
    position,
    isTracking,
    error,
    getZoomForSpeed,
    startTracking,
    stopTracking
  };
}
