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

export function GoogleSafetyMap({ reports, onAddReport, onViewReport, className, isNightMode = false }: SafetyMapProps) {
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

  const { data: mapsConfig, isLoading: isLoadingConfig } = useMapsConfig();
  const apiKey = mapsConfig?.apiKey || '';
  
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries
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
        () => {}
      );
    }
  }, [navigationMode, userPosition, map]);

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
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, [map, isInitialAnimation]);

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
      
      setDestinationMarker({ lat: destination.lat, lng: destination.lng });
      
      const route = await fetchRoute(
        userPosition,
        { lat: destination.lat, lng: destination.lng }
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
        const bounds = new google.maps.LatLngBounds();
        route.forEach(point => bounds.extend(point));
        map.fitBounds(bounds, 50);
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
        }
      );
    }
  };

  const createMarkerIcon = (color: string, size: number = 32): google.maps.Symbol => ({
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 2,
    scale: size / 4,
  });

  if (isLoadingConfig || !apiKey) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando configurações...</span>
      </div>
    );
  }

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
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={defaultCenter}
        zoom={15}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        onIdle={refreshPOIs}
        options={{
          zoomControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          styles: isNightMode ? darkMapStyles : undefined,
          gestureHandling: 'greedy',
        }}
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

        {routeCoords && (
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
            icon={createMarkerIcon(REPORT_COLORS[report.type] || '#6b7280')}
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
            icon={createMarkerIcon(POI_COLORS[poi.type], 22)}
            onClick={() => {
              setSelectedPOI(poi);
              setSelectedReport(null);
            }}
          />
        ))}

        {selectedReport && (
          <InfoWindow
            position={{ lat: selectedReport.lat, lng: selectedReport.lng }}
            onCloseClick={() => setSelectedReport(null)}
          >
            <div className="p-2 min-w-[220px]">
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: REPORT_COLORS[selectedReport.type] }}
                >
                  {(() => {
                    const Icon = getReportIcon(selectedReport.type);
                    return <Icon className="w-3 h-3 text-white" />;
                  })()}
                </div>
                <span className="font-medium text-sm text-foreground">
                  {selectedReport.type === 'assedio' && 'Assédio'}
                  {selectedReport.type === 'iluminacao_precaria' && 'Iluminação Precária'}
                  {selectedReport.type === 'local_deserto' && 'Local Deserto'}
                  {selectedReport.type === 'abrigo_seguro' && 'Abrigo Seguro'}
                </span>
              </div>
              
              {selectedReport.description && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-3">
                  {selectedReport.description}
                </p>
              )}
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <span>{selectedReport.createdAt ? format(new Date(selectedReport.createdAt), 'dd/MM/yyyy HH:mm') : ''}</span>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-3 h-3" />
                  {selectedReport.verifiedCount || 0}
                </span>
              </div>
              
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => verifyReport(selectedReport.id)}
                  disabled={isVerifying || !user}
                  className="text-xs h-7"
                  data-testid="button-verify-report"
                >
                  <ThumbsUp className="w-3 h-3 mr-1" />
                  Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => downvoteReport(selectedReport.id)}
                  disabled={isDownvoting || !user}
                  className="text-xs h-7"
                  data-testid="button-downvote-report"
                >
                  <ThumbsDown className="w-3 h-3 mr-1" />
                  Negar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => flagReport({ reportId: selectedReport.id, reason: 'falso' })}
                  disabled={isFlagging || !user}
                  className="text-xs h-7 text-destructive hover:text-destructive"
                  data-testid="button-flag-report"
                >
                  <Flag className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onViewReport(selectedReport.id)}
                  className="text-xs h-7 ml-auto"
                  data-testid="button-view-report-details"
                >
                  Detalhes
                </Button>
              </div>
            </div>
          </InfoWindow>
        )}

        {selectedPOI && (
          <InfoWindow
            position={{ lat: selectedPOI.lat, lng: selectedPOI.lng }}
            onCloseClick={() => setSelectedPOI(null)}
          >
            <div className="p-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: POI_COLORS[selectedPOI.type] }}
                >
                  {(() => {
                    const Icon = getPOIIcon(selectedPOI.type);
                    return <Icon className="w-3 h-3 text-white" />;
                  })()}
                </div>
                <span className="font-medium text-sm">
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
        )}
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
        <div className="absolute top-4 left-4 right-20 z-10 bg-card p-3 rounded-lg shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Para onde você vai?"
                value={destinationQuery}
                onChange={(e) => setDestinationQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchRoute()}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border bg-background"
                data-testid="input-destination"
              />
            </div>
            <Button
              size="sm"
              onClick={handleSearchRoute}
              disabled={isSearchingRoute || !userPosition}
              data-testid="button-search-route"
            >
              {isSearchingRoute ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
            </Button>
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
              data-testid="button-close-route-planner"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {routeSafety && (
            <div className={`p-2 rounded-md text-sm ${
              routeSafety.score >= 70 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
              routeSafety.score >= 40 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">Segurança da rota: {routeSafety.score}%</span>
                {routeSafety.nearbyDangers > 0 && (
                  <span className="text-xs">
                    {routeSafety.nearbyDangers} alerta{routeSafety.nearbyDangers > 1 ? 's' : ''} próximo{routeSafety.nearbyDangers > 1 ? 's' : ''}
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
