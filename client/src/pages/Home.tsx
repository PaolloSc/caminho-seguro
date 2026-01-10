import { useState, useEffect } from "react";
import { SafetyMap } from "@/components/SafetyMap";
import { ReportDrawer } from "@/components/ReportDrawer";
import { Button } from "@/components/ui/button-custom";
import { useReports, useVerifyReport } from "@/hooks/use-reports";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Shield, User, Menu, X, LogOut, Moon, Sun, AlertTriangle, Lightbulb, Ghost, ThumbsUp, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Detecta se é noite (entre 18h e 6h)
function isNightTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

export default function Home() {
  const { data: reports = [] } = useReports();
  const { user, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Inicializa com base na hora do dia
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme === 'dark';
    return isNightTime();
  });
  const [isAutoTheme, setIsAutoTheme] = useState(() => {
    return localStorage.getItem('autoTheme') !== 'false';
  });
  
  // Drawer/Dialog states
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  // Aplica tema ao carregar e monitora mudanças de hora
  useEffect(() => {
    if (isAutoTheme) {
      const checkTime = () => {
        const shouldBeDark = isNightTime();
        if (shouldBeDark !== isDarkMode) {
          setIsDarkMode(shouldBeDark);
        }
      };
      
      checkTime();
      const interval = setInterval(checkTime, 60000); // Verifica a cada minuto
      return () => clearInterval(interval);
    }
  }, [isAutoTheme]);

  // Aplica classe dark ao documento
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsAutoTheme(false);
    localStorage.setItem('autoTheme', 'false');
    setIsDarkMode(!isDarkMode);
  };

  const handleAddReport = (lat: number, lng: number) => {
    if (!isAuthenticated) {
      toast({
        title: "Login Necessário",
        description: "Faça login para adicionar um relato.",
        variant: "destructive",
      });
      return;
    }
    setSelectedLocation({ lat, lng });
    setIsReportOpen(true);
  };

  return (
    <div className="h-screen w-full flex flex-col relative bg-background safe-top safe-bottom overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="absolute top-0 left-0 right-0 z-20 p-4 pointer-events-none safe-top">
        <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto">
          <div className="bg-card/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-border flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-full">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">CaminhoSeguro</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full shadow-lg bg-card/90 backdrop-blur-md border border-border"
              onClick={toggleTheme}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
            
            <Sheet>
              <SheetTrigger asChild>
                <Button 
                  size="icon" 
                  className="rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isAuthenticated ? (
                    <Avatar className="w-8 h-8 border-2 border-white/20">
                      <AvatarImage src={user?.profileImageUrl || undefined} />
                      <AvatarFallback>{user?.firstName?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent>
                <div className="flex flex-col h-full">
                  <div className="py-6">
                    <h2 className="text-2xl font-display font-bold mb-1">
                      {isAuthenticated ? `Olá, ${user?.firstName}` : 'Bem-vinda, Visitante'}
                    </h2>
                    <p className="text-muted-foreground">
                      {isAuthenticated ? 'Mantenha-se segura por aí.' : 'Junte-se à nossa comunidade para se manter segura.'}
                    </p>
                  </div>

                  <div className="flex-1 space-y-4">
                    {!isAuthenticated ? (
                      <a href="/api/login" className="w-full">
                        <Button className="w-full" size="lg">
                          Entrar para Contribuir
                        </Button>
                      </a>
                    ) : (
                      <div className="space-y-2">
                        <div className="p-4 bg-muted/30 rounded-xl border border-border">
                          <h3 className="font-semibold mb-2">Seu Impacto</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-primary">0</div>
                              <div className="text-xs text-muted-foreground">Relatos</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-[hsl(var(--safe))]">0</div>
                              <div className="text-xs text-muted-foreground">Verificações</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="pt-8 space-y-2">
                      <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wider mb-4">Legenda</h3>
                      {[
                        { icon: Shield, label: 'Abrigo Seguro', color: 'text-[hsl(var(--safe))]' },
                        { icon: AlertTriangle, label: 'Assédio', color: 'text-destructive' },
                        { icon: Lightbulb, label: 'Iluminação Precária', color: 'text-[hsl(var(--warning))]' },
                        { icon: Ghost, label: 'Lugar Deserto', color: 'text-gray-500' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors">
                          <item.icon className={`w-5 h-5 ${item.color}`} />
                          <span className="font-medium">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-border space-y-2">
                    {isAuthenticated && (
                      <Link href="/configuracoes">
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start"
                          data-testid="link-settings"
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Configurações
                        </Button>
                      </Link>
                    )}
                    <div className="flex gap-2 text-xs">
                      <Link href="/termos">
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" data-testid="link-terms">
                          Termos de Uso
                        </Button>
                      </Link>
                      <Link href="/privacidade">
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" data-testid="link-privacy">
                          Privacidade
                        </Button>
                      </Link>
                    </div>
                    {isAuthenticated && (
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start text-muted-foreground hover:text-destructive"
                        onClick={() => logout()}
                        data-testid="button-logout"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sair
                      </Button>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Map Area */}
      <main className="flex-1 relative z-0">
        <SafetyMap 
          reports={reports}
          onAddReport={handleAddReport}
          onViewReport={(id) => setSelectedReportId(id)}
          className="w-full h-full"
          isNightMode={isDarkMode}
        />
        
        {/* Floating Action Button for Reporting (Mobile) */}
        <div className="absolute bottom-8 right-4 z-[400] md:hidden">
          <Button
            size="icon"
            className="w-14 h-14 rounded-full shadow-xl bg-primary text-primary-foreground hover:scale-105 transition-transform"
            onClick={() => {
              toast({
                title: "Toque no mapa",
                description: "Toque em qualquer local do mapa para criar um relato.",
              });
            }}
          >
            <Plus className="w-8 h-8" />
          </Button>
        </div>
        
        {/* Desktop Instruction Toast */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[400] hidden md:block">
          <div className="bg-card/90 backdrop-blur px-6 py-3 rounded-full shadow-lg border border-border text-sm font-medium">
            Clique em qualquer lugar no mapa para adicionar um relato
          </div>
        </div>
      </main>

      {/* Report Creation Drawer/Dialog */}
      <ReportDrawer 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)}
        location={selectedLocation}
      />

      {/* Report Details Drawer (Read-only view) */}
      <Sheet open={!!selectedReportId} onOpenChange={(open) => !open && setSelectedReportId(null)}>
        <SheetContent side="bottom" className="h-[60vh] sm:h-auto sm:side-right">
          {selectedReportId && (
            <ReportDetails id={selectedReportId} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ReportDetails({ id }: { id: number }) {
  const { data: report } = useReports(); // Ideally useReport(id) but for simplicity reusing list
  const currentReport = report?.find(r => r.id === id);
  const { mutate: verify } = useVerifyReport();
  const { user } = useAuth();

  if (!currentReport) return <div className="p-4">Carregando...</div>;

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold font-display capitalize flex items-center gap-2">
            {currentReport.type === 'assedio' && <AlertTriangle className="text-destructive" />}
            {currentReport.type === 'iluminacao_precaria' && <Lightbulb className="text-[hsl(var(--warning))]" />}
            {currentReport.type === 'abrigo_seguro' && <Shield className="text-[hsl(var(--safe))]" />}
            {currentReport.type === 'deserto' && <Ghost className="text-gray-500" />}
            {currentReport.type.replace('_', ' ')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Relatado em {format(new Date(currentReport.createdAt!), 'PPP p')}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-2xl font-bold">{currentReport.severity}/5</div>
          <span className="text-xs uppercase text-muted-foreground font-bold">Gravidade</span>
        </div>
      </div>

      <div className="bg-muted/30 p-4 rounded-xl border border-border">
        <p className="text-foreground leading-relaxed">
          "{currentReport.description}"
        </p>
      </div>

      <div className="flex items-center justify-between py-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="bg-green-100 text-green-700 p-2 rounded-full">
            <ThumbsUp className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold">{currentReport.verifiedCount}</div>
            <div className="text-xs text-muted-foreground">Verificações</div>
          </div>
        </div>
        
        <Button onClick={() => verify(currentReport.id)} disabled={!user}>
          Verificar Relato
        </Button>
      </div>
      
      {!user && (
        <p className="text-center text-xs text-muted-foreground">Entre para verificar este relato</p>
      )}
    </div>
  );
}
