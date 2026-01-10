import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button-custom";
import { Shield, MapPin, Users, Bell, ChevronRight, ChevronLeft, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const ONBOARDING_KEY = "caminhoseguro_onboarding_seen";

interface OnboardingSlide {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

const slides: OnboardingSlide[] = [
  {
    icon: <Shield className="w-16 h-16" />,
    title: "Bem-vinda ao CaminhoSeguro",
    description: "Sua segurança é nossa prioridade. Este app foi criado por e para mulheres que querem se sentir mais seguras ao caminhar pela cidade.",
    color: "text-primary"
  },
  {
    icon: <MapPin className="w-16 h-16" />,
    title: "Mapeie Incidentes",
    description: "Toque no mapa para relatar locais com iluminação precária, assédio, áreas desertas ou pontos de abrigo seguro. Suas informações ajudam outras mulheres.",
    color: "text-destructive"
  },
  {
    icon: <Users className="w-16 h-16" />,
    title: "Comunidade Unida",
    description: "Verifique relatos de outras usuárias para confirmar informações. Quanto mais verificações, mais confiável é o relato.",
    color: "text-[hsl(var(--safe))]"
  },
  {
    icon: <Bell className="w-16 h-16" />,
    title: "Fique Alerta",
    description: "Visualize no mapa os locais reportados antes de sair. Planeje rotas mais seguras e evite áreas de risco.",
    color: "text-[hsl(var(--warning))]"
  }
];

export function Onboarding() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem(ONBOARDING_KEY);
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setIsOpen(false);
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

  const handleSkip = () => {
    handleClose();
  };

  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        className={`${isMobile ? 'w-[95vw] max-w-none' : 'sm:max-w-[450px]'} p-0 gap-0 overflow-hidden border-0`}
        hideCloseButton
      >
        <div className="relative bg-gradient-to-br from-primary/10 via-background to-background">
          <button
            onClick={handleSkip}
            className="absolute top-3 right-3 p-2 rounded-full hover:bg-muted/50 transition-colors z-10"
            data-testid="button-skip-onboarding"
            aria-label="Pular introdução"
          >
            <X className="w-5 h-5 text-muted-foreground" />
            <span className="sr-only">Pular introdução</span>
          </button>

          <div className={`flex flex-col items-center text-center ${isMobile ? 'px-6 py-10' : 'px-8 py-12'}`}>
            <div className={`${slide.color} mb-6 p-4 rounded-full bg-background shadow-lg`}>
              {slide.icon}
            </div>

            <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold mb-4 text-foreground`}>
              {slide.title}
            </h2>

            <p className={`${isMobile ? 'text-sm' : 'text-base'} text-muted-foreground leading-relaxed mb-8 max-w-sm`}>
              {slide.description}
            </p>

            <div className="flex items-center gap-2 mb-8" role="tablist" aria-label="Slides de introdução">
              {slides.map((slide, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentSlide 
                      ? 'w-8 bg-primary' 
                      : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  data-testid={`button-slide-${index}`}
                  role="tab"
                  aria-selected={index === currentSlide}
                  aria-label={`Ir para slide ${index + 1}: ${slide.title}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 w-full">
              {currentSlide > 0 && (
                <Button
                  variant="outline"
                  onClick={handlePrev}
                  className="flex-1"
                  data-testid="button-prev-slide"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>
              )}

              <Button
                onClick={handleNext}
                className={currentSlide === 0 ? 'w-full' : 'flex-1'}
                data-testid="button-next-slide"
              >
                {isLastSlide ? (
                  "Começar a Usar"
                ) : (
                  <>
                    Próximo
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useResetOnboarding() {
  return () => {
    localStorage.removeItem(ONBOARDING_KEY);
    window.location.reload();
  };
}
