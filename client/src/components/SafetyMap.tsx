import { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-rotate";
import "leaflet.heat";
import { Report } from "@shared/schema";
import { format } from "date-fns";
import { Shield, AlertTriangle, Lightbulb, Ghost, HelpCircle, MapPin, ThumbsUp, ThumbsDown, MessageCircle, Flag, Bus, TreePine, Building2, Siren, Flame } from "lucide-react";
import { renderToString } from "react-dom/server";
import { Button } from "./ui/button-custom";
import { useAuth } from "@/hooks/use-auth";
import { useVerifyReport, useDownvoteReport, useFlagReport } from "@/hooks/use-reports";

// Tipos de POI
interface POI {
  id: string;
  lat: number;
  lng: number;
  type: 'bus_stop' | 'park' | 'hospital' | 'police';
  name?: string;
}

// Cache de POIs por bounds
const poiCache = new Map<string, { pois: POI[], timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Busca POIs via Overpass API
async function fetchPOIs(bounds: L.LatLngBounds): Promise<POI[]> {
  const cacheKey = `${bounds.getSouth().toFixed(3)},${bounds.getWest().toFixed(3)},${bounds.getNorth().toFixed(3)},${bounds.getEast().toFixed(3)}`;
  
  const cached = poiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.pois;
  }
  
  const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
  
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

// Ícone pequeno para POI
const createPOIIcon = (type: POI['type']) => {
  const colors = {
    bus_stop: '#3b82f6',
    park: '#22c55e', 
    hospital: '#ef4444',
    police: '#8b5cf6'
  };
  
  const icons = {
    bus_stop: '<path d="M8 6v6h8v-6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2z"/><path d="M18 12H6a2 2 0 0 0-2 2v2h16v-2a2 2 0 0 0-2-2z"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/><path d="M5.5 17.5h13"/>',
    park: '<path d="M12 3l-4 7h8l-4-7z"/><path d="M12 8l-5 9h10l-5-9z"/><rect x="11" y="17" width="2" height="4"/>',
    hospital: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12h6"/><path d="M12 9v6"/>',
    police: '<path d="M12 2l7 4v6c0 5-3 8-7 10-4-2-7-5-7-10V6l7-4z"/>'
  };
  
  const html = `
    <div style="
      width: 24px;
      height: 24px;
      background: ${colors[type]};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    ">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="white" stroke="white" stroke-width="0">
        ${icons[type]}
      </svg>
    </div>
  `;
  
  return L.divIcon({
    html,
    className: 'poi-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

// Componente para exibir POIs no mapa
function POILayer({ showPOIs }: { showPOIs: boolean }) {
  const map = useMap();
  const [pois, setPois] = useState<POI[]>([]);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showPOIsRef = useRef(showPOIs);
  
  // Keep ref in sync with prop
  useEffect(() => {
    showPOIsRef.current = showPOIs;
    if (!showPOIs) {
      setPois([]);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    }
  }, [showPOIs]);
  
  const loadPOIs = useCallback(async () => {
    if (!showPOIsRef.current) return;
    const zoom = map.getZoom();
    if (zoom < 14) {
      setPois([]);
      return;
    }
    
    const bounds = map.getBounds();
    const newPois = await fetchPOIs(bounds);
    if (showPOIsRef.current) {
      setPois(newPois);
    }
  }, [map]);
  
  useMapEvents({
    moveend: () => {
      if (!showPOIsRef.current) return;
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(loadPOIs, 500);
    },
    zoomend: () => {
      if (!showPOIsRef.current) return;
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = setTimeout(loadPOIs, 500);
    }
  });
  
  useEffect(() => {
    if (showPOIs) {
      loadPOIs();
    }
    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [showPOIs, loadPOIs]);
  
  if (!showPOIs) return null;
  
  const poiLabels = {
    bus_stop: 'Ponto de Ônibus',
    park: 'Parque',
    hospital: 'Hospital',
    police: 'Delegacia'
  };
  
  return (
    <>
      {pois.map(poi => (
        <Marker 
          key={poi.id} 
          position={[poi.lat, poi.lng]} 
          icon={createPOIIcon(poi.type)}
        >
          <Popup>
            <div className="text-sm">
              <strong>{poiLabels[poi.type]}</strong>
              {poi.name && <div className="text-muted-foreground">{poi.name}</div>}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}


// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons Generator - Waze-style markers
const createIcon = (type: string) => {
  let iconComponent;
  let bgColor;
  let shadowColor;

  switch (type) {
    case 'assedio':
    case 'harassment':
      iconComponent = <AlertTriangle className="w-4 h-4 text-white" />;
      bgColor = '#ef4444';
      shadowColor = 'rgba(239, 68, 68, 0.4)';
      break;
    case 'iluminacao_precaria':
    case 'poor_lighting':
      iconComponent = <Lightbulb className="w-4 h-4 text-white" />;
      bgColor = '#f59e0b';
      shadowColor = 'rgba(245, 158, 11, 0.4)';
      break;
    case 'deserto':
    case 'deserted':
      iconComponent = <Ghost className="w-4 h-4 text-white" />;
      bgColor = '#6b7280';
      shadowColor = 'rgba(107, 114, 128, 0.4)';
      break;
    case 'abrigo_seguro':
    case 'safe_haven':
      iconComponent = <Shield className="w-4 h-4 text-white" />;
      bgColor = '#22c55e';
      shadowColor = 'rgba(34, 197, 94, 0.4)';
      break;
    default:
      iconComponent = <HelpCircle className="w-4 h-4 text-white" />;
      bgColor = '#8b5cf6';
      shadowColor = 'rgba(139, 92, 246, 0.4)';
  }

  const html = renderToString(
    <div className="waze-marker" style={{ position: 'relative' }}>
      <div 
        style={{
          width: '36px',
          height: '36px',
          backgroundColor: bgColor,
          borderRadius: '50% 50% 50% 0',
          transform: 'rotate(-45deg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 4px 12px ${shadowColor}, 0 2px 4px rgba(0,0,0,0.1)`,
          border: '3px solid white',
        }}
      >
        <div style={{ transform: 'rotate(45deg)' }}>
          {iconComponent}
        </div>
      </div>
    </div>
  );

  return L.divIcon({
    html,
    className: 'custom-marker-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });
};

// Component to handle map clicks for adding reports
function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to locate user with continuous tracking and heading
function UserLocator({ 
  onLocationFound, 
  isNavigationMode,
  onHeadingChange 
}: { 
  onLocationFound: (lat: number, lng: number) => void;
  isNavigationMode: boolean;
  onHeadingChange?: (heading: number) => void;
}) {
  const map = useMap();
  const [position, setPosition] = useState<{lat: number, lng: number} | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (isNavigationMode) {
      // Continuous tracking mode
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setPosition(newPos);
            onLocationFound(newPos.lat, newPos.lng);
            
            // Use heading from GPS if available (when moving)
            if (pos.coords.heading !== null && !isNaN(pos.coords.heading)) {
              setHeading(pos.coords.heading);
              onHeadingChange?.(pos.coords.heading);
            }
            
            // Center map on user
            map.setView([newPos.lat, newPos.lng], map.getZoom(), { animate: true });
          },
          (err) => console.error('Geolocation error:', err),
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );
      }
      
      // Device orientation for compass heading when stationary
      // Permission is already requested in NavigationButton click handler for iOS
      const handleOrientation = (event: DeviceOrientationEvent) => {
        if (event.alpha !== null) {
          const compassHeading = 360 - event.alpha;
          setHeading(compassHeading);
          onHeadingChange?.(compassHeading);
        }
      };
      
      window.addEventListener('deviceorientation', handleOrientation);
      
      return () => {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        window.removeEventListener('deviceorientation', handleOrientation);
      };
    } else {
      // Single location fetch
      map.locate().on("locationfound", function (e) {
        setPosition(e.latlng);
        map.flyTo(e.latlng, 15);
        onLocationFound(e.latlng.lat, e.latlng.lng);
      });
    }
  }, [map, isNavigationMode]);

  if (!position) return null;

  // Create user icon with direction arrow when in navigation mode
  const userIcon = L.divIcon({
    html: renderToString(
      <div style={{ position: 'relative', width: '40px', height: '40px' }}>
        {isNavigationMode && (
          <div 
            style={{
              position: 'absolute',
              top: '-8px',
              left: '50%',
              transform: `translateX(-50%) rotate(${heading}deg)`,
              width: '0',
              height: '0',
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderBottom: '20px solid #3b82f6',
              transformOrigin: 'center 28px',
            }}
          />
        )}
        <div 
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            width: '24px',
            height: '24px',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderRadius: '50%',
            animation: 'pulse 2s infinite',
          }}
        />
        <div 
          style={{
            position: 'absolute',
            top: '14px',
            left: '14px',
            width: '12px',
            height: '12px',
            backgroundColor: '#3b82f6',
            borderRadius: '50%',
            border: '3px solid white',
            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.5)',
          }}
        />
      </div>
    ),
    className: 'custom-marker-icon user-location',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  return <Marker position={position} icon={userIcon} />;
}

// Navigation button - Waze style (bottom left)
function NavigationButton({ 
  userPosition, 
  isNavigationMode, 
  onToggleNavigation,
  onRequestPermission
}: { 
  userPosition: { lat: number; lng: number } | null;
  isNavigationMode: boolean;
  onToggleNavigation: (granted: boolean) => void;
  onRequestPermission?: () => void;
}) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);
  
  const handleClick = async () => {
    if (isNavigationMode) {
      // Turn off navigation mode
      onToggleNavigation(false);
      // Reset map bearing
      if ((map as any).setBearing) {
        (map as any).setBearing(0);
      }
    } else {
      // Request DeviceOrientation permission on iOS 13+ (must be in click handler)
      let permissionGranted = true;
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const response = await (DeviceOrientationEvent as any).requestPermission();
          permissionGranted = response === 'granted';
        } catch (err) {
          console.error('DeviceOrientation permission error:', err);
          permissionGranted = false;
        }
      }
      
      // Turn on navigation mode
      if (userPosition) {
        map.flyTo([userPosition.lat, userPosition.lng], 16, { duration: 1 });
      }
      onToggleNavigation(permissionGranted);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="leaflet-bottom leaflet-left" 
      style={{ marginBottom: '24px', marginLeft: '16px' }}
    >
      <div className="leaflet-control">
        <button
          onClick={handleClick}
          className={`backdrop-blur w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 border ${
            isNavigationMode 
              ? 'bg-blue-600 border-blue-400 hover:bg-blue-500' 
              : 'bg-gray-900/90 border-gray-700 hover:bg-gray-800'
          }`}
          title={isNavigationMode ? "Desativar navegação" : "Ativar navegação"}
          data-testid="button-navigation"
        >
          {isNavigationMode ? (
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// Tile URLs for day/night modes
const TILE_URLS = {
  day: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  night: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
};

// Componente HeatmapLayer para visualizar densidade de relatos
function HeatmapLayer({ reports, showHeatmap }: { reports: Report[]; showHeatmap: boolean }) {
  const map = useMap();
  const heatLayerRef = useRef<L.HeatLayer | null>(null);

  useEffect(() => {
    if (!showHeatmap) {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      return;
    }

    // Criar pontos de calor com intensidade baseada na severidade
    const heatPoints: [number, number, number][] = reports.map(report => {
      // Intensidade baseada na severidade (1-5) e tipo
      let intensity = (report.severity || 1) / 5;
      // Relatos de assédio têm mais peso
      if (report.type === 'assedio') intensity *= 1.5;
      // Abrigos seguros têm intensidade negativa (verde)
      if (report.type === 'abrigo_seguro') intensity = 0.1;
      return [report.lat, report.lng, Math.min(intensity, 1)];
    });

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }

    // Criar layer de heatmap
    heatLayerRef.current = (L as any).heatLayer(heatPoints, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      max: 1.0,
      gradient: {
        0.0: '#22c55e', // Verde (seguro)
        0.3: '#eab308', // Amarelo
        0.5: '#f97316', // Laranja
        0.7: '#ef4444', // Vermelho
        1.0: '#991b1b', // Vermelho escuro (muito perigoso)
      }
    });

    if (heatLayerRef.current) {
      heatLayerRef.current.addTo(map);
    }

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, reports, showHeatmap]);

  return null;
}

// Botão de toggle para Heatmap
function HeatmapToggleButton({ showHeatmap, onToggle }: { showHeatmap: boolean; onToggle: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  return (
    <div 
      ref={containerRef}
      className="absolute top-4 right-4 z-[1000]"
    >
      <button
        onClick={onToggle}
        className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center border transition-all
          ${showHeatmap 
            ? 'bg-orange-600 border-orange-400 text-white' 
            : 'bg-gray-900/90 border-gray-700 text-white hover:bg-gray-800'
          }`}
        title={showHeatmap ? "Ocultar mapa de calor" : "Mostrar mapa de calor"}
        data-testid="button-toggle-heatmap"
      >
        <Flame className="w-5 h-5" />
      </button>
    </div>
  );
}

interface SafetyMapProps {
  reports: Report[];
  onAddReport: (lat: number, lng: number) => void;
  onViewReport: (id: number) => void;
  className?: string;
  isNightMode?: boolean;
}

export function SafetyMap({ reports, onAddReport, onViewReport, className, isNightMode = false }: SafetyMapProps) {
  const { user } = useAuth();
  const { mutate: verifyReport, isPending: isVerifying } = useVerifyReport();
  const { mutate: downvoteReport, isPending: isDownvoting } = useDownvoteReport();
  const { mutate: flagReport, isPending: isFlagging } = useFlagReport();
  const [mapCenter, setMapCenter] = useState<[number, number]>([-23.5505, -46.6333]); // Default SP
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isNavigationMode, setIsNavigationMode] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  
  const handleFlag = (reportId: number) => {
    if (!user) return;
    flagReport({ reportId, reason: 'falso' });
  };

  const handleHeadingChange = (heading: number) => {
    if (mapRef.current && isNavigationMode && (mapRef.current as any).setBearing) {
      (mapRef.current as any).setBearing(-heading);
    }
  };

  const tileUrl = isNightMode ? TILE_URLS.night : TILE_URLS.day;

  return (
    <div className={className}>
      <MapContainer 
        center={mapCenter} 
        zoom={13} 
        className="w-full h-full z-0"
        zoomControl={false}
        ref={mapRef}
        {...{
          rotate: true,
          touchRotate: true,
          shiftKeyRotate: true,
          bearing: 0
        } as any}
      >
        <TileLayer
          key={isNightMode ? 'night' : 'day'}
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url={tileUrl}
        />
        
        <UserLocator 
          onLocationFound={(lat, lng) => {
            setMapCenter([lat, lng]);
            setUserPosition({ lat, lng });
          }}
          isNavigationMode={isNavigationMode}
          onHeadingChange={handleHeadingChange}
        />
        
        <NavigationButton 
          userPosition={userPosition} 
          isNavigationMode={isNavigationMode}
          onToggleNavigation={(granted) => setIsNavigationMode(!isNavigationMode)}
        />
        
        <POILayer showPOIs={true} />
        
        <HeatmapLayer reports={reports} showHeatmap={showHeatmap} />
        <HeatmapToggleButton showHeatmap={showHeatmap} onToggle={() => setShowHeatmap(!showHeatmap)} />
        
        <MapEvents onMapClick={onAddReport} />

        {reports.map((report) => (
          <Marker 
            key={report.id} 
            position={[report.lat, report.lng]} 
            icon={createIcon(report.type)}
          >
            <Popup className="rounded-xl overflow-hidden shadow-xl border-0">
              <div className="p-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase text-white
                    ${report.type === 'assedio' ? 'bg-destructive' : 
                      report.type === 'abrigo_seguro' ? 'bg-[hsl(var(--safe))]' :
                      report.type === 'iluminacao_precaria' ? 'bg-[hsl(var(--warning))]' : 'bg-gray-500'}`
                  }>
                    {report.type.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {format(new Date(report.createdAt!), 'd MMM, HH:mm')}
                  </span>
                </div>
                
                <p className="text-sm font-medium mb-3 line-clamp-3">{report.description}</p>
                
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 text-[hsl(var(--safe))]">
                      <ThumbsUp className="w-3 h-3" />
                      {report.verifiedCount}
                    </span>
                    <span className="flex items-center gap-1 text-destructive">
                      <ThumbsDown className="w-3 h-3" />
                      {report.downvoteCount || 0}
                    </span>
                  </div>
                  
                  <div className="flex gap-1">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        verifyReport(report.id);
                      }}
                      disabled={isVerifying || !user}
                      title="Confirmar precisão"
                      data-testid={`button-verify-${report.id}`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        downvoteReport(report.id);
                      }}
                      disabled={isDownvoting || !user}
                      title="Não é mais preciso"
                      data-testid={`button-downvote-${report.id}`}
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFlag(report.id);
                      }}
                      disabled={isFlagging || !user}
                      title="Denunciar relato falso"
                      data-testid={`button-flag-${report.id}`}
                    >
                      <Flag className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="primary" 
                      className="h-8 px-3 text-xs"
                      onClick={() => onViewReport(report.id)}
                      data-testid={`button-details-${report.id}`}
                    >
                      Detalhes
                    </Button>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
