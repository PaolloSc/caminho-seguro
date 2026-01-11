import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button-custom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreateReport } from "@/hooks/use-reports";
import { useState, useEffect } from "react";
import { AlertTriangle, Lightbulb, Ghost, Shield, MapPin, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { labels } from "@/lib/labels";

// Geocodificação reversa usando Nominatim (OpenStreetMap)
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=pt-BR`,
      {
        headers: {
          'User-Agent': 'CaminhoSeguro/1.0'
        }
      }
    );
    
    if (!response.ok) throw new Error('Geocoding failed');
    
    const data = await response.json();
    const address = data.address;
    
    // Monta o endereço no formato brasileiro
    const parts: string[] = [];
    
    // Número da casa (se disponível)
    if (address.house_number) {
      parts.push(address.house_number);
    }
    
    // Nome da rua
    const street = address.road || address.pedestrian || address.footway || address.street;
    if (street) {
      if (parts.length > 0) {
        parts.push('-');
      }
      parts.push(street);
    }
    
    // Bairro
    if (address.suburb || address.neighbourhood) {
      parts.push(address.suburb || address.neighbourhood);
    }
    
    // Cidade
    if (address.city || address.town || address.municipality) {
      parts.push(address.city || address.town || address.municipality);
    }
    
    return parts.length > 0 ? parts.join(', ') : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

interface ReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  location: { lat: number, lng: number } | null;
  onLocationChange?: (lat: number, lng: number) => void;
}

export function ReportDrawer({ isOpen, onClose, location }: ReportDrawerProps) {
  const isMobile = useIsMobile();
  const { mutate: createReport, isPending } = useCreateReport();
  
  const [type, setType] = useState<string>("assedio");
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [severity, setSeverity] = useState([3]);
  const [address, setAddress] = useState<string>("");
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);

  // Busca o endereço quando a localização muda
  useEffect(() => {
    if (location && isOpen) {
      setIsLoadingAddress(true);
      setAddress("");
      reverseGeocode(location.lat, location.lng)
        .then(addr => setAddress(addr))
        .finally(() => setIsLoadingAddress(false));
    }
  }, [location?.lat, location?.lng, isOpen]);

  const handleSubmit = () => {
    if (!location) return;
    
    createReport({
      type,
      description,
      reference: reference || undefined,
      severity: severity[0],
      lat: location.lat,
      lng: location.lng
    }, {
      onSuccess: () => {
        onClose();
        // Reset form
        setDescription("");
        setReference("");
        setSeverity([3]);
        setType("assedio");
      }
    });
  };

  const formContent = (
    <div className={`${isMobile ? 'py-2 space-y-3' : 'space-y-6'}`}>
      <div className={`bg-muted/50 ${isMobile ? 'p-2' : 'p-3'} rounded-lg flex items-center gap-2 text-sm`}>
        <MapPin className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-primary flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          {isLoadingAddress ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs">
                {isMobile ? labels.reportDrawer.searchingAddress.mobile : labels.reportDrawer.searchingAddress.desktop}
              </span>
            </div>
          ) : (
            <span className={`font-medium text-foreground truncate block ${isMobile ? 'text-xs' : 'text-sm'}`}>{address || 'Local selecionado'}</span>
          )}
        </div>
      </div>

      <div className={`${isMobile ? 'space-y-1.5' : 'space-y-2'}`}>
        <Label className={`font-semibold ${isMobile ? 'text-xs' : 'text-base'}`}>
          {isMobile ? labels.reportDrawer.whatHappening.mobile : labels.reportDrawer.whatHappening.desktop}
        </Label>
        <div className={`grid grid-cols-2 ${isMobile ? 'gap-1.5' : 'gap-3'}`}>
          {[
            { id: 'assedio', icon: AlertTriangle, label: isMobile ? labels.incidentTypes.assedio.mobile : labels.incidentTypes.assedio.desktop, color: 'text-destructive border-destructive/20 bg-destructive/5' },
            { id: 'iluminacao_precaria', icon: Lightbulb, label: isMobile ? labels.incidentTypes.iluminacao_precaria.mobile : labels.incidentTypes.iluminacao_precaria.desktop, color: 'text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))]/5' },
            { id: 'deserto', icon: Ghost, label: isMobile ? labels.incidentTypes.deserto.mobile : labels.incidentTypes.deserto.desktop, color: 'text-gray-500 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50' },
            { id: 'abrigo_seguro', icon: Shield, label: isMobile ? labels.incidentTypes.abrigo_seguro.mobile : labels.incidentTypes.abrigo_seguro.desktop, color: 'text-[hsl(var(--safe))] border-[hsl(var(--safe))]/20 bg-[hsl(var(--safe))]/5' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setType(item.id)}
              data-testid={`button-type-${item.id}`}
              className={`${isMobile ? 'p-2' : 'p-4'} rounded-lg border-2 flex flex-col items-center gap-1 transition-all duration-200
                ${type === item.id 
                  ? `ring-2 ring-offset-1 ring-primary ${item.color} border-transparent` 
                  : 'border-border hover:border-primary/50 bg-card'
                }`}
            >
              <item.icon className={`${isMobile ? 'w-4 h-4' : 'w-6 h-6'}`} />
              <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-semibold text-center leading-tight`}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`${isMobile ? 'space-y-2' : 'space-y-4'}`}>
        <div className="flex justify-between items-center">
          <Label className={isMobile ? 'text-xs' : ''}>
            {isMobile ? labels.reportDrawer.severity.mobile : labels.reportDrawer.severity.desktop}
          </Label>
          <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-bold px-1.5 py-0.5 rounded bg-muted`}>
            {severity[0]}/5
          </span>
        </div>
        <Slider
          value={severity}
          onValueChange={setSeverity}
          max={5}
          min={1}
          step={1}
          className={isMobile ? 'py-2' : 'py-4'}
        />
        <div className={`flex justify-between ${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground px-1`}>
          <span>{isMobile ? labels.reportDrawer.severityMin.mobile : labels.reportDrawer.severityMin.desktop}</span>
          <span>{isMobile ? labels.reportDrawer.severityMax.mobile : labels.reportDrawer.severityMax.desktop}</span>
        </div>
      </div>

      <div className={`${isMobile ? 'space-y-1' : 'space-y-2'}`}>
        <Label htmlFor="description" className={isMobile ? 'text-xs' : ''}>
          {isMobile ? labels.reportDrawer.description.mobile : labels.reportDrawer.description.desktop}
        </Label>
        <Textarea
          id="description"
          placeholder={isMobile ? labels.reportDrawer.descriptionPlaceholder.mobile : labels.reportDrawer.descriptionPlaceholder.desktop}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={`${isMobile ? 'min-h-[70px] text-sm' : 'min-h-[100px]'} resize-none rounded-lg`}
          data-testid="input-description"
        />
      </div>

      <div className={`${isMobile ? 'space-y-1' : 'space-y-2'}`}>
        <Label htmlFor="reference" className={isMobile ? 'text-xs' : ''}>
          {isMobile ? labels.reportDrawer.reference.mobile : labels.reportDrawer.reference.desktop}
        </Label>
        <Textarea
          id="reference"
          placeholder={isMobile ? labels.reportDrawer.referencePlaceholder.mobile : labels.reportDrawer.referencePlaceholder.desktop}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          className={`${isMobile ? 'min-h-[50px] text-sm' : 'min-h-[60px]'} resize-none rounded-lg`}
          data-testid="input-reference"
        />
      </div>
    </div>
  );

  const submitButton = (
    <Button 
      onClick={handleSubmit} 
      isLoading={isPending}
      className="w-full"
      size={isMobile ? "md" : "lg"}
      disabled={!description}
      data-testid="button-submit-report"
    >
      {isMobile ? labels.reportDrawer.submit.mobile : labels.reportDrawer.submit.desktop}
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="px-3 h-[95vh] flex flex-col">
          <DrawerHeader className="flex-shrink-0 py-2 px-1">
            <DrawerTitle className="text-base">{labels.reportDrawer.title.mobile}</DrawerTitle>
            <DrawerDescription className="text-xs">{labels.reportDrawer.subtitle.mobile}</DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-1">
              {formContent}
            </div>
          </ScrollArea>
          <DrawerFooter className="flex-shrink-0 pt-2 pb-4 px-1">
            {submitButton}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>{labels.reportDrawer.title.desktop}</DialogTitle>
          <DialogDescription>{labels.reportDrawer.subtitle.desktop}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 px-6">
          <div className="pb-6">
            {formContent}
          </div>
        </ScrollArea>
        <DialogFooter className="p-6 pt-2 border-t">
          {submitButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
