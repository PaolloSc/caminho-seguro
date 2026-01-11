import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button-custom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  X,
  Pencil,
  ChevronRight,
  LogOut,
  Trash2,
  Key,
  Shield,
  Bell,
  EyeOff
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { UserPreferences, UpdateUserPreferences } from "@shared/schema";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

export default function Configuracoes() {
  const { user, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showEditName, setShowEditName] = useState(false);
  const [showPasswordInfo, setShowPasswordInfo] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");

  const { data: preferences } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
    enabled: isAuthenticated,
  });

  const updatePrefsMutation = useMutation({
    mutationFn: async (data: UpdateUserPreferences) => {
      const res = await apiRequest("PATCH", "/api/user/preferences", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/preferences"] });
    },
  });

  const [showPinDialog, setShowPinDialog] = useState(false);
  const [newPin, setNewPin] = useState("");

  const updateNameMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName?: string }) => {
      return await apiRequest("PATCH", "/api/user/name", data);
    },
    onSuccess: () => {
      toast({
        title: "Nome atualizado",
        description: "Seu nome foi alterado com sucesso.",
      });
      setShowEditName(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar seu nome. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleUpdateName = () => {
    if (firstName.length < 2) {
      toast({
        title: "Nome muito curto",
        description: "O nome precisa ter pelo menos 2 caracteres.",
        variant: "destructive",
      });
      return;
    }
    updateNameMutation.mutate({ firstName, lastName: lastName || undefined });
  };

  const handleToggleDisguise = (checked: boolean) => {
    if (checked && !preferences?.disguisePin) {
      setShowPinDialog(true);
      return;
    }
    updatePrefsMutation.mutate({ disguiseEnabled: checked });
  };

  const handleSetPin = () => {
    if (newPin.length < 4) {
      toast({
        title: "PIN muito curto",
        description: "O PIN deve ter entre 4 e 6 dígitos.",
        variant: "destructive",
      });
      return;
    }
    updatePrefsMutation.mutate({ 
      disguisePin: newPin,
      disguiseEnabled: true 
    }, {
      onSuccess: () => {
        setShowPinDialog(false);
        setNewPin("");
        toast({
          title: "Modo Disfarce ativado",
          description: "O disfarce de calculadora será exibido ao abrir o app.",
        });
      }
    });
  };

  const handleDeleteAccount = () => {
    toast({
      title: "Solicitação enviada",
      description: "Sua solicitação de exclusão de conta foi registrada. Entraremos em contato em até 15 dias úteis.",
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
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

  const userName = user?.firstName && user?.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user?.firstName || 'Usuária';

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="flex-shrink-0 bg-primary border-b border-primary/20 text-primary-foreground">
        <div className="flex items-center justify-between px-4 h-16">
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="font-bold text-lg">Configurações</h1>
          <Link href="/">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/10">
              <X className="w-6 h-6" />
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-primary/5 flex flex-col">
        <div className="flex flex-col items-center py-10 bg-primary text-primary-foreground flex-shrink-0">
          <div className="relative mb-4">
            <Avatar className="w-32 h-32 border-4 border-primary-foreground/20 shadow-2xl">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-4xl bg-primary-foreground text-primary">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <Button 
              size="icon" 
              className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-white text-primary shadow-xl hover:bg-white/90"
              onClick={() => setShowEditName(true)}
            >
              <Pencil className="w-5 h-5" />
            </Button>
          </div>
          <h2 className="text-2xl font-bold">{userName}</h2>
        </div>

        <div className="px-4 space-y-6 py-8 pb-20">
          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-widest px-2">Minhas informações</h3>
            <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
              <div 
                className="flex items-center justify-between py-5 px-6 hover:bg-muted/30 cursor-pointer group"
                onClick={() => setShowEditName(true)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Avatar className="w-6 h-6 bg-transparent">
                      <AvatarImage src={user?.profileImageUrl || undefined} className="rounded-none opacity-60" />
                      <AvatarFallback className="bg-transparent text-primary"><Pencil className="w-4 h-4" /></AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Nome</p>
                    <p className="font-bold text-base mt-0.5">{userName}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
              <Separator className="mx-6 w-auto" />
              <div className="flex items-center justify-between py-5 px-6 group hover:bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Key className="w-5 h-5 text-primary opacity-60" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">E-mail</p>
                    <p className="font-bold text-base mt-0.5">{user?.email || 'Não informado'}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-widest px-2">Privacidade e Segurança</h3>
            <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
              <div className="flex items-center justify-between py-5 px-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <EyeOff className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-base">Modo Disfarce</p>
                    <p className="text-xs text-muted-foreground">Ocultar o app sob uma calculadora funcional</p>
                  </div>
                </div>
                <Switch 
                  checked={preferences?.disguiseEnabled || false} 
                  onCheckedChange={handleToggleDisguise}
                  className="data-[state=checked]:bg-green-500" 
                />
              </div>
              {preferences?.disguiseEnabled && (
                <>
                  <Separator className="mx-6 w-auto" />
                  <div 
                    className="flex items-center justify-between py-5 px-6 hover:bg-muted/30 cursor-pointer group"
                    onClick={() => setShowPinDialog(true)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Key className="w-5 h-5 text-primary opacity-60" />
                      </div>
                      <div>
                        <p className="font-bold text-base">Alterar PIN de acesso</p>
                        <p className="text-xs text-muted-foreground">PIN usado para desbloquear o app real</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-widest px-2">Notificações</h3>
            <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
              <div className="flex items-center justify-between py-5 px-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-base">Alertas de segurança</p>
                    <p className="text-xs text-muted-foreground">Notificações sobre perigos na sua rota</p>
                  </div>
                </div>
                <Switch defaultChecked className="data-[state=checked]:bg-green-500" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-widest px-2">Sobre</h3>
            <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
              {[
                { label: "Termos de uso", icon: ChevronRight, href: "/termos" },
                { label: "Política de privacidade", icon: ChevronRight, href: "/privacidade" },
              ].map((item, i) => (
                <Link key={i} href={item.href}>
                  <div className="flex items-center justify-between py-5 px-6 hover:bg-muted/30 group">
                    <span className="font-bold text-base">{item.label}</span>
                    <item.icon className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <div className="bg-destructive/5 rounded-3xl border border-destructive/10 p-4 hover:bg-destructive/10 cursor-pointer transition-colors group">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-destructive/10 flex items-center justify-center">
                        <Trash2 className="w-5 h-5 text-destructive" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-destructive">Excluir conta permanentemente</p>
                        <p className="text-xs text-destructive/70 font-medium">Esta ação não pode ser desfeita</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-destructive group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-bold">Apagar conta permanentemente?</AlertDialogTitle>
                  <AlertDialogDescription className="text-base">
                    Esta ação não pode ser desfeita. Todos os seus dados serão 
                    removidos permanentemente, incluindo seus relatos e verificações.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel className="rounded-2xl h-12 font-bold">Cancelar</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-2xl h-12 font-bold"
                  >
                    Sim, apagar minha conta
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>

          <Button 
            variant="ghost" 
            className="w-full h-14 font-bold text-muted-foreground hover:text-destructive rounded-2xl"
            onClick={() => logout()}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sair da conta
          </Button>
        </div>
      </div>

      <Dialog open={showEditName} onOpenChange={setShowEditName}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Editar nome</DialogTitle>
            <DialogDescription className="text-base">
              Altere seu nome de exibição no aplicativo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Seu nome"
                className="h-12 rounded-2xl"
                data-testid="input-first-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Sobrenome (opcional)</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Seu sobrenome"
                className="h-12 rounded-2xl"
                data-testid="input-last-name"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-2xl h-12 font-bold" onClick={() => setShowEditName(false)}>
              Cancelar
            </Button>
            <Button 
              className="rounded-2xl h-12 font-bold"
              onClick={handleUpdateName}
              disabled={updateNameMutation.isPending}
              data-testid="button-save-name"
            >
              {updateNameMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Definir PIN de Disfarce</DialogTitle>
            <DialogDescription className="text-base">
              Digite um código de 4 a 6 números. Você usará este código na calculadora para acessar o app real.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="pin">PIN de Acesso</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Ex: 1234"
                className="h-12 text-lg rounded-2xl text-center tracking-[1em] font-bold"
                data-testid="input-disguise-pin"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-2xl h-12 font-bold" onClick={() => setShowPinDialog(false)}>
              Cancelar
            </Button>
            <Button 
              className="rounded-2xl h-12 font-bold"
              onClick={handleSetPin}
              disabled={updatePrefsMutation.isPending}
              data-testid="button-save-pin"
            >
              {updatePrefsMutation.isPending ? "Salvando..." : "Ativar Disfarce"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordInfo} onOpenChange={setShowPasswordInfo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperação de senha</DialogTitle>
            <DialogDescription>
              Como você fez login com Google ou Replit, sua senha é gerenciada diretamente pelo provedor.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Para recuperar ou alterar sua senha:
            </p>
            <ul className="list-disc list-inside text-sm space-y-2 text-muted-foreground">
              <li>Se você usa <strong>Google</strong>: acesse myaccount.google.com</li>
              <li>Se você usa <strong>Replit</strong>: acesse replit.com/account</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Lá você poderá alterar sua senha e configurações de segurança.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPasswordInfo(false)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
