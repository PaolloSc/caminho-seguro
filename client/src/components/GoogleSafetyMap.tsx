import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow, HeatmapLayer } from "@react-google-maps/api";
import { Report } from "@shared/schema";
import { format } from "date-fns";
import { Shield, AlertTriangle, Lightbulb, Ghost, HelpCircle, MapPin, ThumbsUp, ThumbsDown, Flag, Bus, TreePine, Building2, Siren, Layers, Navigation2, Search, Loader2, Navigation, Compass, X } from "lucide-react";
import { Button } from "./ui/button-custom";
import { useAuth } from "@/hooks/use-auth";
import { useVerifyReport, useDownvoteReport, useFlagReport } from "@/hooks/use-reports";
import { useToast } from "@/hooks/use-toast";
import { useNavigationMode } from "@/hooks/use-navigation-mode";
import { useMapsConfig } from "@/hooks/use-maps-config";

interface POI {
  id: string;
  lat: number;
  lng: number;
  type: 'bus_stop' | 'park' | 'hospital' | 'police';
  name?: string;
}

const poiCache = new Map<string, { pois: POI[], timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

const libraries: ("visualization" | "places" | "geometry")[] = ["visualization", "places", "geometry"];

async function fetchPOIs(bounds: google.maps.LatLngBounds): Promise<POI[]> {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  
  const cacheKey = `${sw.lat().toFixed(3)},${sw.lng().toFixed(3)},${ne.lat().toFixed(3)},${ne.lng().toFixed(3)}`;
  
  const cached = poiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.pois;
  }
  
  const bbox = `${sw.lat()},${sw.lng()},${ne.lat()},${ne.lng()}`;
  
  const query = `
    [out:json][timeout:10];
    (
      node["highway"="bus_stop"](${bbox});
      node["leisure"="park"](${bbox});
      way["leisure"="park"](${bbox});
      node["amenity"="hospital"](${bbox});
      way["amenity"="hospital"](${bbox});
      node["amenity"="police"](${bbox});
      way["amenity"="police"](${bbox});
    );
    out center 100;
  `;
  
  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const pois: POI[] = data.elements.map((el: any) => {
      let type: POI['type'] = 'bus_stop';
      if (el.tags?.leisure === 'park') type = 'park';
      else if (el.tags?.amenity === 'hospital') type = 'hospital';
      else if (el.tags?.amenity === 'police') type = 'police';
      else if (el.tags?.highway === 'bus_stop') type = 'bus_stop';
      
      return {
        id: `${el.type}-${el.id}`,
        lat: el.lat || el.center?.lat,
        lng: el.lon || el.center?.lon,
        type,
        name: el.tags?.name
      };
    }).filter((p: POI) => p.lat && p.lng);
    
    poiCache.set(cacheKey, { pois, timestamp: Date.now() });
    return pois;
  } catch (error) {
    console.error('Error fetching POIs:', error);
    return [];
  }
}

async function fetchRoute(start: { lat: number; lng: number }, end: { lat: number; lng: number }): Promise<google.maps.LatLngLiteral[] | null> {
  try {
    const directionsService = new google.maps.DirectionsService();
    
    const result = await new Promise<google.maps.DirectionsResult | null>((resolve) => {
      directionsService.route(
        {
          origin: start,
          destination: end,
          travelMode: google.maps.TravelMode.WALKING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK) {
            resolve(result);
          } else {
            console.error('Erro DirectionsService:', status);
            resolve(null);
          }
        }
      );
    });

    if (result && result.routes[0]?.overview_path) {
      return result.routes[0].overview_path.map(p => ({
        lat: p.lat(),
        lng: p.lng()
      }));
    }
    
    const url = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes?.[0]) {
      const coords = data.routes[0].geometry.coordinates;
      return coords.map((c: [number, number]) => ({ lat: c[1], lng: c[0] }));
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar rota:', error);
    return null;
  }
}

