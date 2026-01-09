import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button-custom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { useCreateReport } from "@/hooks/use-reports";
import { useState } from "react";
import { AlertTriangle, Lightbulb, Ghost, Shield, MapPin, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ReportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  location: { lat: number, lng: number } | null;
}

export function ReportDrawer({ isOpen, onClose, location }: ReportDrawerProps) {
  const isMobile = useIsMobile();
  const { mutate: createReport, isPending } = useCreateReport();
  
  const [type, setType] = useState<string>("harassment");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState([3]);

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
        setType("harassment");
      }
    });
  };

  const formContent = (
    <div className="space-y-6 py-4">
      <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3 text-sm text-muted-foreground">
        <MapPin className="w-4 h-4 text-primary" />
        <span>Location selected: {location?.lat.toFixed(4)}, {location?.lng.toFixed(4)}</span>
      </div>

      <div className="space-y-2">
        <Label className="text-base font-semibold">What's happening?</Label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'harassment', icon: AlertTriangle, label: 'Harassment', color: 'text-destructive border-destructive/20 bg-destructive/5' },
            { id: 'poor_lighting', icon: Lightbulb, label: 'Poor Lighting', color: 'text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20 bg-[hsl(var(--warning))]/5' },
            { id: 'deserted', icon: Ghost, label: 'Deserted Area', color: 'text-gray-500 border-gray-200 bg-gray-50' },
            { id: 'safe_haven', icon: Shield, label: 'Safe Haven', color: 'text-[hsl(var(--safe))] border-[hsl(var(--safe))]/20 bg-[hsl(var(--safe))]/5' },
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
          <Label>Severity Level</Label>
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
          <span>Mild</span>
          <span>Extreme</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe what you saw or experienced..."
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
        Submit Report
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="px-4 pb-8 max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>Report Incident</DrawerTitle>
            <DrawerDescription>Help others stay safe by sharing details.</DrawerDescription>
          </DrawerHeader>
          {formContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report Incident</DialogTitle>
          <DialogDescription>Help others stay safe by sharing details.</DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
