import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Report } from "@shared/schema";
import { format } from "date-fns";
import { Shield, AlertTriangle, Lightbulb, Ghost, HelpCircle, MapPin, ThumbsUp, MessageCircle } from "lucide-react";
import { renderToString } from "react-dom/server";
import { Button } from "./ui/button-custom";
import { useAuth } from "@/hooks/use-auth";
import { useVerifyReport } from "@/hooks/use-reports";

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Icons Generator
const createIcon = (type: string) => {
  let iconComponent;
  let colorClass;

  switch (type) {
    case 'assedio':
      iconComponent = <AlertTriangle className="w-5 h-5 text-white" />;
      colorClass = 'bg-destructive';
      break;
    case 'iluminacao_precaria':
      iconComponent = <Lightbulb className="w-5 h-5 text-white" />;
      colorClass = 'bg-[hsl(var(--warning))]';
      break;
    case 'deserto':
      iconComponent = <Ghost className="w-5 h-5 text-white" />;
      colorClass = 'bg-gray-500';
      break;
    case 'abrigo_seguro':
      iconComponent = <Shield className="w-5 h-5 text-white" />;
      colorClass = 'bg-[hsl(var(--safe))]';
      break;
    default:
      iconComponent = <HelpCircle className="w-5 h-5 text-white" />;
      colorClass = 'bg-primary';
  }

  const html = renderToString(
    <div className={`marker-pin ${colorClass} w-10 h-10 flex items-center justify-center rounded-full shadow-lg border-2 border-white`}>
      <div className="transform -rotate-45">
        {iconComponent}
      </div>
    </div>
  );

  return L.divIcon({
    html,
    className: 'custom-marker-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
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
      <div className="relative w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-md user-location-marker"></div>
    ),
    className: 'custom-marker-icon',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  return <Marker position={position} icon={userIcon} />;
}

interface SafetyMapProps {
  reports: Report[];
  onAddReport: (lat: number, lng: number) => void;
  onViewReport: (id: number) => void;
  className?: string;
}

export function SafetyMap({ reports, onAddReport, onViewReport, className }: SafetyMapProps) {
  const { user } = useAuth();
  const { mutate: verifyReport, isPending: isVerifying } = useVerifyReport();
  const [mapCenter, setMapCenter] = useState<[number, number]>([-23.5505, -46.6333]); // Default SP

  return (
    <div className={className}>
      <MapContainer 
        center={mapCenter} 
        zoom={13} 
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <UserLocator onLocationFound={(lat, lng) => setMapCenter([lat, lng])} />
        
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
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ThumbsUp className="w-3 h-3" />
                    <span>{report.verifiedCount} verificações</span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        verifyReport(report.id);
                      }}
                      disabled={isVerifying}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="primary" 
                      className="h-8 px-3 text-xs"
                      onClick={() => onViewReport(report.id)}
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