function calculateRouteSafety(route: google.maps.LatLngLiteral[], reports: Report[]): { score: number; nearbyDangers: number; totalSeverity: number } {
  const dangerRadius = 0.002;
  const dangerReportsNearRoute = new Set<number>();
  let totalSeverity = 0;
  
  for (const report of reports) {
    if (report.type === 'abrigo_seguro') continue;
    
    for (const point of route) {
      const dist = Math.sqrt(Math.pow(point.lat - report.lat, 2) + Math.pow(point.lng - report.lng, 2));
      if (dist < dangerRadius) {
        dangerReportsNearRoute.add(report.id);
        const severityWeight = report.severity || 3;
        const typeWeight = report.type === 'assedio' ? 2 : 1;
        totalSeverity += severityWeight * typeWeight;
        break;
      }
    }
  }
  
  const nearbyDangers = dangerReportsNearRoute.size;
  const score = Math.max(0, Math.min(100, 100 - (totalSeverity * 5)));
  
  return { score: Math.round(score), nearbyDangers, totalSeverity };
}

async function geocodeAddress(query: string): Promise<{ lat: number; lng: number; display: string } | null> {
  try {
    // Tenta usar Google Geocoder primeiro
    const geocoder = new google.maps.Geocoder();
    const result = await new Promise<google.maps.GeocoderResult | null>((resolve) => {
      geocoder.geocode(
        { 
          address: query,
          region: 'BR',
          componentRestrictions: { country: 'BR' }
        },
        (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
            resolve(results[0]);
          } else {
            console.log('Google Geocoder status:', status);
            resolve(null);
          }
        }
      );
    });

    if (result) {
      return {
        lat: result.geometry.location.lat(),
        lng: result.geometry.location.lng(),
        display: result.formatted_address
      };
    }

    // Fallback para Nominatim
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=1`;
    const response = await fetch(url, {
      headers: { 'Accept-Language': 'pt-BR' }
    });
    const data = await response.json();
    
    if (data?.[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display: data[0].display_name.split(',').slice(0, 3).join(', ')
      };
    }
    return null;
  } catch (error) {
    console.error('Erro ao geocodificar:', error);
    return null;
  }
}

const REPORT_COLORS: Record<string, string> = {
  assedio: '#ef4444',
  iluminacao_precaria: '#eab308',
  local_deserto: '#6b7280',
  abrigo_seguro: '#22c55e'
};

const POI_COLORS: Record<string, string> = {
  bus_stop: '#3b82f6',
  park: '#22c55e',
  hospital: '#ef4444',
  police: '#8b5cf6'
};

// SVG paths dos ícones Lucide (24x24 viewBox)
const ICON_PATHS: Record<string, string> = {
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  alertTriangle: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
  lightbulb: 'M9 18h6 M10 22h4 M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z',
  ghost: 'M9 10h.01 M15 10h.01 M12 2a8 8 0 0 0-8 8v12l3-3 2 2 3-3 3 3 2-2 3 3V10a8 8 0 0 0-8-8z',
  bus: 'M8 6v6 M16 6v6 M4 11h16 M5 17h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z M7 17v2 M17 17v2',
  tree: 'M12 22v-7 M12 8V2 M8 12l4-4 4 4 M5 18l7-6 7 6',
  hospital: 'M3 21h18 M9 8h6 M12 8v8 M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16',
  police: 'M12 2l9 4.5v5c0 5-3.5 9.74-9 11.5-5.5-1.76-9-6.5-9-11.5v-5L12 2z M12 8v4 M12 16h.01'
};

function createReportMarkerSvg(type: string): string {
  const color = REPORT_COLORS[type] || '#6b7280';
  let iconPath = '';
  
  switch (type) {
    case 'assedio':
      iconPath = '<path d="M12 9v4" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="white"/><path d="M10.29 5.86L3.82 17a2 2 0 0 0 1.71 3h12.94a2 2 0 0 0 1.71-3L13.71 5.86a2 2 0 0 0-3.42 0z" fill="none" stroke="white" stroke-width="1.5"/>';
      break;
    case 'iluminacao_precaria':
      iconPath = '<path d="M12 4a5 5 0 0 0-5 5c0 1.7.85 3.2 2.15 4.1V15a.85.85 0 0 0 .85.85h4a.85.85 0 0 0 .85-.85v-1.9A5 5 0 0 0 12 4z" fill="white"/><path d="M9.5 17.5h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M10 19.5h4" stroke="white" stroke-width="1.5" stroke-linecap="round"/>';
      break;
    case 'local_deserto':
      iconPath = '<circle cx="9" cy="10" r="1.5" fill="white"/><circle cx="15" cy="10" r="1.5" fill="white"/><path d="M12 4a6 6 0 0 0-6 6v9l2-2 1.5 1.5 2.5-2.5 2.5 2.5 1.5-1.5 2 2V10a6 6 0 0 0-6-6z" fill="none" stroke="white" stroke-width="1.5"/>';
      break;
    case 'abrigo_seguro':
      iconPath = '<path d="M12 4l6 3v4.5c0 3.75-2.6 7.3-6 8.5-3.4-1.2-6-4.75-6-8.5V7l6-3z" fill="white"/><path d="M9 12l2 2 4-4" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      break;
  }
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
    </defs>
    <path d="M20 0C11.72 0 5 6.72 5 15c0 10.5 15 29 15 29s15-18.5 15-29C35 6.72 28.28 0 20 0z" fill="${color}" filter="url(#shadow)"/>
    <circle cx="20" cy="15" r="11" fill="${color}"/>
    <g transform="translate(8, 3)">${iconPath}</g>
  </svg>`;
  
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function createPOIMarkerSvg(type: string): string {
  const color = POI_COLORS[type] || '#6b7280';
  let iconPath = '';
  
  switch (type) {
    case 'bus_stop':
      iconPath = '<rect x="5" y="4" width="14" height="12" rx="2" fill="none" stroke="white" stroke-width="1.5"/><line x1="5" y1="10" x2="19" y2="10" stroke="white" stroke-width="1.5"/><line x1="8" y1="5" x2="8" y2="10" stroke="white" stroke-width="1.5"/><line x1="16" y1="5" x2="16" y2="10" stroke="white" stroke-width="1.5"/><circle cx="8" cy="18" r="1.5" fill="white"/><circle cx="16" cy="18" r="1.5" fill="white"/>';
      break;
    case 'park':
      iconPath = '<path d="M12 20v-6" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M12 3l-6 8h4l-3 5h10l-3-5h4L12 3z" fill="white"/>';
      break;
    case 'hospital':
      iconPath = '<path d="M4 20h16" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M6 20V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14" fill="none" stroke="white" stroke-width="1.5"/><path d="M9 10h6" stroke="white" stroke-width="2" stroke-linecap="round"/><path d="M12 7v6" stroke="white" stroke-width="2" stroke-linecap="round"/>';
      break;
    case 'police':
      iconPath = '<path d="M12 3l7 3.5v4c0 4-2.8 7.8-7 9.2-4.2-1.4-7-5.2-7-9.2v-4L12 3z" fill="none" stroke="white" stroke-width="1.5"/><path d="M12 8v3" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="14" r="1" fill="white"/>';
      break;
  }
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2"/>
    <g transform="translate(2, 2)">${iconPath}</g>
  </svg>`;
  
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function getReportIcon(type: string) {
  switch (type) {
    case 'assedio': return AlertTriangle;
    case 'iluminacao_precaria': return Lightbulb;
    case 'local_deserto': return Ghost;
    case 'abrigo_seguro': return Shield;
    default: return HelpCircle;
  }
}

function getPOIIcon(type: POI['type']) {
  switch (type) {
    case 'bus_stop': return Bus;
    case 'park': return TreePine;
    case 'hospital': return Building2;
    case 'police': return Siren;
    default: return MapPin;
  }
}

const containerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: -19.9167,
  lng: -43.9345
};

const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
  { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
];

interface SafetyMapProps {
  reports: Report[];
  onAddReport: (lat: number, lng: number) => void;
  onViewReport: (id: number) => void;
  className?: string;
  isNightMode?: boolean;
}

// Wrapper component que busca a chave API antes de montar o mapa
export function GoogleSafetyMap(props: SafetyMapProps) {
  const { data: mapsConfig, isLoading: isLoadingConfig, isError: isConfigError } = useMapsConfig();
  const apiKey = mapsConfig?.apiKey ?? '';

  // Mostrar loading enquanto busca a configuração
  if (isLoadingConfig) {
    return (
      <div className={`flex items-center justify-center bg-muted/50 rounded-lg ${props.className || 'h-[600px]'}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground text-sm">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  // Mostrar erro se falhou ao buscar configuração
  if (isConfigError || !apiKey) {
    return (
      <div className={`flex items-center justify-center bg-destructive/10 rounded-lg ${props.className || 'h-[600px]'}`}>
        <div className="text-center text-destructive">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Erro ao carregar configurações do mapa</p>
        </div>
      </div>
    );
  }

  // Só renderiza o mapa interno quando temos a chave API
  return <GoogleSafetyMapInner {...props} apiKey={apiKey} />;
}

// Componente interno com o useJsApiLoader - só é montado quando apiKey está disponível
function GoogleSafetyMapInner({ reports, onAddReport, onViewReport, className, isNightMode = false, apiKey }: SafetyMapProps & { apiKey: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { mutate: verifyReport, isPending: isVerifying } = useVerifyReport();
  const { mutate: downvoteReport, isPending: isDownvoting } = useDownvoteReport();
  const { mutate: flagReport, isPending: isFlagging } = useFlagReport();
  
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showPOIs, setShowPOIs] = useState(true);
  const [pois, setPois] = useState<POI[]>([]);
  
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [isSearchingRoute, setIsSearchingRoute] = useState(false);
  const [routeCoords, setRouteCoords] = useState<google.maps.LatLngLiteral[] | null>(null);
  const [routeSafety, setRouteSafety] = useState<{ score: number; nearbyDangers: number; totalSeverity: number } | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<google.maps.LatLngLiteral | null>(null);
  const [navigationMode, setNavigationMode] = useState(false);
  const [isInitialAnimation, setIsInitialAnimation] = useState(true);

  const { position: navPosition, isTracking, getZoomForSpeed } = useNavigationMode({
    enabled: navigationMode
  });

  // Configurações de alta precisão do GPS
  const geoOptions: PositionOptions = useMemo(() => ({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0 // Sempre buscar posição mais recente
  }), []);

  // Monitoramento contínuo da localização para maior precisão
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPosition(newPos);
      },
      (error) => {
        console.log('Erro de geolocalização:', error.message);
      },
      geoOptions
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [geoOptions]);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries,
  });

  const heatmapData = useMemo(() => {
    if (!isLoaded || !window.google) return [];
    return reports.map(r => ({
      location: new google.maps.LatLng(r.lat, r.lng),
      weight: r.type === 'abrigo_seguro' ? 0.2 : 
              r.type === 'assedio' ? (r.severity || 3) / 3 : 
              (r.severity || 3) / 5
    }));
  }, [reports, isLoaded]);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handlePositionUpdate = useCallback((lat: number, lng: number) => {
    setUserPosition({ lat, lng });
  }, []);

  const toggleNavigationMode = useCallback(() => {
    setNavigationMode(prev => !prev);
    if (!navigationMode && !userPosition && map) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserPosition(newPos);
          map.panTo(newPos);
          map.setZoom(18);
        },
        () => {},
        geoOptions
      );
    }
  }, [navigationMode, userPosition, map, geoOptions]);

  const refreshPOIs = useCallback(() => {
    if (!showPOIs || !map) return;
    
    const bounds = map.getBounds();
    if (bounds) {
      fetchPOIs(bounds).then(setPois);
    }
  }, [showPOIs, map]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    setSelectedReport(null);
    setSelectedPOI(null);
    onAddReport(e.latLng.lat(), e.latLng.lng());
  }, [onAddReport]);

  useEffect(() => {
    if (map && isInitialAnimation) {
      map.setCenter({ lat: -15.7801, lng: -47.9292 });
      map.setZoom(4);
      
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserPosition(newPos);
          
          setTimeout(() => {
            map.panTo(newPos);
            map.setZoom(18);
            setIsInitialAnimation(false);
          }, 500);
        },
        () => {
          setTimeout(() => {
            map.panTo(defaultCenter);
            map.setZoom(15);
            setIsInitialAnimation(false);
          }, 500);
        },
        geoOptions
      );
    }
  }, [map, isInitialAnimation, geoOptions]);

  useEffect(() => {
    if (navigationMode && navPosition && map) {
      map.panTo({ lat: navPosition.lat, lng: navPosition.lng });
      map.setZoom(getZoomForSpeed(navPosition.speed));
      handlePositionUpdate(navPosition.lat, navPosition.lng);
      
      if (navPosition.heading !== null) {
        map.setHeading(navPosition.heading);
      }
    }
  }, [navigationMode, navPosition, map, getZoomForSpeed, handlePositionUpdate]);

  const handleSearchRoute = async () => {
    if (!destinationQuery.trim()) {
      toast({
        title: "Digite um destino",
        description: "Por favor, digite o endereço para onde você quer ir.",
        variant: "destructive"
      });
      return;
    }

    if (!userPosition) {
      toast({
        title: "Aguarde sua localização",
        description: "Ainda estamos obtendo sua localização. Tente novamente em alguns segundos.",
        variant: "destructive"
      });
      // Tenta obter localização novamente
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        geoOptions
      );
      return;
    }
    
    setIsSearchingRoute(true);
    setRouteCoords(null);
    setRouteSafety(null);
    
    try {
      console.log('Buscando destino:', destinationQuery);
      const destination = await geocodeAddress(destinationQuery);
      console.log('Destino encontrado:', destination);
      
      if (!destination) {
        toast({
          title: "Endereço não encontrado",
          description: "Não foi possível encontrar o endereço. Tente ser mais específica.",
          variant: "destructive"
        });
        return;
      }
      
      setDestinationMarker({ lat: destination.lat, lng: destination.lng });
      
      console.log('Buscando rota de', userPosition, 'para', destination);
      const route = await fetchRoute(
        userPosition,
        { lat: destination.lat, lng: destination.lng }
      );
      console.log('Rota encontrada:', route?.length, 'pontos');
      
      if (!route || route.length === 0) {
        toast({
          title: "Rota não encontrada",
          description: "Não foi possível calcular uma rota para este destino.",
          variant: "destructive"
        });
        return;
      }
      
      setRouteCoords(route);
      const safety = calculateRouteSafety(route, reports);
      setRouteSafety(safety);
      
      if (map && route.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        route.forEach(point => bounds.extend(point));
        map.fitBounds(bounds, 50);
      }
      
      toast({
        title: "Rota calculada",
        description: `Segurança: ${safety.score}%`,
      });
    } catch (error) {
      console.error('Erro ao buscar rota:', error);
      toast({
        title: "Erro ao calcular rota",
        description: "Ocorreu um erro. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSearchingRoute(false);
    }
  };

  const handleGeolocate = () => {
    if (!map) return;
    
    if (userPosition) {
      map.panTo(userPosition);
      map.setZoom(18);
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserPosition(newPos);
          map.panTo(newPos);
          map.setZoom(18);
        },
        () => {
          toast({
            title: "Localização indisponível",
            description: "Não foi possível obter sua localização.",
            variant: "destructive"
          });
        },
        geoOptions
      );
    }
  };

  const createMarkerIcon = (color: string, size: number = 40): google.maps.Symbol => ({
    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: size / 12,
    anchor: new google.maps.Point(12, 22),
  });

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <div className="text-center p-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-2" />
          <p className="text-muted-foreground">Erro ao carregar o mapa</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando mapa...</span>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden bg-[#242f3e] ${className}`}>
      <GoogleMap
        mapContainerStyle={ { width: '100%', height: '100%', position: 'absolute' } }
        center={defaultCenter}
        zoom={15}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        onIdle={refreshPOIs}
        options={ {
          zoomControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: isNightMode ? darkMapStyles : undefined,
          gestureHandling: 'greedy',
          backgroundColor: isNightMode ? '#242f3e' : '#e5e3df',
          noClear: true,
        } }
      >
        {showHeatmap && heatmapData.length > 0 && (
          <HeatmapLayer
            data={heatmapData}
            options={{
              radius: 25,
              opacity: 0.7,
              gradient: [
                'rgba(34, 197, 94, 0)',
                'rgba(34, 197, 94, 0.4)',
                'rgba(234, 179, 8, 0.6)',
                'rgba(249, 115, 22, 0.8)',
                'rgba(239, 68, 68, 0.9)',
                'rgba(153, 27, 27, 1)'
              ]
            }}
          />
        )}

        {userPosition && (
          <Marker
            position={userPosition}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 3,
              scale: 8,
            }}
            zIndex={1000}
          />
        )}

        {routeCoords && routeCoords.length > 1 && (
          <Polyline
            path={routeCoords}
            options={{
              strokeColor: routeSafety && routeSafety.score >= 70 ? '#22c55e' : 
                           routeSafety && routeSafety.score >= 40 ? '#eab308' : '#ef4444',
              strokeWeight: 6,
              strokeOpacity: 0.8
            }}
          />
        )}

        {destinationMarker && (
          <Marker
            position={destinationMarker}
            icon={createMarkerIcon('#ef4444', 40)}
          />
        )}

        {reports.map(report => (
          <Marker
            key={report.id}
            position={{ lat: report.lat, lng: report.lng }}
            icon={{
              url: createReportMarkerSvg(report.type),
              scaledSize: new google.maps.Size(40, 48),
              anchor: new google.maps.Point(20, 48),
            }}
            onClick={() => {
              setSelectedReport(report);
              setSelectedPOI(null);
            }}
          />
        ))}

        {showPOIs && pois.map(poi => (
          <Marker
            key={poi.id}
            position={{ lat: poi.lat, lng: poi.lng }}
            icon={{
              url: createPOIMarkerSvg(poi.type),
              scaledSize: new google.maps.Size(28, 28),
              anchor: new google.maps.Point(14, 14),
            }}
            onClick={() => {
              setSelectedPOI(poi);
              setSelectedReport(null);
            }}
          />
        ))}

        {selectedReport && (() => {
          const isDark = isNightMode;
          const theme = {
            bg: isDark ? '#1f2937' : '#ffffff',
            text: isDark ? '#f9fafb' : '#1f2937',
            textMuted: isDark ? '#9ca3af' : '#6b7280',
            textSubtle: isDark ? '#6b7280' : '#9ca3af',
            btnBg: isDark ? '#374151' : '#ffffff',
            btnBorder: isDark ? '#4b5563' : '#d1d5db',
            btnText: isDark ? '#f3f4f6' : '#374151',
            dangerBg: isDark ? '#7f1d1d' : '#fef2f2',
            dangerBorder: isDark ? '#991b1b' : '#fecaca',
            dangerText: isDark ? '#fca5a5' : '#dc2626',
          };
          return (
          <InfoWindow
            position={{ lat: selectedReport.lat, lng: selectedReport.lng }}
            onCloseClick={() => setSelectedReport(null)}
          >
            <div style={{ padding: '12px', minWidth: '240px', fontFamily: 'system-ui, sans-serif', backgroundColor: theme.bg, borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '50%', 
                  backgroundColor: REPORT_COLORS[selectedReport.type],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ color: 'white', fontSize: '14px' }}>
                    {selectedReport.type === 'assedio' && '⚠'}
                    {selectedReport.type === 'iluminacao_precaria' && '💡'}
                    {selectedReport.type === 'local_deserto' && '👻'}
                    {selectedReport.type === 'abrigo_seguro' && '🛡'}
                  </span>
                </div>
                <span style={{ fontWeight: '600', fontSize: '14px', color: theme.text }}>
                  {selectedReport.type === 'assedio' && 'Assédio'}
                  {selectedReport.type === 'iluminacao_precaria' && 'Iluminação Precária'}
                  {selectedReport.type === 'local_deserto' && 'Local Deserto'}
                  {selectedReport.type === 'abrigo_seguro' && 'Abrigo Seguro'}
                </span>
              </div>
              
              {selectedReport.description && (
                <p style={{ 
                  fontSize: '12px', 
                  color: theme.textMuted, 
                  marginBottom: '8px',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {selectedReport.description}
                </p>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: theme.textSubtle, marginBottom: '12px' }}>
                <span>{selectedReport.createdAt ? format(new Date(selectedReport.createdAt), 'dd/MM/yyyy HH:mm') : ''}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#22c55e' }}>
                  ✓ {selectedReport.verifiedCount || 0}
                </span>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button
                  onClick={() => verifyReport(selectedReport.id)}
                  disabled={isVerifying || !user}
                  data-testid="button-verify-report"
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    border: `1px solid ${theme.btnBorder}`,
                    borderRadius: '6px',
                    backgroundColor: theme.btnBg,
                    color: theme.btnText,
                    cursor: isVerifying || !user ? 'not-allowed' : 'pointer',
                    opacity: isVerifying || !user ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ✓ Confirmar
                </button>
                <button
                  onClick={() => downvoteReport(selectedReport.id)}
                  disabled={isDownvoting || !user}
                  data-testid="button-downvote-report"
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    border: `1px solid ${theme.btnBorder}`,
                    borderRadius: '6px',
                    backgroundColor: theme.btnBg,
                    color: theme.btnText,
                    cursor: isDownvoting || !user ? 'not-allowed' : 'pointer',
                    opacity: isDownvoting || !user ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ✗ Negar
                </button>
                <button
                  onClick={() => flagReport({ reportId: selectedReport.id, reason: 'falso' })}
                  disabled={isFlagging || !user}
                  data-testid="button-flag-report"
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    border: `1px solid ${theme.dangerBorder}`,
                    borderRadius: '6px',
                    backgroundColor: theme.dangerBg,
                    color: theme.dangerText,
                    cursor: isFlagging || !user ? 'not-allowed' : 'pointer',
                    opacity: isFlagging || !user ? 0.5 : 1
                  }}
                >
                  ⚑
                </button>
                <button
                  onClick={() => onViewReport(selectedReport.id)}
                  data-testid="button-view-report-details"
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: '#7c3aed',
                    color: 'white',
                    cursor: 'pointer',
                    marginLeft: 'auto',
                    fontWeight: '500'
                  }}
                >
                  Detalhes
                </button>
              </div>
            </div>
          </InfoWindow>
          );
        })()}

        {selectedPOI && (() => {
          const isDark = isNightMode;
          const theme = {
            bg: isDark ? '#1f2937' : '#ffffff',
            text: isDark ? '#f9fafb' : '#1f2937',
          };
          return (
          <InfoWindow
            position={{ lat: selectedPOI.lat, lng: selectedPOI.lng }}
            onCloseClick={() => setSelectedPOI(null)}
          >
            <div style={{ padding: '10px', fontFamily: 'system-ui, sans-serif', backgroundColor: theme.bg, borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  backgroundColor: POI_COLORS[selectedPOI.type],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ color: 'white', fontSize: '12px' }}>
                    {selectedPOI.type === 'bus_stop' && '🚌'}
                    {selectedPOI.type === 'park' && '🌳'}
                    {selectedPOI.type === 'hospital' && '🏥'}
                    {selectedPOI.type === 'police' && '🚔'}
                  </span>
                </div>
                <span style={{ fontWeight: '600', fontSize: '13px', color: theme.text }}>
                  {selectedPOI.name || (
                    selectedPOI.type === 'bus_stop' ? 'Ponto de Ônibus' :
                    selectedPOI.type === 'park' ? 'Praça/Parque' :
                    selectedPOI.type === 'hospital' ? 'Hospital' :
                    selectedPOI.type === 'police' ? 'Delegacia' : 'Local'
                  )}
                </span>
              </div>
            </div>
          </InfoWindow>
          );
        })()}
      </GoogleMap>

      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <Button
          size="icon"
          variant="secondary"
          onClick={() => setShowHeatmap(prev => !prev)}
          className={showHeatmap ? 'bg-primary text-primary-foreground' : ''}
          data-testid="button-toggle-heatmap"
        >
          <Layers className="w-5 h-5" />
        </Button>
        
        <Button
          size="icon"
          variant="secondary"
          onClick={handleGeolocate}
          data-testid="button-geolocate"
        >
          <Navigation className="w-5 h-5" />
        </Button>
        
        <Button
          size="icon"
          variant="secondary"
          onClick={toggleNavigationMode}
          className={navigationMode ? 'bg-primary text-primary-foreground' : ''}
          data-testid="button-navigation-mode"
        >
          <Compass className="w-5 h-5" />
        </Button>
        
        <Button
          size="icon"
          variant="secondary"
          onClick={() => setShowRoutePlanner(prev => !prev)}
          className={showRoutePlanner ? 'bg-primary text-primary-foreground' : ''}
          data-testid="button-route-planner"
        >
          <Navigation2 className="w-5 h-5" />
        </Button>
      </div>

      {showRoutePlanner && (
        <div className="absolute top-[calc(env(safe-area-inset-top)+80px)] sm:top-20 left-4 right-4 sm:left-auto sm:right-4 z-[9999] bg-card p-4 rounded-xl shadow-2xl w-auto sm:w-80 max-h-[calc(100vh-200px)] overflow-y-auto border border-border/50 backdrop-blur-md">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base">Planejador de Rota</h3>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setShowRoutePlanner(false);
                  setRouteCoords(null);
                  setRouteSafety(null);
                  setDestinationMarker(null);
                  setDestinationQuery('');
                }}
                className="h-8 w-8 rounded-full"
                data-testid="button-close-route-planner"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Para onde você vai?"
                  value={destinationQuery}
                  onChange={(e) => setDestinationQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchRoute()}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  data-testid="input-destination"
                />
              </div>

              <Button
                className="w-full h-10 font-bold"
                onClick={handleSearchRoute}
                disabled={isSearchingRoute}
                data-testid="button-search-route"
              >
                {isSearchingRoute ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Navigation2 className="w-4 h-4 mr-2" />
                )}
                {isSearchingRoute ? 'Calculando...' : 'Traçar Rota Segura'}
              </Button>
            </div>
          </div>
          
          {routeSafety && (
            <div className={`mt-4 p-3 rounded-lg border shadow-inner ${
              routeSafety.score >= 70 ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400' :
              routeSafety.score >= 40 ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400' :
              'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'
            }`}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Nível de Segurança</span>
                  <span className="font-bold text-lg">{routeSafety.score}%</span>
                </div>
                <div className="h-1.5 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      routeSafety.score >= 70 ? 'bg-green-500' :
                      routeSafety.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={ { width: `${routeSafety.score}%` } }
                  />
                </div>
                {routeSafety.nearbyDangers > 0 && (
                  <span className="text-xs mt-1 opacity-80">
                    Encontramos {routeSafety.nearbyDangers} alerta{routeSafety.nearbyDangers > 1 ? 's' : ''} nesta rota.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .gm-style-iw-c {
          padding: 0 !important;
        }
        .gm-style-iw-d {
          overflow: hidden !important;
        }
        .gm-ui-hover-effect {
          top: 2px !important;
          right: 2px !important;
        }
      `}</style>
    </div>
  );
}
