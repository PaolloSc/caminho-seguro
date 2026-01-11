import { useDisguise } from "@/hooks/use-disguise";
import { DisguiseScreen } from "./DisguiseScreen";

interface DisguiseGateProps {
  children: React.ReactNode;
}

export function DisguiseGate({ children }: DisguiseGateProps) {
  const { shouldShowDisguise, unlock, isLoading } = useDisguise();

  // Enquanto carrega preferências, mostra tela em branco
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Se camuflagem está ativada e não desbloqueou, mostra calculadora
  if (shouldShowDisguise) {
    return <DisguiseScreen onUnlock={unlock} />;
  }

  // App normal
  return <>{children}</>;
}
