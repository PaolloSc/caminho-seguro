import { useQuery } from "@tanstack/react-query";

interface MapsConfig {
  apiKey: string;
}

export function useMapsConfig() {
  return useQuery<MapsConfig>({
    queryKey: ['/api/config/maps'],
    queryFn: async () => {
      const res = await fetch('/api/config/maps', { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to fetch maps config');
      }
      return res.json();
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
  });
}
