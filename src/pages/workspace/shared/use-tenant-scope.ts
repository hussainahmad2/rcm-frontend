import { useAuth } from '@/lib/auth';

export function useTenantScope() {
  const { tenant } = useAuth();
  return tenant?.id ?? 'none';
}
