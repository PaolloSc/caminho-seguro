import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import "leaflet-rotate";
import { Report } from "@shared/schema";
import { format } from "date-fns";
import { Shield, AlertTriangle, Lightbulb, Ghost, HelpCircle, MapPin, ThumbsUp, ThumbsDown, Flag, Bus, TreePine, Building2, Siren, Layers, Navigation2, Search, Loader2, Navigation, Compass, X } from "lucide-react";
import { Button } from "./ui/button-custom";
import { useAuth } from "@/hooks/use-auth";
import { useVerifyReport, useDownvoteReport, useFlagReport } from "@/hooks/use-reports";
import { useToast } from "@/hooks/use-toast";
import { useNavigationMode } from "@/hooks/use-navigation-mode";
import { renderToStaticMarkup } from "react-dom/server";

// Fix Leaflet marker icons
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface POI {
  id: string;
  lat: number;
  lng: number;
  type: 'bus_stop' | 'park' | 'hospital' | 'police';
  name?: string;
}

const poiCache = new Map<string, { pois: POI[], timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

async function fetchPOIs(bounds: L.LatLngBounds): Promise<POI[]> {
  const south = bounds.getSouth();
  const west = bounds.getWest();
  const north = bounds.getNorth();
  const east = bounds.getEast();
  
  const cacheKey = `${south.toFixed(3)},${west.toFixed(3)},${north.toFixed(3)},${east.toFixed(3)}`;
  
  const cached = poiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.pois;
  }
  
  const bbox = `${south},${west},${north},${east}`;
  
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

async function fetchRoute(start: [number, number], end: [number, number]): Promise<[number, number][] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/foot/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes?.[0]) {
      const coords = data.routes[0].geometry.coordinates;
      return coords.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar rota:', error);
    return null;
  }
}

