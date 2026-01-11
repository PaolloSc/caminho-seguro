import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button-custom";
import { ChevronRight, ChevronLeft, X, Shield, MapPin, ThumbsUp, Bell } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface Step {
  title: string;
  description: string;
  icon: any;
  target?: string;
}

const steps: Step[] = [
  {
    title: "Bem-vinda ao CaminhoSeguro",
    description: "Sua plataforma colaborativa para caminhar com mais tranquilidade e segurança.",
    icon: Shield,
  },
  {
    title: "Relate Incidentes",
    description: "Viu algo ou sentiu insegurança? Toque no mapa para relatar assédio, iluminação precária ou locais desertos.",
    icon: MapPin,
    target: "map-area",
  },
  {
    title: "Confirmação Comunitária",
    description: "Ajude outras mulheres! Confirme a veracidade de relatos próximos para torná-los 'Confirmados'.",
    icon: ThumbsUp,
  },
  {
    title: "Níveis de Segurança",
    description: "Usuárias frequentes ganham selos de 'Verificada', aumentando a confiabilidade dos seus relatos.",
    icon: Shield,
  },
  {
    title: "Alertas em Tempo Real",
    description: "Ative as notificações para ser avisada sobre incidentes recentes na sua rota atual.",
    icon: Bell,
  },
];

export function Tutorial() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem("caminhoseguro-tutorial-seen");
    if (!hasSeenTutorial) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("caminhoseguro-tutorial-seen", "true");
    setIsVisible(false);
  };

  const step = steps[currentStep];
  const Icon = step.icon;

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-card border-2 border-primary/20 shadow-2xl rounded-2xl max-w-sm w-full overflow-hidden"
        >
          <div className="relative p-6 text-center space-y-4">
            <button 
              onClick={handleComplete}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Icon className="w-8 h-8 text-primary" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>

            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 py-2">
              {steps.map((_, i) => (
                <div 
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep ? "w-6 bg-primary" : "w-1.5 bg-primary/20"
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              {currentStep > 0 && (
                <Button 
                  variant="outline" 
                  onClick={handlePrev}
                  className="flex-1"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                </Button>
              )}
              <Button 
                variant="primary" 
                onClick={handleNext}
                className="flex-1"
              >
                {currentStep === steps.length - 1 ? "Começar" : "Próximo"}
                {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
