import { useState } from "react";
import { SafetyMap } from "@/components/SafetyMap";
import { ReportDrawer } from "@/components/ReportDrawer";
import { Button } from "@/components/ui/button-custom";
import { useReports, useVerifyReport } from "@/hooks/use-reports";
import { useAuth } from "@/hooks/use-auth";
import { Plus, Shield, User, Menu, X, LogOut, Moon, Sun, AlertTriangle, Lightbulb, Ghost, ThumbsUp } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Home() {
  const { data: reports = [] } = useReports();
  const { user, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Drawer/Dialog states
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleAddReport = (lat: number, lng: number) => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to add a report.",
        variant: "destructive",
      });
      return;
    }
    setSelectedLocation({ lat, lng });
    setIsReportOpen(true);
  };

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden relative bg-background">
      {/* Top Navigation Bar */}
      <header className="absolute top-0 left-0 right-0 z-20 p-4 pointer-events-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between pointer-events-auto">
          <div className="bg-card/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-border flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-full">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <span className="font-display font-bold text-lg text-foreground">SafePath</span>
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
                      <AvatarImage src={user?.profileImageUrl} />
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
                      {isAuthenticated ? `Hi, ${user?.firstName}` : 'Welcome Guest'}
                    </h2>
                    <p className="text-muted-foreground">
                      {isAuthenticated ? 'Stay safe out there.' : 'Join our community to stay safe.'}
                    </p>
                  </div>

                  <div className="flex-1 space-y-4">
                    {!isAuthenticated ? (
                      <Button asChild className="w-full" size="lg">
                        <a href="/api/login">Login to Contribute</a>
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <div className="p-4 bg-muted/30 rounded-xl border border-border">
                          <h3 className="font-semibold mb-2">Your Impact</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                              <div className="text-2xl font-bold text-primary">0</div>
                              <div className="text-xs text-muted-foreground">Reports</div>
                            </div>
                            <div className="text-center">
                              <div className="text-2xl font-bold text-[hsl(var(--safe))]">0</div>
                              <div className="text-xs text-muted-foreground">Verifications</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="pt-8 space-y-2">
                      <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-wider mb-4">Legend</h3>
                      {[
                        { icon: Shield, label: 'Safe Haven', color: 'text-[hsl(var(--safe))]' },
                        { icon: AlertTriangle, label: 'Harassment', color: 'text-destructive' },
                        { icon: Lightbulb, label: 'Poor Lighting', color: 'text-[hsl(var(--warning))]' },
                        { icon: Ghost, label: 'Deserted', color: 'text-gray-500' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors">
                          <item.icon className={`w-5 h-5 ${item.color}`} />
                          <span className="font-medium">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {isAuthenticated && (
                    <div className="pt-6 border-t border-border">
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start text-muted-foreground hover:text-destructive"
                        onClick={() => logout()}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Log Out
                      </Button>
                    </div>
                  )}
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
        />
        
        {/* Floating Action Button for Reporting (Mobile) */}
        <div className="absolute bottom-8 right-4 z-[400] md:hidden">
          <Button
            size="icon"
            className="w-14 h-14 rounded-full shadow-xl bg-primary text-primary-foreground hover:scale-105 transition-transform"
            onClick={() => {
              // We'll use the user's current location logic in a real app,
              // for now let's guide them to click the map
              toast({
                title: "Tap the map",
                description: "Tap any location on the map to create a report.",
              });
            }}
          >
            <Plus className="w-8 h-8" />
          </Button>
        </div>
        
        {/* Desktop Instruction Toast */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[400] hidden md:block">
          <div className="bg-card/90 backdrop-blur px-6 py-3 rounded-full shadow-lg border border-border text-sm font-medium">
            Click anywhere on the map to add a report
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

  if (!currentReport) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-6 pt-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold font-display capitalize flex items-center gap-2">
            {currentReport.type === 'harassment' && <AlertTriangle className="text-destructive" />}
            {currentReport.type === 'poor_lighting' && <Lightbulb className="text-[hsl(var(--warning))]" />}
            {currentReport.type === 'safe_haven' && <Shield className="text-[hsl(var(--safe))]" />}
            {currentReport.type === 'deserted' && <Ghost className="text-gray-500" />}
            {currentReport.type.replace('_', ' ')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Reported on {format(new Date(currentReport.createdAt!), 'PPP p')}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-2xl font-bold">{currentReport.severity}/5</div>
          <span className="text-xs uppercase text-muted-foreground font-bold">Severity</span>
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
            <div className="text-xs text-muted-foreground">Verifications</div>
          </div>
        </div>
        
        <Button onClick={() => verify(currentReport.id)} disabled={!user}>
          Verify Report
        </Button>
      </div>
      
      {!user && (
        <p className="text-center text-xs text-muted-foreground">Log in to verify this report</p>
      )}
    </div>
  );
}
