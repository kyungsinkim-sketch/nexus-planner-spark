import { useQuery } from '@tanstack/react-query';
import { getCreativeRoles, groupRolesByCategory } from '@/services/creativeRoleService';
import type { CreativeRole } from '@/types/core';

export function useCreativeRoles() {
  const { data: roles = [], isLoading } = useQuery<CreativeRole[]>({
    queryKey: ['creativeRoles'],
    queryFn: getCreativeRoles,
    staleTime: 1000 * 60 * 30, // 30 min cache
  });

  const grouped = groupRolesByCategory(roles);

  return { roles, grouped, isLoading };
}