function calculateRouteSafety(route: [number, number][], reports: Report[]): { score: number; nearbyDangers: number; totalSeverity: number } {
  const dangerRadius = 0.002;
  const dangerReportsNearRoute = new Set<number>();
  let totalSeverity = 0;
  
  for (const report of reports) {
    if (report.type === 'abrigo_seguro') continue;
    
    for (const point of route) {
      const dist = Math.sqrt(Math.pow(point[0] - report.lat, 2) + Math.pow(point[1] - report.lng, 2));
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

// Map Component Helpers
function MapEvents({ onMoveEnd, onClick }: { onMoveEnd: () => void, onClick: (e: L.LeafletMouseEvent) => void }) {
  useMapEvents({
    moveend: onMoveEnd,
    click: onClick,
  });
  return null;
}

function HeatmapLayer({ reports, visible }: { reports: Report[], visible: boolean }) {
  const map = useMap();
  const heatmapLayerRef = useRef<any>(null);

  useEffect(() => {
    if (!visible) {
      if (heatmapLayerRef.current) {
        map.removeLayer(heatmapLayerRef.current);
        heatmapLayerRef.current = null;
      }
      return;
    }

    const points = reports.map(r => {
      const intensity = r.type === 'abrigo_seguro' ? 0.2 : 
                        r.type === 'assedio' ? (r.severity || 3) / 3 : 
                        (r.severity || 3) / 5;
      return [r.lat, r.lng, intensity];
    });

    // @ts-ignore
    heatmapLayerRef.current = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: {
        0.2: 'rgba(34, 197, 94, 0.4)',
        0.4: 'rgba(234, 179, 8, 0.6)',
        0.6: 'rgba(249, 115, 22, 0.8)',
        0.8: 'rgba(239, 68, 68, 0.9)',
        1.0: 'rgba(153, 27, 27, 1)'
      }
    }).addTo(map);

    return () => {
      if (heatmapLayerRef.current) {
        map.removeLayer(heatmapLayerRef.current);
      }
    };
  }, [reports, visible, map]);

  return null;
}

interface NavigationControllerProps {
  enabled: boolean;
  onPositionUpdate: (lat: number, lng: number) => void;
  getZoomForSpeed: (speed: number | null) => number;
  position: {
    lat: number;
    lng: number;
    heading: number | null;
    speed: number | null;
  } | null;
}

function NavigationController({ enabled, onPositionUpdate, getZoomForSpeed, position }: NavigationControllerProps) {
  const map = useMap();
  const animationRef = useRef<number | null>(null);
  const currentBearingRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || !position) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (map) {
        // Always reset bearing and CSS variable when disabled
        // @ts-ignore - leaflet-rotate extends L.Map
        if (typeof map.setBearing === 'function' && currentBearingRef.current !== 0) {
          // @ts-ignore
          map.setBearing(0);
        }
        // Always reset CSS variable
        map.getContainer().style.setProperty('--bearing', '0deg');
        currentBearingRef.current = 0;
      }
      return;
    }

    const targetBearing = position.heading ?? 0;
    const targetZoom = getZoomForSpeed(position.speed);
    const targetLatLng = L.latLng(position.lat, position.lng);

    onPositionUpdate(position.lat, position.lng);

    const animate = () => {
      const diff = targetBearing - currentBearingRef.current;
      const shortestDiff = ((diff + 540) % 360) - 180;
      
      if (Math.abs(shortestDiff) > 0.5) {
        currentBearingRef.current += shortestDiff * 0.15;
        currentBearingRef.current = ((currentBearingRef.current % 360) + 360) % 360;
      } else {
        currentBearingRef.current = targetBearing;
      }

      // @ts-ignore - leaflet-rotate extends L.Map
      if (typeof map.setBearing === 'function') {
        // @ts-ignore
        map.setBearing(currentBearingRef.current);
        
        // Set CSS variable for counter-rotation of markers
        const container = map.getContainer();
        container.style.setProperty('--bearing', `${currentBearingRef.current}deg`);
      }

      map.setView(targetLatLng, targetZoom, { animate: true, duration: 0.5 });

      if (enabled) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, position, map, getZoomForSpeed, onPositionUpdate]);

  return null;
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
  const { toast } = useToast();
  const { mutate: verifyReport, isPending: isVerifying } = useVerifyReport();
  const { mutate: downvoteReport, isPending: isDownvoting } = useDownvoteReport();
  const { mutate: flagReport, isPending: isFlagging } = useFlagReport();
  
  const [map, setMap] = useState<L.Map | null>(null);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showPOIs, setShowPOIs] = useState(true);
  const [pois, setPois] = useState<POI[]>([]);
  
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [isSearchingRoute, setIsSearchingRoute] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [routeSafety, setRouteSafety] = useState<{ score: number; nearbyDangers: number; totalSeverity: number } | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<[number, number] | null>(null);
  const [navigationMode, setNavigationMode] = useState(false);

  const { position: navPosition, isTracking, getZoomForSpeed } = useNavigationMode({
    enabled: navigationMode
  });

  const handlePositionUpdate = useCallback((lat: number, lng: number) => {
    setUserPosition({ lat, lng });
  }, []);

  const toggleNavigationMode = useCallback(() => {
    setNavigationMode(prev => !prev);
    if (!navigationMode && !userPosition && map) {
      map.locate({ setView: true, maxZoom: 18 });
    }
  }, [navigationMode, userPosition, map]);

  const refreshPOIs = useCallback(() => {
    if (!showPOIs || !map) return;
    
    const bounds = map.getBounds();
    fetchPOIs(bounds).then(setPois);
  }, [showPOIs, map]);

  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    setSelectedReport(null);
    setSelectedPOI(null);
    onAddReport(e.latlng.lat, e.latlng.lng);
  }, [onAddReport]);

  const geolocateClickRef = useRef<{ timer: NodeJS.Timeout | null; clicks: number }>({ timer: null, clicks: 0 });
  
  const handleGeolocate = () => {
    if (!map) return;
    
    geolocateClickRef.current.clicks++;
    
    if (geolocateClickRef.current.timer) {
      clearTimeout(geolocateClickRef.current.timer);
    }
    
    geolocateClickRef.current.timer = setTimeout(() => {
      const clicks = geolocateClickRef.current.clicks;
      geolocateClickRef.current.clicks = 0;
      geolocateClickRef.current.timer = null;
      
      const currentZoom = map.getZoom();
      const isZoomOut = clicks >= 2;
      const newZoom = isZoomOut 
        ? Math.max(currentZoom - 2, 10) 
        : Math.min(currentZoom + 2, 19);
      
      const centerOnPosition = (lat: number, lng: number) => {
        map.setView([lat, lng], newZoom, { animate: true });
        setTimeout(() => map.invalidateSize(), 100);
      };
      
      if (userPosition) {
        centerOnPosition(userPosition.lat, userPosition.lng);
      } else {
        map.locate({ setView: true, maxZoom: newZoom });
      }
    }, 300);
  };

  const [isInitialAnimation, setIsInitialAnimation] = useState(true);

  useEffect(() => {
    if (map && isInitialAnimation) {
      // Começa de longe e descentralizado (ex: Brasília ou visão geral do Brasil)
      map.setView([-15.7801, -47.9292], 4, { animate: false });
      
      // Timer para iniciar a animação de aproximação
      const timer = setTimeout(() => {
        if (userPosition) {
          map.flyTo([userPosition.lat, userPosition.lng], 16, {
            duration: 3,
            easeLinearity: 0.25
          });
        } else {
          // Fallback para BH se não tiver localização ainda
          map.flyTo([-19.9167, -43.9345], 16, {
            duration: 3,
            easeLinearity: 0.25
          });
        }
        setIsInitialAnimation(false);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [map, isInitialAnimation, userPosition]);

  useEffect(() => {
    if (map) {
      map.on('locationfound', (e) => {
        setUserPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }
  }, [map]);

  const handleSearchRoute = async () => {
    if (!userPosition || !destinationQuery.trim()) return;
    
    setIsSearchingRoute(true);
    setRouteCoords(null);
    setRouteSafety(null);
    
    try {
      const destination = await geocodeAddress(destinationQuery);
      if (!destination) {
        toast({
          title: "Endereço não encontrado",
          description: "Não foi possível encontrar o endereço. Tente ser mais específica.",
          variant: "destructive"
        });
        return;
      }
      
      setDestinationMarker([destination.lat, destination.lng]);
      
      const route = await fetchRoute(
        [userPosition.lat, userPosition.lng],
        [destination.lat, destination.lng]
      );
      
      if (!route) {
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
        map.fitBounds(L.polyline(route).getBounds(), { padding: [50, 50] });
      }
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

  const createReportIcon = (report: Report) => {
    const Icon = getReportIcon(report.type);
    const color = REPORT_COLORS[report.type] || '#6b7280';
    
    return L.divIcon({
      className: 'custom-marker-icon',
      html: renderToStaticMarkup(
        <div 
          className="cursor-pointer transition-transform hover:scale-110"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon className="w-4 h-4 text-white" />
        </div>
      ),
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const createPOIIcon = (poi: POI) => {
    const Icon = getPOIIcon(poi.type);
    const color = POI_COLORS[poi.type];
    
    return L.divIcon({
      className: 'custom-marker-icon',
      html: renderToStaticMarkup(
        <div
          className="cursor-pointer transition-transform hover:scale-110"
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            backgroundColor: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon className="w-3 h-3 text-white" />
        </div>
      ),
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  };

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <MapContainer
        center={[-19.8095, -43.9345]}
        zoom={18}
        scrollWheelZoom={true}
        className="w-full h-full"
        ref={setMap}
        zoomControl={false}
        // @ts-ignore - leaflet-rotate options
        rotate={true}
        rotateControl={false}
        touchRotate={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={isNightMode 
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          }
        />
        
        <MapEvents onMoveEnd={refreshPOIs} onClick={handleMapClick} />
        <HeatmapLayer reports={reports} visible={showHeatmap} />
        <NavigationController 
          enabled={navigationMode}
          onPositionUpdate={handlePositionUpdate}
          getZoomForSpeed={getZoomForSpeed}
          position={navPosition}
        />

        {/* User Location Marker */}
        {userPosition && (
          <Marker
            position={[userPosition.lat, userPosition.lng]}
            icon={L.divIcon({
              className: 'user-location-icon',
              html: `<div class="user-marker-dot"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })}
          />
        )}

        {/* Route Visualization */}
        {routeCoords && (
          <Polyline
            positions={routeCoords}
            pathOptions={{
              color: routeSafety && routeSafety.score >= 70 ? '#22c55e' : 
                     routeSafety && routeSafety.score >= 40 ? '#eab308' : '#ef4444',
              weight: 6,
              opacity: 0.8
            }}
          />
        )}

        {/* Danger Reports Markers */}
        {reports.map(report => (
          <Marker
            key={report.id}
            position={[report.lat, report.lng]}
            icon={createReportIcon(report)}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                setSelectedReport(report);
                setSelectedPOI(null);
              }
            }}
          >
            {selectedReport?.id === report.id && (
              <Popup offset={[0, -10]} className="safety-popup">
                <div className="p-2 min-w-[220px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase text-white
                      ${selectedReport.type === 'assedio' ? 'bg-destructive' : 
                        selectedReport.type === 'abrigo_seguro' ? 'bg-[hsl(var(--safe))]' :
                        selectedReport.type === 'iluminacao_precaria' ? 'bg-[hsl(var(--warning))]' : 'bg-gray-500'}`
                    }>
                      {selectedReport.type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(selectedReport.createdAt!), 'd MMM, HH:mm')}
                    </span>
                  </div>
                  <p className="text-sm font-medium mb-3 line-clamp-3">{selectedReport.description}</p>
                  <Button 
                    size="sm" 
                    variant="primary" 
                    className="w-full h-8 text-xs"
                    onClick={() => onViewReport(selectedReport.id)}
                  >
                    Ver Detalhes
                  </Button>
                </div>
              </Popup>
            )}
          </Marker>
        ))}

        {/* POI Markers */}
        {showPOIs && pois.map(poi => (
          <Marker
            key={poi.id}
            position={[poi.lat, poi.lng]}
            icon={createPOIIcon(poi)}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                setSelectedPOI(poi);
                setSelectedReport(null);
              }
            }}
          >
            {selectedPOI?.id === poi.id && (
              <Popup offset={[0, -5]} className="poi-popup">
                <div className="p-2 min-w-[150px]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {poi.name || (
                        poi.type === 'bus_stop' ? 'Ponto de Ônibus' :
                        poi.type === 'park' ? 'Parque' :
                        poi.type === 'hospital' ? 'Hospital' :
                        poi.type === 'police' ? 'Polícia' : 'Local'
                      )}
                    </span>
                  </div>
                </div>
              </Popup>
            )}
          </Marker>
        ))}

        {/* Destination Marker */}
        {destinationMarker && (
          <Marker 
            position={destinationMarker}
            icon={L.divIcon({
              className: 'custom-marker-icon',
              html: renderToStaticMarkup(
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#3b82f6',
                    border: '3px solid white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <MapPin className="w-4 h-4 text-white" />
                </div>
              ),
              iconSize: [32, 32],
              iconAnchor: [16, 32],
            })}
          />
        )}
      </MapContainer>

      {/* Floating Controls */}
      <div className="absolute top-20 right-4 z-[1000] flex flex-col gap-2">
        <Button 
          variant="outline" 
          size="icon" 
          className={`shadow-md hover-elevate rounded-full h-11 w-11 ${showRoutePlanner ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
          onClick={() => setShowRoutePlanner(!showRoutePlanner)}
          title="Para onde vamos?"
          data-testid="button-toggle-route-planner"
        >
          <Navigation className={`h-5 w-5 ${showRoutePlanner ? '' : 'text-primary'}`} />
        </Button>
        <Button 
          variant="outline" 
          size="icon" 
          className="bg-background shadow-md hover-elevate rounded-full h-11 w-11"
          onClick={() => setShowHeatmap(!showHeatmap)}
          title={showHeatmap ? "Ocultar Mapa de Calor" : "Mostrar Mapa de Calor"}
        >
          <Layers className={`h-5 w-5 ${showHeatmap ? 'text-primary' : 'text-muted-foreground'}`} />
        </Button>
        <Button 
          variant="outline" 
          size="icon" 
          className="bg-background shadow-md hover-elevate rounded-full h-11 w-11"
          onClick={handleGeolocate}
          title="Minha Localização"
          data-testid="button-geolocate"
        >
          <Navigation2 className="h-5 w-5" />
        </Button>
        <Button 
          variant="outline" 
          size="icon" 
          className={`shadow-md hover-elevate rounded-full h-11 w-11 ${navigationMode ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
          onClick={toggleNavigationMode}
          title={navigationMode ? "Desativar Modo Navegação" : "Ativar Modo Navegação (Estilo Waze)"}
          data-testid="button-navigation-mode"
        >
          <Compass className={`h-5 w-5 ${navigationMode ? 'animate-pulse' : ''}`} />
        </Button>
      </div>

      {/* Route Planner Overlay */}
      {showRoutePlanner && (
        <div className="absolute top-20 left-4 right-4 md:right-auto md:w-full md:max-w-[320px] z-[1000]">
          <div className="bg-background/95 backdrop-blur-sm p-3 rounded-lg shadow-xl border border-border pointer-events-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold font-display px-1">Para onde vamos?</h3>
              <Button 
                size="icon" 
                variant="ghost"
                className="h-8 w-8" 
                onClick={() => setShowRoutePlanner(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Para onde vamos agora?"
                  className="w-full bg-muted/50 rounded-md py-2 pl-8 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={destinationQuery}
                  onChange={(e) => setDestinationQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchRoute()}
                />
              </div>
              <Button 
                size="icon" 
                className="h-9 w-9" 
                onClick={handleSearchRoute}
                disabled={isSearchingRoute}
              >
                {isSearchingRoute ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {routeSafety && (
              <div className={`mt-3 p-3 rounded-md border ${
                routeSafety.score >= 70 ? 'bg-green-500/10 border-green-500/20' : 
                routeSafety.score >= 40 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase opacity-70 tracking-wider">Score de Segurança</span>
                  <span className={`text-lg font-bold ${
                    routeSafety.score >= 70 ? 'text-green-600' : 
                    routeSafety.score >= 40 ? 'text-yellow-600' : 'text-red-600'
                  }`}>{routeSafety.score}/100</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {routeSafety.nearbyDangers > 0 
                    ? `${routeSafety.nearbyDangers} alertas próximos encontrados nesta rota.`
                    : "Nenhum alerta crítico encontrado nesta rota."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}