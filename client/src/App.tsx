import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Onboarding } from "@/components/Onboarding";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import TermosDeUso from "@/pages/TermosDeUso";
import PoliticaPrivacidade from "@/pages/PoliticaPrivacidade";
import Configuracoes from "@/pages/Configuracoes";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/termos" component={TermosDeUso} />
      <Route path="/privacidade" component={PoliticaPrivacidade} />
      <Route path="/configuracoes" component={Configuracoes} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Onboarding />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
