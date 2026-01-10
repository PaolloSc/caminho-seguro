import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Polyline, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Report } from "@shared/schema";
import { format } from "date-fns";
import { Shield, AlertTriangle, Lightbulb, Ghost, HelpCircle, MapPin, ThumbsUp, ThumbsDown, Flag, Navigation, X, Search, Loader2, Bus, TreePine, Building2, Siren } from "lucide-react";
import { Button } from "./ui/button-custom";
import { useAuth } from "@/hooks/use-auth";
import { useVerifyReport, useDownvoteReport, useFlagReport } from "@/hooks/use-reports";
import { useToast } from "@/hooks/use-toast";
import { renderToStaticMarkup } from "react-dom/server";

// Leaflet fix for default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
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

const TILE_LAYERS = {
  day: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  night: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
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

// Custom hook to handle map events
function MapEvents({ onMoveEnd, onClick }: { onMoveEnd: () => void, onClick: (e: L.LeafletMouseEvent) => void }) {
  useMapEvents({
    moveend: onMoveEnd,
    click: onClick,
  });
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
  
  const mapRef = useRef<L.Map>(null);
  
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);
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
        const bounds = L.latLngBounds(route);
        mapRef.current.fitBounds(bounds, { padding: [50, 50] });
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

  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    setSelectedReport(null);
    setSelectedPOI(null);
    onAddReport(e.latlng.lat, e.latlng.lng);
  }, [onAddReport]);

  const refreshPOIs = useCallback(() => {
    if (!showPOIs || !mapRef.current) return;
    
    const bounds = mapRef.current.getBounds();
    fetchPOIs(bounds).then(setPois);
  }, [showPOIs]);

  const handleMoveEnd = useCallback(() => {
    if (showPOIs) {
      refreshPOIs();
    }
  }, [showPOIs, refreshPOIs]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.locate({ setView: true, maxZoom: 16 });
      mapRef.current.on('locationfound', (e) => {
        setUserPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }
  }, []);

  const createReportIcon = (report: Report) => {
    const Icon = getReportIcon(report.type);
    const color = REPORT_COLORS[report.type] || '#6b7280';
    
    return L.divIcon({
      className: 'custom-marker-icon',
      html: renderToStaticMarkup(
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
        >
          <Icon className="w-4 h-4 text-white" />
        </div>
      ),
      iconSize: [36, 36],
      iconAnchor: [18, 18],
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
      ),
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  };

  const tileUrl = isNightMode ? TILE_LAYERS.night : TILE_LAYERS.day;

  return (
    <div className={`relative w-full h-full ${className}`}>
      <MapContainer
        center={[-19.8095, -43.9345]}
        zoom={16}
        className="w-full h-full"
        ref={mapRef as any}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={tileUrl}
        />
        
        <MapEvents onMoveEnd={handleMoveEnd} onClick={handleMapClick} />
        
        {/* Reports markers */}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          verifyReport(selectedReport.id);
                        }}
                        disabled={isVerifying || !user}
                        title="Confirmar precisão"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          downvoteReport(selectedReport.id);
                        }}
                        disabled={isDownvoting || !user}
                        title="Não é mais preciso"
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFlag(selectedReport.id);
                        }}
                        disabled={isFlagging || !user}
                        title="Denunciar relato falso"
                      >
                        <Flag className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="primary" 
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewReport(selectedReport.id);
                        }}
                      >
                        Detalhes
                      </Button>
                    </div>
                  </div>
                </div>
              </Popup>
            )}
          </Marker>
        ))}
        
        {/* POIs markers */}
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
                    {(() => {
                      const Icon = getPOIIcon(selectedPOI.type);
                      return <Icon className="w-4 h-4" style={{ color: POI_COLORS[selectedPOI.type] }} />;
                    })()}
                    <span className="font-semibold text-sm">
                      {selectedPOI.name || (
                        selectedPOI.type === 'bus_stop' ? 'Ponto de Ônibus' :
                        selectedPOI.type === 'park' ? 'Parque' :
                        selectedPOI.type === 'hospital' ? 'Hospital' :
                        selectedPOI.type === 'police' ? 'Polícia' : 'Local'
                      )}
                    </span>
                  </div>
                  {selectedPOI.name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedPOI.type === 'bus_stop' ? 'Ponto de Ônibus' :
                       selectedPOI.type === 'park' ? 'Parque' :
                       selectedPOI.type === 'hospital' ? 'Hospital' :
                       selectedPOI.type === 'police' ? 'Polícia' : 'Local'}
                    </p>
                  )}
                </div>
              </Popup>
            )}
          </Marker>
        ))}
        
        {/* User position */}
        {userPosition && (
          <CircleMarker
            center={[userPosition.lat, userPosition.lng]}
            radius={8}
            pathOptions={{
              fillColor: 'hsl(var(--primary))',
              fillOpacity: 1,
              color: 'white',
              weight: 2
            }}
            className="user-location-marker"
          />
        )}
        
        {/* Route visualization */}
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
        
        {/* Destination marker */}
        {destinationMarker && (
          <Marker
            position={destinationMarker}
            icon={L.divIcon({
              className: 'custom-marker-icon',
              html: renderToStaticMarkup(
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
              ),
              iconSize: [32, 32],
              iconAnchor: [16, 32],
            })}
          />
        )}
      </MapContainer>

      {/* Interface Controls */}
      <div className="absolute top-4 left-4 right-4 z-[1000] pointer-events-none">
        {!showRoutePlanner ? (
          <div className="flex gap-2 justify-between">
            <Button
              variant="outline"
              className="pointer-events-auto bg-background/80 backdrop-blur-md shadow-lg rounded-full px-4 h-11"
              onClick={() => setShowRoutePlanner(true)}
              data-testid="button-open-route-planner"
            >
              <Navigation className="w-4 h-4 mr-2 text-primary" />
              Para onde vamos?
            </Button>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                className={`pointer-events-auto shadow-lg rounded-full h-11 w-11 ${showPOIs ? 'bg-primary text-white border-primary' : 'bg-background/80 backdrop-blur-md'}`}
                onClick={() => setShowPOIs(!showPOIs)}
                title={showPOIs ? "Esconder locais úteis" : "Mostrar locais úteis"}
              >
                <Building2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-background/95 backdrop-blur-md p-3 rounded-2xl shadow-xl pointer-events-auto border animate-in slide-in-from-top-4 duration-300 max-w-md mx-auto w-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Destino (ex: Rua da Bahia, BH)"
                  className="w-full bg-muted/50 border-none rounded-xl py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  value={destinationQuery}
                  onChange={(e) => setDestinationQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchRoute()}
                  autoFocus
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-full h-8 w-8"
                onClick={clearRoute}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            {!routeCoords ? (
              <Button
                className="w-full rounded-xl"
                onClick={handleSearchRoute}
                disabled={isSearchingRoute || !destinationQuery.trim()}
              >
                {isSearchingRoute ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Calculando...
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4 mr-2" />
                    Traçar Rota Segura
                  </>
                )}
              </Button>
            ) : routeSafety && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 ${
                      routeSafety.score >= 70 ? 'border-green-500/20 text-green-600' : 
                      routeSafety.score >= 40 ? 'border-yellow-500/20 text-yellow-600' : 'border-red-500/20 text-red-600'
                    }`}>
                      <span className="text-lg font-bold">{routeSafety.score}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Índice de Segurança</p>
                      <p className="text-sm font-medium">
                        {routeSafety.score >= 70 ? 'Caminho seguro recomendado' : 
                         routeSafety.score >= 40 ? 'Atenção redobrada no trajeto' : 'Trajeto com alto risco'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-muted/20 rounded-lg text-center">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Alertas Próximos</p>
                    <p className="text-sm font-semibold">{routeSafety.nearbyDangers}</p>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-lg h-auto py-2"
                    onClick={clearRoute}
                  >
                    Novo Destino
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute bottom-6 right-4 flex flex-col gap-2 z-[1000]">
        <Button
          variant="outline"
          size="icon"
          className="bg-background/80 backdrop-blur-md shadow-lg rounded-full h-12 w-12"
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.locate({ setView: true, maxZoom: 17 });
            }
          }}
          data-testid="button-geolocate"
        >
          <Navigation className="w-5 h-5 text-primary" />
        </Button>
      </div>
    </div>
  );
}
