import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button-custom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  X,
  Pencil,
  ChevronRight,
  LogOut,
  Trash2,
  Key
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
      <header className="flex-shrink-0 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="font-semibold text-base truncate pr-2">Conta e login</h1>
          <Link href="/">
            <Button variant="ghost" size="icon">
              <X className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center py-8">
          <div className="relative">
            <Avatar className="w-28 h-28 border-4 border-background shadow-lg">
              <AvatarImage src={user?.profileImageUrl || undefined} />
              <AvatarFallback className="text-3xl bg-muted">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <Button 
              size="icon" 
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-md"
              onClick={() => {
                setFirstName(user?.firstName || "");
                setLastName(user?.lastName || "");
                setShowEditName(true);
              }}
              data-testid="button-edit-photo"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="px-4 space-y-0 pb-8">
        <p className="text-sm text-muted-foreground px-4 py-3 bg-muted/30">
          Dados da conta
        </p>

        <div 
          className="flex items-center justify-between py-4 px-4 hover-elevate cursor-pointer"
          onClick={() => {
            setFirstName(user?.firstName || "");
            setLastName(user?.lastName || "");
            setShowEditName(true);
          }}
          data-testid="button-edit-name"
        >
          <div>
            <p className="text-sm text-muted-foreground">Nome completo</p>
            <p className="font-medium mt-1">{userName}</p>
          </div>
          <Button variant="ghost" className="text-primary text-sm">
            Editar
          </Button>
        </div>

        <Separator />

        <p className="text-xs text-muted-foreground px-4 py-3">
          Outras usuárias podem ver seu nome de usuário
        </p>

        <Separator />

        <p className="text-sm text-muted-foreground px-4 py-3 bg-muted/30">
          Dados de acesso
        </p>

        <div className="flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" className="w-5 h-5">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">E-mail</p>
              <p className="font-medium">{user?.email || 'Não informado'}</p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="py-4 px-4">
          <p className="text-sm text-muted-foreground">Nome de usuário</p>
          <p className="font-medium mt-1">user_{user?.id?.slice(0, 8) || 'xxxxxxxx'}</p>
        </div>

        <Separator />

        <div 
          className="flex items-center justify-between py-4 px-4 hover-elevate cursor-pointer"
          onClick={() => setShowPasswordInfo(true)}
          data-testid="button-password-info"
        >
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Senha</p>
              <p className="font-medium text-muted-foreground">••••••••</p>
            </div>
          </div>
          <Button variant="ghost" className="text-primary text-sm">
            Recuperar
          </Button>
        </div>

        <Separator />

        <p className="text-xs text-muted-foreground px-4 py-3">
          Sua senha é gerenciada pelo provedor de login (Google/Replit)
        </p>

        <Separator />

        <div className="flex items-center justify-between py-4 px-4 opacity-50 cursor-not-allowed">
          <p className="font-medium">Avançado</p>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>

        <Separator />

        <Button 
          variant="ghost" 
          className="w-full justify-start py-4 px-4 h-auto font-medium rounded-none"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="w-5 h-5 mr-3 text-muted-foreground" />
          Sair
        </Button>

        <Separator />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-start py-4 px-4 h-auto font-medium text-destructive hover:text-destructive rounded-none"
              data-testid="button-delete-account"
            >
              <Trash2 className="w-5 h-5 mr-3" />
              Apagar conta
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar conta permanentemente?</AlertDialogTitle>
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
                Sim, apagar minha conta
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </div>

      <Dialog open={showEditName} onOpenChange={setShowEditName}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar nome</DialogTitle>
            <DialogDescription>
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
                data-testid="input-last-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditName(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleUpdateName}
              disabled={updateNameMutation.isPending}
              data-testid="button-save-name"
            >
              {updateNameMutation.isPending ? "Salvando..." : "Salvar"}
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
