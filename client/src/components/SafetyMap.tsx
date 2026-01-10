import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Map as MapGL, Marker, Popup, Source, Layer, NavigationControl, GeolocateControl } from "react-map-gl/maplibre";
import type { MapRef, MarkerDragEvent, GeolocateResultEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Report } from "@shared/schema";
import { format } from "date-fns";
import { Shield, AlertTriangle, Lightbulb, Ghost, HelpCircle, MapPin, ThumbsUp, ThumbsDown, Flag, Flame, Navigation, X, Search, Loader2, Bus, TreePine, Building2, Siren } from "lucide-react";
import { Button } from "./ui/button-custom";
import { useAuth } from "@/hooks/use-auth";
import { useVerifyReport, useDownvoteReport, useFlagReport } from "@/hooks/use-reports";
import { useToast } from "@/hooks/use-toast";

interface POI {
  id: string;
  lat: number;
  lng: number;
  type: 'bus_stop' | 'park' | 'hospital' | 'police';
  name?: string;
}

const poiCache = new Map<string, { pois: POI[], timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

async function fetchPOIs(bounds: { north: number; south: number; east: number; west: number }): Promise<POI[]> {
  const cacheKey = `${bounds.south.toFixed(3)},${bounds.west.toFixed(3)},${bounds.north.toFixed(3)},${bounds.east.toFixed(3)}`;
  
  const cached = poiCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.pois;
  }
  
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  
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

const MAP_STYLES = {
  day: 'https://tiles.openfreemap.org/styles/liberty',
  night: 'https://tiles.openfreemap.org/styles/dark'
};

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
  
  const mapRef = useRef<MapRef>(null);
  const geolocateRef = useRef<any>(null);
  
  const [viewState, setViewState] = useState({
    longitude: -43.9345,
    latitude: -19.8095,
    zoom: 16
  });
  
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showPOIs, setShowPOIs] = useState(true);
  const [pois, setPois] = useState<POI[]>([]);
  
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [isSearchingRoute, setIsSearchingRoute] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [routeSafety, setRouteSafety] = useState<{ score: number; nearbyDangers: number; totalSeverity: number } | null>(null);
  const [destinationMarker, setDestinationMarker] = useState<[number, number] | null>(null);

  const handleFlag = (reportId: number) => {
    if (!user) return;
    flagReport({ reportId, reason: 'falso' });
  };

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
        setIsSearchingRoute(false);
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
        setIsSearchingRoute(false);
        return;
      }
      
      setRouteCoords(route);
      const safety = calculateRouteSafety(route, reports);
      setRouteSafety(safety);
      
      if (mapRef.current && route.length > 0) {
        const lngs = route.map(r => r[1]);
        const lats = route.map(r => r[0]);
        mapRef.current.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 50, duration: 1000 }
        );
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

  const clearRoute = () => {
    setRouteCoords(null);
    setRouteSafety(null);
    setDestinationMarker(null);
    setDestinationQuery('');
    setShowRoutePlanner(false);
  };

  const handleMapClick = useCallback((e: any) => {
    if (e.originalEvent.target === e.target.getCanvas()) {
      onAddReport(e.lngLat.lat, e.lngLat.lng);
    }
  }, [onAddReport]);

  const handleGeolocate = useCallback((e: GeolocateResultEvent) => {
    setUserPosition({
      lat: e.coords.latitude,
      lng: e.coords.longitude
    });
    setViewState(prev => ({
      ...prev,
      latitude: e.coords.latitude,
      longitude: e.coords.longitude,
      zoom: 17
    }));
  }, []);

  const refreshPOIs = useCallback(() => {
    if (!showPOIs || !mapRef.current) return;
    
    const map = mapRef.current.getMap();
    const bounds = map.getBounds();
    if (!bounds) return;
    
    fetchPOIs({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    }).then(setPois);
  }, [showPOIs]);

  useEffect(() => {
    refreshPOIs();
  }, [showPOIs, refreshPOIs]);

  const handleMoveEnd = useCallback(() => {
    if (showPOIs) {
      refreshPOIs();
    }
  }, [showPOIs, refreshPOIs]);

  const heatmapData = useMemo(() => {
    if (!showHeatmap) return null;
    
    return {
      type: 'FeatureCollection' as const,
      features: reports.map(report => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [report.lng, report.lat]
        },
        properties: {
          intensity: report.type === 'abrigo_seguro' ? 0.2 : 
                     report.type === 'assedio' ? (report.severity || 3) / 3 : 
                     (report.severity || 3) / 5
        }
      }))
    };
  }, [reports, showHeatmap]);

  const routeGeoJSON = useMemo(() => {
    if (!routeCoords) return null;
    
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: routeCoords.map(c => [c[1], c[0]])
      },
      properties: {}
    };
  }, [routeCoords]);

  const mapStyle = isNightMode ? MAP_STYLES.night : MAP_STYLES.day;

  return (
    <div className={className}>
      <MapGL
        ref={mapRef}
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        onMoveEnd={handleMoveEnd}
        onClick={handleMapClick}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" />
        <GeolocateControl 
          ref={geolocateRef}
          position="bottom-right"
          trackUserLocation
          fitBoundsOptions={{ maxZoom: 17 }}
          onGeolocate={handleGeolocate}
        />
        
        {showHeatmap && heatmapData && (
          <Source id="heatmap-source" type="geojson" data={heatmapData}>
            <Layer
              id="heatmap-layer"
              type="heatmap"
              paint={{
                'heatmap-weight': ['get', 'intensity'],
                'heatmap-intensity': 1,
                'heatmap-color': [
                  'interpolate',
                  ['linear'],
                  ['heatmap-density'],
                  0, 'rgba(34, 197, 94, 0)',
                  0.2, 'rgba(34, 197, 94, 0.4)',
                  0.4, 'rgba(234, 179, 8, 0.6)',
                  0.6, 'rgba(249, 115, 22, 0.8)',
                  0.8, 'rgba(239, 68, 68, 0.9)',
                  1, 'rgba(153, 27, 27, 1)'
                ],
                'heatmap-radius': 30,
                'heatmap-opacity': 0.7
              }}
            />
          </Source>
        )}
        
        {routeGeoJSON && (
          <Source id="route-source" type="geojson" data={routeGeoJSON}>
            <Layer
              id="route-layer"
              type="line"
              paint={{
                'line-color': routeSafety && routeSafety.score >= 70 ? '#22c55e' : 
                              routeSafety && routeSafety.score >= 40 ? '#eab308' : '#ef4444',
                'line-width': 6,
                'line-opacity': 0.8
              }}
            />
          </Source>
        )}
        
        {reports.map(report => {
          const Icon = getReportIcon(report.type);
          const color = REPORT_COLORS[report.type] || '#6b7280';
          
          return (
            <Marker
              key={report.id}
              longitude={report.lng}
              latitude={report.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelectedReport(report);
              }}
            >
              <div 
                className="cursor-pointer transition-transform hover:scale-110"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: '3px solid white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                data-testid={`marker-report-${report.id}`}
              >
                <Icon className="w-4 h-4 text-white" />
              </div>
            </Marker>
          );
        })}
        
        {showPOIs && pois.map(poi => {
          const Icon = getPOIIcon(poi.type);
          const color = POI_COLORS[poi.type];
          
          return (
            <Marker
              key={poi.id}
              longitude={poi.lng}
              latitude={poi.lat}
              anchor="center"
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: '2px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Icon className="w-3 h-3 text-white" />
              </div>
            </Marker>
          );
        })}
        
        {destinationMarker && (
          <Marker
            longitude={destinationMarker[1]}
            latitude={destinationMarker[0]}
            anchor="bottom"
          >
            <div
              style={{
                width: 32,
                height: 32,
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
          </Marker>
        )}
        
        {selectedReport && (
          <Popup
            longitude={selectedReport.lng}
            latitude={selectedReport.lat}
            anchor="bottom"
            onClose={() => setSelectedReport(null)}
            closeButton={true}
            closeOnClick={false}
            className="safety-popup"
          >
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
              
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 text-[hsl(var(--safe))]">
                    <ThumbsUp className="w-3 h-3" />
                    {selectedReport.verifiedCount}
                  </span>
                  <span className="flex items-center gap-1 text-destructive">
                    <ThumbsDown className="w-3 h-3" />
                    {selectedReport.downvoteCount || 0}
                  </span>
                </div>
                
                <div className="flex gap-1">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7"
                    onClick={() => verifyReport(selectedReport.id)}
                    disabled={isVerifying || !user}
                    title="Confirmar precisão"
                    data-testid={`button-verify-${selectedReport.id}`}
                  >
                    <ThumbsUp className="w-3 h-3" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7"
                    onClick={() => downvoteReport(selectedReport.id)}
                    disabled={isDownvoting || !user}
                    title="Não é mais preciso"
                    data-testid={`button-downvote-${selectedReport.id}`}
                  >
                    <ThumbsDown className="w-3 h-3" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleFlag(selectedReport.id)}
                    disabled={isFlagging || !user}
                    title="Denunciar relato falso"
                    data-testid={`button-flag-${selectedReport.id}`}
                  >
                    <Flag className="w-3 h-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="primary" 
                    className="h-7 px-2 text-xs"
                    onClick={() => onViewReport(selectedReport.id)}
                    data-testid={`button-details-${selectedReport.id}`}
                  >
                    Detalhes
                  </Button>
                </div>
              </div>
            </div>
          </Popup>
        )}
      </MapGL>
      
      <button
        onClick={() => setShowRoutePlanner(!showRoutePlanner)}
        className={`absolute top-20 left-4 z-[500] w-11 h-11 rounded-full shadow-lg flex items-center justify-center border transition-all
          ${showRoutePlanner || routeCoords
            ? 'bg-blue-600 border-blue-400 text-white' 
            : 'bg-card/90 backdrop-blur-md border-border text-foreground hover:bg-card'
          }`}
        title="Planejar rota segura"
        data-testid="button-route-planner"
      >
        <Navigation className="w-5 h-5" />
      </button>
      
      {showRoutePlanner && (
        <div className="absolute top-32 left-4 z-[500] w-80 bg-card/95 backdrop-blur-md rounded-xl shadow-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Planejar Rota Segura</h3>
            <button
              onClick={clearRoute}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-close-route-planner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Sua localização</span>
              {!userPosition && (
                <span className="text-xs text-destructive ml-auto">Aguardando GPS...</span>
              )}
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={destinationQuery}
                onChange={(e) => setDestinationQuery(e.target.value)}
                placeholder="Digite o destino..."
                className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                onKeyDown={(e) => e.key === 'Enter' && handleSearchRoute()}
                data-testid="input-destination"
              />
              <Button
                onClick={handleSearchRoute}
                disabled={!userPosition || !destinationQuery.trim() || isSearchingRoute}
                size="icon"
                variant="primary"
                data-testid="button-search-route"
              >
                {isSearchingRoute ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            {routeSafety && (
              <div className={`p-3 rounded-lg ${
                routeSafety.score >= 70 ? 'bg-green-500/10 border border-green-500/30' :
                routeSafety.score >= 40 ? 'bg-yellow-500/10 border border-yellow-500/30' :
                'bg-red-500/10 border border-red-500/30'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Índice de Segurança</span>
                  <span className={`text-2xl font-bold ${
                    routeSafety.score >= 70 ? 'text-green-500' :
                    routeSafety.score >= 40 ? 'text-yellow-500' :
                    'text-red-500'
                  }`}>
                    {routeSafety.score}%
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {routeSafety.nearbyDangers === 0 
                    ? 'Nenhum relato de perigo próximo à rota.'
                    : `${routeSafety.nearbyDangers} ponto(s) com relatos de perigo próximo(s).`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="absolute top-20 right-4 z-[500] flex flex-col gap-2">
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center border transition-all
            ${showHeatmap 
              ? 'bg-orange-600 border-orange-400 text-white' 
              : 'bg-card/90 backdrop-blur-md border-border text-foreground hover:bg-card'
            }`}
          title={showHeatmap ? "Ocultar mapa de calor" : "Mostrar mapa de calor"}
          data-testid="button-toggle-heatmap"
        >
          <Flame className="w-5 h-5" />
        </button>
        <button
          onClick={() => setShowPOIs(!showPOIs)}
          className={`w-11 h-11 rounded-full shadow-lg flex items-center justify-center border transition-all
            ${showPOIs 
              ? 'bg-blue-600 border-blue-400 text-white' 
              : 'bg-card/90 backdrop-blur-md border-border text-foreground hover:bg-card'
            }`}
          title={showPOIs ? "Ocultar pontos de interesse" : "Mostrar pontos de interesse (ônibus, hospitais, etc.)"}
          data-testid="button-toggle-pois"
        >
          <MapPin className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
