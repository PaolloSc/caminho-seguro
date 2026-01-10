import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Report } from "@shared/schema";
import { format } from "date-fns";
import { Shield, AlertTriangle, Lightbulb, Ghost, HelpCircle, MapPin, ThumbsUp, ThumbsDown, MessageCircle, Flag } from "lucide-react";
import { renderToString } from "react-dom/server";
import { Button } from "./ui/button-custom";
import { useAuth } from "@/hooks/use-auth";
import { useVerifyReport, useDownvoteReport, useFlagReport } from "@/hooks/use-reports";

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
      iconComponent = <AlertTriangle className="w-4 h-4 text-white" />;
      bgColor = '#ef4444';
      shadowColor = 'rgba(239, 68, 68, 0.4)';
      break;
    case 'iluminacao_precaria':
      iconComponent = <Lightbulb className="w-4 h-4 text-white" />;
      bgColor = '#f59e0b';
      shadowColor = 'rgba(245, 158, 11, 0.4)';
      break;
    case 'deserto':
      iconComponent = <Ghost className="w-4 h-4 text-white" />;
      bgColor = '#6b7280';
      shadowColor = 'rgba(107, 114, 128, 0.4)';
      break;
    case 'abrigo_seguro':
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

// Component to locate user
function UserLocator({ onLocationFound }: { onLocationFound: (lat: number, lng: number) => void }) {
  const map = useMap();
  const [position, setPosition] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    map.locate().on("locationfound", function (e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, 15);
      onLocationFound(e.latlng.lat, e.latlng.lng);
    });
  }, [map]);

  if (!position) return null;

  const userIcon = L.divIcon({
    html: renderToString(
      <div style={{ position: 'relative', width: '24px', height: '24px' }}>
        <div 
          style={{
            position: 'absolute',
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
            top: '6px',
            left: '6px',
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
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  return <Marker position={position} icon={userIcon} />;
}

// Component to recenter map - Crosshair style button
function RecenterButton({ userPosition }: { userPosition: { lat: number; lng: number } | null }) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);
  
  const handleRecenter = () => {
    if (userPosition) {
      map.flyTo([userPosition.lat, userPosition.lng], 16, { duration: 1 });
    } else {
      map.locate().on("locationfound", function (e) {
        map.flyTo(e.latlng, 16, { duration: 1 });
      });
    }
  };

  return (
    <div 
      ref={containerRef}
      className="leaflet-bottom leaflet-right" 
      style={{ marginBottom: '100px', marginRight: '10px' }}
    >
      <div className="leaflet-control">
        <button
          onClick={handleRecenter}
          className="bg-white w-12 h-12 rounded-full shadow-xl flex items-center justify-center hover:scale-105 transition-all duration-200 border-2 border-blue-500"
          title="Centralizar na minha localização"
          data-testid="button-recenter"
        >
          <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Zoom controls component
function ZoomControls() {
  const map = useMap();
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
      className="leaflet-top leaflet-right" 
      style={{ marginTop: '80px', marginRight: '10px' }}
    >
      <div className="leaflet-control flex flex-col gap-1">
        <button
          onClick={() => map.zoomIn()}
          className="bg-white/90 backdrop-blur w-10 h-10 rounded-lg shadow-lg flex items-center justify-center hover:bg-white transition-colors text-gray-700 font-bold text-xl"
          title="Aproximar"
          data-testid="button-zoom-in"
        >
          +
        </button>
        <button
          onClick={() => map.zoomOut()}
          className="bg-white/90 backdrop-blur w-10 h-10 rounded-lg shadow-lg flex items-center justify-center hover:bg-white transition-colors text-gray-700 font-bold text-xl"
          title="Afastar"
          data-testid="button-zoom-out"
        >
          −
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
  
  const handleFlag = (reportId: number) => {
    if (!user) return;
    flagReport({ reportId, reason: 'falso' });
  };

  const tileUrl = isNightMode ? TILE_URLS.night : TILE_URLS.day;

  return (
    <div className={className}>
      <MapContainer 
        center={mapCenter} 
        zoom={13} 
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          key={isNightMode ? 'night' : 'day'}
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url={tileUrl}
        />
        
        <UserLocator onLocationFound={(lat, lng) => {
          setMapCenter([lat, lng]);
          setUserPosition({ lat, lng });
        }} />
        
        <ZoomControls />
        <RecenterButton userPosition={userPosition} />
        
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
