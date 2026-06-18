import {
  Bell,
  BellOff,
  Briefcase,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  FileText,
  RefreshCcw,
  Shield,
} from 'lucide-react';
import { type ElementType, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/services/api';
import { useAuth } from '@/hooks/useAuth';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";
const LIMIT = 25;

// ── Action → visual config ────────────────────────────────────────────────────

interface ActionConfig {
  icon: ElementType;
  bg: string;
  iconColor: string;
  label: string;
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  REVIEW_REPLACEMENT:  { icon: RefreshCcw, bg: 'bg-orange-100', iconColor: 'text-orange-600', label: 'Replacement' },
  REVIEW_INVOICE:      { icon: FileText,   bg: 'bg-blue-100',   iconColor: 'text-blue-600',   label: 'Invoice Review' },
  REVIEW_EARLY_RELEASE:{ icon: Clock,      bg: 'bg-amber-100',  iconColor: 'text-amber-600',  label: 'Early Release' },
  VIEW_JOB:            { icon: Briefcase,  bg: 'bg-green-100',  iconColor: 'text-green-700',  label: 'Job Update' },
  VIEW_INVOICE:        { icon: FileText,   bg: 'bg-blue-100',   iconColor: 'text-blue-600',   label: 'Invoice' },
  VIEW_ASSIGNMENTS:    { icon: Shield,     bg: 'bg-green-100',  iconColor: 'text-green-700',  label: 'Assignment' },
  VIEW_APPLICATION:    { icon: Shield,     bg: 'bg-purple-100', iconColor: 'text-purple-600', label: 'Application' },
};

const DEFAULT_CONFIG: ActionConfig = {
  icon: Bell,
  bg: 'bg-slate-100',
  iconColor: 'text-slate-500',
  label: 'Notification',
};

function getActionConfig(n: NotificationItem): ActionConfig {
  const action = n.payload?.action as string | undefined;
  return (action && ACTION_CONFIG[action]) ? ACTION_CONFIG[action] : DEFAULT_CONFIG;
}

// ── Destination resolver ──────────────────────────────────────────────────────

function resolveDestination(n: NotificationItem): string | null {
  const p = n.payload;
  if (!p) return null;
  if (p.invoiceId)      return `/billing/${p.invoiceId}`;
  if (p.jobId)          return `/assignments/${p.jobId}`;
  if (p.organizationId) return `/clients/${p.organizationId}`;
  if (p.guardianId)     return `/guardians/${p.guardianId}`;
  return null;
}

// ── Time formatting ───────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-100 animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
      <div className="flex-1 space-y-2 py-0.5">
        <div className="h-3.5 bg-slate-100 rounded w-2/5" />
        <div className="h-3 bg-slate-100 rounded w-4/5" />
        <div className="h-3 bg-slate-100 rounded w-3/5" />
        <div className="h-2.5 bg-slate-100 rounded w-1/4 mt-1" />
      </div>
    </div>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

type Filter = 'all' | 'unread';

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationsPage() {
  const navigate   = useNavigate();
  const { permissions } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [markingAll, setMarkingAll]       = useState(false);
  const [filter, setFilter]               = useState<Filter>('all');
  const [page, setPage]                   = useState(1);
  const [hasMore, setHasMore]             = useState(false);
  const [total, setTotal]                 = useState(0);
  const [markingId, setMarkingId]         = useState<string | null>(null);

  const canWrite     = permissions.includes('notifications:write');
  const unreadCount  = notifications.filter((n) => !n.readAt).length;
  const displayed    = filter === 'unread' ? notifications.filter((n) => !n.readAt) : notifications;

  useEffect(() => {
    let active = true;
    fetchNotifications(1, LIMIT)
      .then((res) => {
        if (!active) return;
        setNotifications(res.items);
        setHasMore(res.meta.hasMore);
        setTotal(res.meta.total);
        setPage(1);
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function loadMore() {
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
    if (!canWrite || markingId) return;
    setMarkingId(id);
    await markNotificationRead(id).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setMarkingId(null);
  }

  async function handleMarkAllRead() {
    if (!canWrite || markingAll) return;
    setMarkingAll(true);
    await markAllNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setMarkingAll(false);
  }

  function handleCardClick(n: NotificationItem) {
    if (!n.readAt) void handleMarkRead(n.id);
    const dest = resolveDestination(n);
    if (dest) navigate(dest);
  }

  return (
    <div
      className="flex flex-col h-full overflow-y-auto bg-[#F8FAFC]"
      style={{ fontFamily: IBM }}
    >

      {/* ── Header ── */}
      <div className="shrink-0 px-5 pt-5 pb-0">

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#14B87A]/10 border border-[#14B87A]/20 flex items-center justify-center shrink-0">
              <Bell className="w-4.5 h-4.5 text-[#14B87A]" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-slate-900 leading-tight">Notifications</h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {loading ? '…' : (
                  <>
                    <span className="font-semibold text-slate-600">{total}</span> total
                    {unreadCount > 0 && (
                      <>
                        {' · '}
                        <span className="font-semibold text-red-500">{unreadCount} unread</span>
                      </>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Mark all read */}
          {unreadCount > 0 && canWrite && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[#14B87A] border border-[#14B87A]/30 bg-[#14B87A]/5 rounded-lg hover:bg-[#14B87A]/10 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
            >
              {markingAll
                ? <span className="w-3 h-3 border-2 border-[#14B87A] border-t-transparent rounded-full animate-spin" />
                : <CheckCheck className="w-3.5 h-3.5" />}
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200">
          {(['all', 'unread'] as Filter[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={cn(
                'px-3.5 py-2.5 text-[12px] font-semibold transition-colors cursor-pointer border-b-2 -mb-px',
                filter === tab
                  ? 'border-[#14B87A] text-[#14B87A]'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {tab === 'all'
                ? `All ${loading ? '' : `(${total})`}`
                : `Unread ${loading ? '' : `(${unreadCount})`}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 px-5 py-4">

        {/* Skeleton */}
        {loading && (
          <div className="max-w-2xl space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && displayed.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
              <BellOff className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">
              {filter === 'unread' ? 'All caught up' : 'No notifications yet'}
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              {filter === 'unread'
                ? 'You have no unread notifications. Great job staying on top of things.'
                : 'Operational alerts will appear here — replacement requests, invoice reviews, and more.'}
            </p>
            {filter === 'unread' && (
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="mt-4 px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                View all notifications
              </button>
            )}
          </div>
        )}

        {/* Notification cards */}
        {!loading && displayed.length > 0 && (
          <div className="max-w-2xl space-y-1.5">
            {displayed.map((n) => {
              const cfg  = getActionConfig(n);
              const dest = resolveDestination(n);
              const Icon = cfg.icon;
              const isUnread = !n.readAt;

              return (
                <div
                  key={n.id}
                  onClick={() => handleCardClick(n)}
                  className={cn(
                    'group relative flex items-start gap-3.5 p-4 rounded-xl border transition-all duration-150',
                    dest ? 'cursor-pointer' : 'cursor-default',
                    isUnread
                      ? 'bg-white border-slate-200 shadow-sm hover:border-[#14B87A]/30 hover:shadow-md'
                      : 'bg-white/60 border-slate-100 hover:bg-white hover:border-slate-200',
                  )}
                >
                  {/* Unread accent bar */}
                  {isUnread && (
                    <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-[#14B87A] rounded-r-full" />
                  )}

                  {/* Icon */}
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105',
                    cfg.bg,
                  )}>
                    <Icon className={cn('w-4.5 h-4.5', cfg.iconColor)} />
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 py-0.5">
                    {/* Action chip + title row */}
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn(
                          'inline-flex shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded',
                          cfg.bg, cfg.iconColor,
                        )}>
                          {cfg.label}
                        </span>
                        {isUnread && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#14B87A] shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Mark as read button — only on unread */}
                        {isUnread && canWrite && (
                          <button
                            type="button"
                            aria-label="Mark as read"
                            onClick={(e) => { e.stopPropagation(); void handleMarkRead(n.id); }}
                            disabled={markingId === n.id}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-[#14B87A] hover:bg-[#14B87A]/10 disabled:opacity-30 transition-all cursor-pointer"
                          >
                            {markingId === n.id
                              ? <span className="w-3 h-3 border border-[#14B87A] border-t-transparent rounded-full animate-spin block" />
                              : <Check className="w-3 h-3" />}
                          </button>
                        )}
                        {/* Navigate arrow */}
                        {dest && (
                          <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#14B87A] transition-colors" />
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <p className={cn(
                      'text-[13px] leading-snug mb-1',
                      isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-600',
                    )}>
                      {n.title}
                    </p>

                    {/* Body */}
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{n.body}</p>

                    {/* Timestamp */}
                    <p
                      className="text-[10px] text-slate-400 mt-2 font-medium"
                      title={fullDate(n.createdAt)}
                    >
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Load more */}
            {hasMore && (
              <div className="pt-2 pb-1 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
                >
                  {loadingMore && (
                    <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  )}
                  {loadingMore ? 'Loading…' : 'Load more notifications'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
