import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button-custom";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { 
  ArrowLeft, 
  User, 
  Bell, 
  Shield, 
  MapPin, 
  Eye, 
  Trash2, 
  ChevronRight,
  FileText,
  Lock,
  HelpCircle,
  Mail,
  LogOut
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function Configuracoes() {
  const { user, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  
  const [notificacoesRelatos, setNotificacoesRelatos] = useState(true);
  const [notificacoesProximidade, setNotificacoesProximidade] = useState(true);
  const [mostrarNoMapa, setMostrarNoMapa] = useState(false);

  const handleDeleteAccount = () => {
    toast({
      title: "Solicitação enviada",
      description: "Sua solicitação de exclusão de conta foi registrada. Entraremos em contato em até 15 dias úteis.",
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Shield className="w-16 h-16 text-primary mb-4" />
        <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground mb-6 text-center">
          Você precisa estar logada para acessar as configurações.
        </p>
        <a href="/api/login">
          <Button size="lg">Entrar</Button>
        </a>
        <Link href="/">
          <Button variant="ghost" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Mapa
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-6">
        <Link href="/">
          <Button variant="ghost" className="mb-4" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </Link>

        <h1 className="text-2xl font-bold mb-6">Configurações</h1>

        <div className="space-y-6">
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="text-xl">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="font-bold text-lg">
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Membro desde {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'janeiro 2026'}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Seu Impacto
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">0</div>
                <div className="text-xs text-muted-foreground">Relatos</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[hsl(var(--safe))]">0</div>
                <div className="text-xs text-muted-foreground">Verificações</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[hsl(var(--warning))]">0</div>
                <div className="text-xs text-muted-foreground">Comentários</div>
              </div>
            </div>
          </Card>

          <Card className="divide-y divide-border">
            <h3 className="font-semibold p-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notificações
            </h3>
            
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Novos relatos próximos</p>
                <p className="text-sm text-muted-foreground">
                  Receba alertas sobre novos relatos na sua região
                </p>
              </div>
              <Switch 
                checked={notificacoesRelatos} 
                onCheckedChange={setNotificacoesRelatos}
                data-testid="switch-notifications-reports"
              />
            </div>

            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Alertas de proximidade</p>
                <p className="text-sm text-muted-foreground">
                  Aviso ao se aproximar de áreas com relatos
                </p>
              </div>
              <Switch 
                checked={notificacoesProximidade} 
                onCheckedChange={setNotificacoesProximidade}
                data-testid="switch-notifications-proximity"
              />
            </div>
          </Card>

          <Card className="divide-y divide-border">
            <h3 className="font-semibold p-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Privacidade
            </h3>
            
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium">Mostrar localização no mapa</p>
                <p className="text-sm text-muted-foreground">
                  Permite que outras usuárias vejam sua posição
                </p>
              </div>
              <Switch 
                checked={mostrarNoMapa} 
                onCheckedChange={setMostrarNoMapa}
                data-testid="switch-show-location"
              />
            </div>

            <Link href="/privacidade">
              <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Política de Privacidade</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Link>
          </Card>

          <Card className="divide-y divide-border">
            <h3 className="font-semibold p-4 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              Suporte
            </h3>
            
            <Link href="/termos">
              <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Termos de Uso</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Link>

            <a href="mailto:contato@caminhoseguro.com.br">
              <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Fale Conosco</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </a>
          </Card>

          <Card className="divide-y divide-border">
            <h3 className="font-semibold p-4 flex items-center gap-2 text-destructive">
              <User className="w-5 h-5" />
              Conta
            </h3>
            
            <Button 
              variant="ghost" 
              className="w-full justify-start p-4 h-auto font-normal hover:bg-muted/50"
              onClick={() => logout()}
              data-testid="button-logout"
            >
              <LogOut className="w-5 h-5 mr-3 text-muted-foreground" />
              <span className="font-medium">Sair da conta</span>
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start p-4 h-auto font-normal text-destructive hover:text-destructive hover:bg-destructive/10"
                  data-testid="button-delete-account"
                >
                  <Trash2 className="w-5 h-5 mr-3" />
                  <span className="font-medium">Excluir minha conta</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir conta permanentemente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. Todos os seus dados serão 
                    removidos permanentemente, incluindo seus relatos e verificações.
                    Conforme a LGPD, você pode solicitar a exclusão de seus dados a qualquer momento.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Sim, excluir minha conta
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </Card>

          <p className="text-center text-xs text-muted-foreground pb-8">
            CaminhoSeguro v1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
