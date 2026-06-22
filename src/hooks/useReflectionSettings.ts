import { useQuery } from '@tanstack/react-query';
import { fetchReflectionSettings } from '@/api/reflectionSettings';
import { queryKeys } from '@/lib/query';
import { DEFAULT_REFLECTION_PROMPTS, type ReflectionSettings } from '@gg/shared/types';

const DEFAULTS: ReflectionSettings = {
  mode: 'prompts',
  prompts: DEFAULT_REFLECTION_PROMPTS,
  time: null,
  days: [],
  reminder: true,
  schedule: null,
};

export function useReflectionSettings() {
  const query = useQuery({
    queryKey: queryKeys.reflectionSettings.all,
    queryFn: fetchReflectionSettings,
    staleTime: 5 * 60 * 1000,
  });

  const settings = query.data ?? DEFAULTS;
  const prompts = settings.prompts.length > 0 ? settings.prompts : DEFAULT_REFLECTION_PROMPTS;

  return { settings, prompts, isLoading: query.isLoading };
}
