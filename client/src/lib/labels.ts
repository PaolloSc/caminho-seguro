// Labels responsivos: versões curtas para mobile, completas para desktop

export const labels = {
  // Header e navegação
  appName: {
    mobile: "Seguro",
    desktop: "CaminhoSeguro"
  },
  
  // Menu lateral
  greeting: {
    mobile: (name: string) => `Olá, ${name}`,
    desktop: (name: string) => `Olá, ${name}`
  },
  guestGreeting: {
    mobile: "Visitante",
    desktop: "Bem-vinda, Visitante"
  },
  welcomeMessage: {
    mobile: "Fique segura.",
    desktop: "Mantenha-se segura por aí."
  },
  guestMessage: {
    mobile: "Entre para contribuir.",
    desktop: "Junte-se à nossa comunidade para se manter segura."
  },
  loginButton: {
    mobile: "Entrar",
    desktop: "Entrar para Contribuir"
  },
  impactTitle: {
    mobile: "Impacto",
    desktop: "Seu Impacto"
  },
  reports: {
    mobile: "Relatos",
    desktop: "Relatos"
  },
  verifications: {
    mobile: "Verif.",
    desktop: "Verificações"
  },
  legend: {
    mobile: "Legenda",
    desktop: "Legenda"
  },
  settings: {
    mobile: "Config.",
    desktop: "Configurações"
  },
  terms: {
    mobile: "Termos",
    desktop: "Termos de Uso"
  },
  privacy: {
    mobile: "Privac.",
    desktop: "Privacidade"
  },
  logout: {
    mobile: "Sair",
    desktop: "Sair"
  },
  
  // Tipos de incidente
  incidentTypes: {
    assedio: {
      mobile: "Assédio",
      desktop: "Assédio ou Intimidação"
    },
    iluminacao_precaria: {
      mobile: "Iluminação",
      desktop: "Iluminação Precária"
    },
    deserto: {
      mobile: "Local Ermo",
      desktop: "Local Deserto ou Isolado"
    },
    abrigo_seguro: {
      mobile: "Refúgio",
      desktop: "Ponto de Abrigo Seguro"
    }
  },
  
  // Formulário de relato
  reportDrawer: {
    title: {
      mobile: "Novo Relato",
      desktop: "Relatar Incidente"
    },
    subtitle: {
      mobile: "Ajude outras.",
      desktop: "Ajude outras pessoas a ficarem seguras compartilhando detalhes."
    },
    whatHappening: {
      mobile: "Tipo",
      desktop: "O que está acontecendo?"
    },
    severity: {
      mobile: "Nível",
      desktop: "Gravidade"
    },
    severityMin: {
      mobile: "Leve",
      desktop: "Leve"
    },
    severityMax: {
      mobile: "Grave",
      desktop: "Extremo"
    },
    description: {
      mobile: "Descrição",
      desktop: "Descrição"
    },
    descriptionPlaceholder: {
      mobile: "O que aconteceu?",
      desktop: "Descreva o que você viu ou vivenciou..."
    },
    reference: {
      mobile: "Ref. (opc.)",
      desktop: "Referência (opcional)"
    },
    referencePlaceholder: {
      mobile: "Ponto de referência",
      desktop: "Ex: próximo ao ponto de ônibus..."
    },
    submit: {
      mobile: "Enviar",
      desktop: "Enviar Relato"
    },
    searchingAddress: {
      mobile: "Buscando...",
      desktop: "Buscando endereço..."
    }
  },
  
  // Mapa e instruções
  map: {
    tapInstruction: {
      mobile: "Toque no mapa",
      desktop: "Clique em qualquer lugar no mapa para adicionar um relato"
    },
    tapDescription: {
      mobile: "Toque para criar relato.",
      desktop: "Toque em qualquer local do mapa para criar um relato."
    }
  },
  
  // Detalhes do relato
  reportDetails: {
    reportedOn: {
      mobile: "Em",
      desktop: "Relatado em"
    },
    severity: {
      mobile: "Nível",
      desktop: "Gravidade"
    },
    verifications: {
      mobile: "Verif.",
      desktop: "Verificações"
    },
    verifyButton: {
      mobile: "Verificar",
      desktop: "Verificar Relato"
    },
    loginToVerify: {
      mobile: "Entre para verificar",
      desktop: "Entre para verificar este relato"
    },
    loading: {
      mobile: "...",
      desktop: "Carregando..."
    }
  },
  
  // Toast de login
  loginRequired: {
    title: {
      mobile: "Faça login",
      desktop: "Login Necessário"
    },
    description: {
      mobile: "Entre para relatar.",
      desktop: "Faça login para adicionar um relato."
    }
  }
};

// Helper function para pegar o label correto
export function getLabel<T extends keyof typeof labels>(
  key: T,
  isMobile: boolean
): typeof labels[T] extends { mobile: infer M; desktop: infer D } 
  ? (M | D) 
  : typeof labels[T] {
  const label = labels[key];
  if (typeof label === 'object' && 'mobile' in label && 'desktop' in label) {
    return isMobile ? label.mobile : label.desktop;
  }
  return label as any;
}

// Hook para usar labels responsivos
import { useIsMobile } from "@/hooks/use-mobile";

export function useLabels() {
  const isMobile = useIsMobile();
  
  return {
    get: <T extends keyof typeof labels>(key: T) => getLabel(key, isMobile),
    isMobile
  };
}
