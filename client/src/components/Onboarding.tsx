import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button-custom";
import { Shield, MapPin, Users, Bell, ChevronRight, ChevronLeft, X, Info } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";

const ONBOARDING_KEY = "caminhoseguro_onboarding_seen";

interface OnboardingSlide {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const slides: OnboardingSlide[] = [
  {
    icon: <Shield className="w-12 h-12" />,
    title: "Bem-vinda ao CaminhoSeguro",
    description: "Sua segurança é nossa prioridade. Este app foi criado por e para mulheres que querem se sentir mais seguras ao caminhar pela cidade.",
    color: "text-primary"
  },
  {
    icon: <MapPin className="w-12 h-12" />,
    title: "Mapeie Incidentes",
    description: "Toque no mapa para relatar locais com iluminação precária, assédio, áreas desertas ou pontos de abrigo seguro.",
    color: "text-destructive"
  },
  {
    icon: <Users className="w-12 h-12" />,
    title: "Comunidade Unida",
    description: "Verifique relatos de outras usuárias para confirmar informações. Quanto mais verificações, mais confiável é o relato.",
    color: "text-[hsl(var(--safe))]"
  },
  {
    icon: <Bell className="w-12 h-12" />,
    title: "Fique Alerta",
    description: "Visualize no mapa os locais reportados antes de sair. Planeje rotas mais seguras e evite áreas de risco.",
    color: "text-[hsl(var(--warning))]"
  }
];

export function Onboarding() {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem(ONBOARDING_KEY);
    if (!hasSeenOnboarding) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setIsVisible(false);
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  if (!isVisible) return null;

  const slide = slides[currentSlide];

  return (
    <div className="fixed bottom-24 right-4 z-[100] flex flex-col items-end gap-2">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className={`bg-card border shadow-2xl rounded-2xl overflow-hidden ${
              isMobile ? 'w-[calc(100vw-2rem)]' : 'w-80'
            }`}
          >
            <div className="relative p-6">
              <button
                onClick={() => setIsExpanded(false)}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/50 transition-colors"
                aria-label="Minimizar"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className={`${slide.color} mb-4 p-3 rounded-full bg-background shadow-sm`}>
                  {slide.icon}
                </div>

                <h3 className="font-bold mb-2 text-foreground leading-tight">
                  {slide.title}
                </h3>

                <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                  {slide.description}
                </p>

                <div className="flex items-center gap-1.5 mb-6">
                  {slides.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        index === currentSlide ? 'w-4 bg-primary' : 'w-1 bg-muted-foreground/30'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2 w-full">
                  {currentSlide > 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrev}
                      className="flex-1 h-8"
                    >
                      <ChevronLeft className="w-3 h-3 mr-1" />
                      Voltar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClose}
                      className="flex-1 h-8 text-muted-foreground"
                    >
                      Pular
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={handleNext}
                    className="flex-1 h-8"
                  >
                    {currentSlide === slides.length - 1 ? "Entendi!" : "Próximo"}
                    {currentSlide < slides.length - 1 && <ChevronRight className="w-3 h-3 ml-1" />}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className={`bg-primary text-primary-foreground p-3 rounded-full shadow-lg flex items-center gap-2 overflow-hidden whitespace-nowrap group transition-all duration-300 ${
          isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        data-testid="button-open-onboarding"
      >
        <Info className="w-6 h-6" />
        <span className="max-w-0 group-hover:max-w-xs transition-all duration-500 font-medium">
          Dicas de Segurança
        </span>
      </motion.button>
    </div>
  );
}

export function useResetOnboarding() {
  return () => {
    localStorage.removeItem(ONBOARDING_KEY);
    window.location.reload();
  };
}
