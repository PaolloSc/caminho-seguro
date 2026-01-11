import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import type { UserPreferences } from "@shared/schema";

export function useDisguise() {
  const { isAuthenticated } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [sessionUnlocked, setSessionUnlocked] = useState(() => {
    // Verifica se já desbloqueou nesta sessão
    return sessionStorage.getItem("app_unlocked") === "true";
  });

  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user/preferences"],
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Se não está autenticada ou camuflagem desativada, app está liberado
  const disguiseEnabled = preferences?.disguiseEnabled ?? false;
  const shouldShowDisguise = isAuthenticated && disguiseEnabled && !sessionUnlocked;

  const unlock = useCallback(() => {
    setIsUnlocked(true);
    setSessionUnlocked(true);
    sessionStorage.setItem("app_unlocked", "true");
  }, []);

  // Reset quando deslogar
  useEffect(() => {
    if (!isAuthenticated) {
      setIsUnlocked(false);
      setSessionUnlocked(false);
      sessionStorage.removeItem("app_unlocked");
    }
  }, [isAuthenticated]);

  return {
    shouldShowDisguise,
    isUnlocked: isUnlocked || sessionUnlocked || !disguiseEnabled,
    isLoading,
    unlock,
    preferences,
  };
}
