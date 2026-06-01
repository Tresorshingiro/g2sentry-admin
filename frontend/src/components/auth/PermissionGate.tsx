import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: Props) {
  const { permissions } = useAuth();
  if (!permissions.includes(permission)) return <>{fallback}</>;
  return <>{children}</>;
}
