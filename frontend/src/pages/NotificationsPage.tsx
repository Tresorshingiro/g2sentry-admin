import { Bell, Check, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

const LIMIT = 25;

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function resolveDestination(n: NotificationItem): string | null {
  const p = n.payload;
  if (!p) return null;
  if (p.organizationId) return `/clients/${p.organizationId}`;
  if (p.guardianId)     return `/guardians/${p.guardianId}`;
  if (p.jobId)          return `/assignments/${p.jobId}`;
  return null;
}

type Filter = 'all' | 'unread';

export function NotificationsPage() {
  const navigate = useNavigate();
  const { permissions } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [filter, setFilter]               = useState<Filter>('all');
  const [page, setPage]                   = useState(1);
  const [hasMore, setHasMore]             = useState(false);
  const [total, setTotal]                 = useState(0);

  const canWrite = permissions.includes('notifications:write');

  useEffect(() => {
    setLoading(true);
    fetchNotifications(1, LIMIT)
      .then((res) => {
        setNotifications(res.items);
        setHasMore(res.meta.hasMore);
        setTotal(res.meta.total);
        setPage(1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    const next = page + 1;
    fetchNotifications(next, LIMIT)
      .then((res) => {
        setNotifications((prev) => [...prev, ...res.items]);
        setHasMore(res.meta.hasMore);
        setPage(next);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }

  async function handleMarkRead(id: string) {
    if (!canWrite) return;
    await markNotificationRead(id).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
  }

  async function handleMarkAllRead() {
    if (!canWrite) return;
    await markAllNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  function handleClick(n: NotificationItem) {
    if (!n.readAt) void handleMarkRead(n.id);
    const dest = resolveDestination(n);
    if (dest) navigate(dest);
  }

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const displayed   = filter === 'unread' ? notifications.filter((n) => !n.readAt) : notifications;

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── Page header ── */}
      <div className="shrink-0 px-6 pt-5 pb-4 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Notifications</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {loading ? '…' : `${total} total`}
              {!loading && unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-semibold rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </p>
          </div>

          {unreadCount > 0 && canWrite && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 transition-colors cursor-pointer shrink-0"
            >
              <Check className="w-3.5 h-3.5" />
              Mark all as read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-3">
          {(['all', 'unread'] as Filter[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer capitalize',
                filter === tab
                  ? 'bg-green-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {tab === 'unread' ? `Unread (${unreadCount})` : `All (${total})`}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Bell className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-500">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {filter === 'unread'
                ? 'You\'re all caught up.'
                : 'Notifications will appear here when there\'s activity to review.'}
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-4 space-y-1">
            {displayed.map((n) => {
              const dest = resolveDestination(n);
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    'flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer group',
                    !n.readAt
                      ? 'bg-white border-green-100 hover:border-green-200 shadow-sm'
                      : 'bg-white border-slate-100 hover:border-slate-200 opacity-75 hover:opacity-100',
                  )}
                >
                  {/* Unread dot */}
                  <div className="mt-1.5 shrink-0 w-5 flex items-center justify-center">
                    <div className={cn(
                      'w-2 h-2 rounded-full transition-colors',
                      !n.readAt ? 'bg-green-500' : 'bg-transparent',
                    )} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn(
                        'text-sm leading-snug',
                        !n.readAt ? 'font-semibold text-slate-900' : 'font-medium text-slate-600',
                      )}>
                        {n.title}
                      </p>
                      {dest && (
                        <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-green-500 shrink-0 transition-colors mt-0.5" />
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">{n.body}</p>
                    <p className="text-xs text-slate-400 mt-2">{formatDate(n.createdAt)}</p>
                  </div>
                </div>
              );
            })}

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center pt-4 pb-2">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-5 py-2 text-xs font-medium text-green-700 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
