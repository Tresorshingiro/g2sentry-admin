import { apiGet, apiPatch, apiPost } from '@/lib/api-client';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export async function fetchNotifications(
  page = 1,
  limit = 20,
): Promise<{ items: NotificationItem[]; meta: { page: number; limit: number; total: number; hasMore: boolean } }> {
  return apiGet(`/notifications?page=${page}&limit=${limit}`);
}

export async function markNotificationRead(id: string): Promise<unknown> {
  return apiPatch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<unknown> {
  return apiPost('/notifications/read-all');
}
