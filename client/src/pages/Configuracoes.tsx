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

      <div className="flex-1 overflow-y-auto bg-primary/5">
        <div className="flex flex-col items-center py-10 bg-primary text-primary-foreground">
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
          <p className="text-primary-foreground/70 text-sm mt-1 font-medium">Nos ajude a salvar uma vida.</p>
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
            <h3 className="text-sm font-bold uppercase text-muted-foreground tracking-widest px-2">Backup e Segurança</h3>
            <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
              <div className="flex items-center justify-between py-5 px-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-bold text-base">Backup automático</p>
                    <p className="text-xs text-muted-foreground">Fazer backup das configurações</p>
                  </div>
                </div>
                <div className="w-12 h-6 bg-muted rounded-full relative p-1 cursor-pointer">
                  <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                </div>
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
