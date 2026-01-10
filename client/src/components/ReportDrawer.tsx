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
}

export function ReportDrawer({ isOpen, onClose, location }: ReportDrawerProps) {
  const isMobile = useIsMobile();
  const { mutate: createReport, isPending } = useCreateReport();
  
  const [type, setType] = useState<string>("assedio");
  const [description, setDescription] = useState("");
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
      severity: severity[0],
      lat: location.lat,
      lng: location.lng
    }, {
      onSuccess: () => {
        onClose();
        // Reset form
        setDescription("");
        setSeverity([3]);
        setType("assedio");
      }
    });
  };

  const formContent = (
    <div className="space-y-6 py-4">
      <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3 text-sm">
        <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {isLoadingAddress ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Buscando endereço...</span>
            </div>
          ) : (
            <span className="font-medium text-foreground truncate block">{address || 'Local selecionado'}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-base font-semibold">O que está acontecendo?</Label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'assedio', icon: AlertTriangle, label: 'Assédio', color: 'text-destructive border-destructive/20 bg-destructive/5' },
            { id: 'iluminacao_precaria', icon: Lightbulb, label: 'Iluminação Precária', color: 'text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))]/5' },
            { id: 'deserto', icon: Ghost, label: 'Lugar Deserto', color: 'text-gray-500 border-gray-200 bg-gray-50' },
            { id: 'abrigo_seguro', icon: Shield, label: 'Abrigo Seguro', color: 'text-[hsl(var(--safe))] border-[hsl(var(--safe))]/20 bg-[hsl(var(--safe))]/5' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setType(item.id)}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all duration-200
                ${type === item.id 
                  ? `ring-2 ring-offset-1 ring-primary ${item.color} border-transparent` 
                  : 'border-border hover:border-primary/50 bg-card'
                }`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs font-semibold">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Label>Nível de Gravidade</Label>
          <span className="text-sm font-bold px-2 py-0.5 rounded bg-muted">
            {severity[0]}/5
          </span>
        </div>
        <Slider
          value={severity}
          onValueChange={setSeverity}
          max={5}
          min={1}
          step={1}
          className="py-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          <span>Leve</span>
          <span>Extremo</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          placeholder="Descreva o que você viu ou vivenciou..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[100px] resize-none rounded-xl"
        />
      </div>

      <Button 
        onClick={handleSubmit} 
        isLoading={isPending}
        className="w-full"
        size="lg"
        disabled={!description}
      >
        Enviar Relato
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="px-4 pb-8 max-h-[85vh] flex flex-col">
          <DrawerHeader className="flex-shrink-0">
            <DrawerTitle>Relatar Incidente</DrawerTitle>
            <DrawerDescription>Ajude outras pessoas a ficarem seguras compartilhando detalhes.</DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="flex-1 overflow-y-auto pr-4">
            {formContent}
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Relatar Incidente</DialogTitle>
          <DialogDescription>Ajude outras pessoas a ficarem seguras compartilhando detalhes.</DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
