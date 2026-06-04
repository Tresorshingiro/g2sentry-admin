import { apiGet } from '@/lib/api-client';

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  actor: { id: string; fullName: string | null; phoneNumber: string } | null;
}

export async function fetchAuditLogs(
  page = 1,
  limit = 20,
  actorUserId?: string,
  entityType?: string,
): Promise<{ items: AuditLogItem[]; meta: { page: number; limit: number; total: number; hasMore: boolean } }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (actorUserId) params.set('actorUserId', actorUserId);
  if (entityType) params.set('entityType', entityType);
  return apiGet(`/admin/audit-logs?${params}`);
}
