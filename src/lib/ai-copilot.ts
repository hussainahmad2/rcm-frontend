import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { toast } from '@/hooks/use-toast';
import { viewForAiUseCase } from '@/lib/workspace-nav';

export type AiCopilotSuggestion = {
  id: string;
  headline: string;
  summary: string;
  nextAction: string;
  riskLevel: 'low' | 'medium' | 'high';
  recommendations?: string[];
  useCase: string;
  offline: boolean;
};

export function useAiCopilot(enabled: boolean) {
  const seen = useRef(new Set<string>());
  const primed = useRef(false);

  const query = useQuery({
    queryKey: ['ai-copilot'],
    queryFn: () =>
      api.aiCopilot() as Promise<{
        ok: boolean;
        model?: string;
        message?: string;
        suggestions: AiCopilotSuggestion[];
      }>,
    enabled,
    refetchInterval: 20_000,
    staleTime: 8_000,
    retry: 1,
  });

  useEffect(() => {
    const suggestions = query.data?.suggestions ?? [];
    if (!suggestions.length) return;

    if (!primed.current) {
      primed.current = true;
      for (const item of suggestions) {
        seen.current.add(item.id);
        seen.current.add(`${item.headline}|${item.nextAction}`);
      }
      return;
    }

    for (const item of suggestions) {
      const fingerprint = `${item.headline}|${item.nextAction}`;
      if (seen.current.has(item.id) || seen.current.has(fingerprint)) continue;
      if (item.offline) continue;
      seen.current.add(item.id);
      seen.current.add(fingerprint);
      toast({
        title: item.headline,
        description: item.nextAction || item.summary,
        variant: item.riskLevel === 'high' ? 'warning' : 'info',
        navigateTo: viewForAiUseCase(item.useCase),
      });
    }
  }, [query.data]);

  return query;
}
