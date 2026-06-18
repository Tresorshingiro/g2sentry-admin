import {
  ArrowLeft,
  Bell,
  BellOff,
  Briefcase,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  LogOut,
  RefreshCcw,
  Settings,
  Shield,
  UserCircle,
} from 'lucide-react';
import { type ElementType, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/services/api';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

// ── Action → icon config (compact, for dropdown) ─────────────────────────────

interface ActionCfg { icon: ElementType; bg: string; color: string }

const ACTION_CFG: Record<string, ActionCfg> = {
  REVIEW_REPLACEMENT:   { icon: RefreshCcw, bg: 'bg-orange-100', color: 'text-orange-600' },
  REVIEW_INVOICE:       { icon: FileText,   bg: 'bg-blue-100',   color: 'text-blue-600'   },
  REVIEW_EARLY_RELEASE: { icon: Clock,      bg: 'bg-amber-100',  color: 'text-amber-600'  },
  VIEW_JOB:             { icon: Briefcase,  bg: 'bg-green-100',  color: 'text-green-700'  },
  VIEW_INVOICE:         { icon: FileText,   bg: 'bg-blue-100',   color: 'text-blue-600'   },
  VIEW_ASSIGNMENTS:     { icon: Shield,     bg: 'bg-green-100',  color: 'text-green-700'  },
};
const DEFAULT_CFG: ActionCfg = { icon: Bell, bg: 'bg-slate-100', color: 'text-slate-500' };

function getCfg(n: NotificationItem): ActionCfg {
  const action = n.payload?.action as string | undefined;
  return (action && ACTION_CFG[action]) ? ACTION_CFG[action] : DEFAULT_CFG;
}

// ── Destination resolver ──────────────────────────────────────────────────────

function resolveDest(n: NotificationItem): string | null {
  const p = n.payload;
  if (!p) return null;
  if (p.invoiceId)      return `/billing/${p.invoiceId}`;
  if (p.jobId)          return `/assignments/${p.jobId}`;
  if (p.organizationId) return `/clients/${p.organizationId}`;
  if (p.guardianId)     return `/guardians/${p.guardianId}`;
  return null;
}

// ── Relative time ─────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Page title map ────────────────────────────────────────────────────────────

const STATIC_TITLES: Record<string, string> = {
  '/notifications': 'Notifications',
  '/dashboard':     'Overview',
  '/map':           'Live Map',
  '/guardians':     'Guardian Roster',
  '/guardians/new': 'Register Guardian',
  '/verifications': 'Verifications',
  '/assignments':   'Dispatch Jobs',
  '/analytics':     'Analytics',
  '/billing':       'Billing',
  '/payouts':       'Guardian Payouts',
  '/audit':         'Audit Log',
  '/clients':       'Clients',
  '/settings':      'Settings',
  '/profile':       'My Profile',
  '/incidents':     'Incidents',
};

function resolveTitle(pathname: string): { title: string; back: string | null } {
  if (STATIC_TITLES[pathname]) return { title: STATIC_TITLES[pathname], back: null };
  if (/^\/guardians\/[^/]+\/onboard$/.test(pathname)) return { title: 'Guardian Onboarding', back: '/guardians' };
  if (/^\/guardians\/[^/]+\/edit$/.test(pathname))   return { title: 'Edit Guardian',        back: pathname.replace('/edit', '') };
  if (/^\/guardians\/[^/]+$/.test(pathname))         return { title: 'Guardian Profile',     back: '/guardians' };
  if (/^\/assignments\/[^/]+$/.test(pathname))       return { title: 'Job Details',          back: '/assignments' };
  if (/^\/clients\/[^/]+$/.test(pathname))           return { title: 'Client Details',       back: '/clients' };
  if (/^\/billing\/[^/]+$/.test(pathname))           return { title: 'Invoice Details',      back: '/billing' };
  return { title: 'G2Sentry', back: null };
}

// ── Navbar ────────────────────────────────────────────────────────────────────

export function Navbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { user, logout, permissions } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { title, back } = resolveTitle(pathname);

  // User dropdown
  const [userOpen, setUserOpen]   = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  // Bell dropdown
  const [bellOpen, setBellOpen]         = useState(false);
  const [items, setItems]               = useState<NotificationItem[]>([]);
  const [bellLoading, setBellLoading]   = useState(false);
  const [markingAll, setMarkingAll]     = useState(false);
  const [markingId, setMarkingId]       = useState<string | null>(null);
  const [unreadCount, setUnreadCount]   = useState(0);
  const bellRef = useRef<HTMLDivElement>(null);

  const canWrite = permissions.includes('notifications:write');

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Background poll for unread count
  useEffect(() => {
    let mounted = true;
    async function loadUnread() {
      try {
        const res = await fetchNotifications(1, 50);
        if (!mounted) return;
        setUnreadCount(res.items.filter((n) => !n.readAt).length);
        if (!bellOpen) setItems(res.items.slice(0, 8));
      } catch {}
    }
    void loadUnread();
    const id = setInterval(() => void loadUnread(), 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, [bellOpen]);

  // Fetch fresh items when dropdown opens
  async function openBell() {
    setBellOpen((v) => {
      if (v) return false;
      return true;
    });
    setBellLoading(true);
    try {
      const res = await fetchNotifications(1, 8);
      setItems(res.items);
      setUnreadCount(res.items.filter((n) => !n.readAt).length);
    } catch {} finally {
      setBellLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    if (!canWrite || markingId) return;
    setMarkingId(id);
    await markNotificationRead(id).catch(() => {});
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    setMarkingId(null);
  }

  async function handleMarkAll() {
    if (!canWrite || markingAll) return;
    setMarkingAll(true);
    await markAllNotificationsRead().catch(() => {});
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnreadCount(0);
    setMarkingAll(false);
  }

  function handleItemClick(n: NotificationItem) {
    if (!n.readAt) {
      // Optimistic update — decrement badge immediately before async API call
      setUnreadCount((c) => Math.max(0, c - 1));
      setItems((prev) => prev.map((item) =>
        item.id === n.id ? { ...item, readAt: new Date().toISOString() } : item,
      ));
      markNotificationRead(n.id).catch(() => {});
    }
    const dest = resolveDest(n);
    if (dest) { setBellOpen(false); navigate(dest); }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const initials  = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';
  const roleLabel = user?.role?.replace(/_/g, ' ') ?? 'Admin';

  return (
    <header
      style={{ fontFamily: IBM }}
      className="h-14 bg-white border-b border-slate-200 flex items-center px-4 md:px-5 gap-1 shrink-0 relative z-40"
    >
      {/* Hamburger — mobile only */}
      <button
        type="button"
        onClick={onMenuToggle}
        aria-label="Toggle menu"
        className="md:hidden p-2 rounded text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 mr-1"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Page title */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {back && (
          <button
            type="button"
            onClick={() => navigate(back)}
            aria-label="Go back"
            className="p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <h1 className="text-base font-semibold text-slate-900 leading-tight truncate">{title}</h1>
      </div>

      {/* ── Notification bell ── */}
      <div className="relative shrink-0" ref={bellRef}>
        <button
          type="button"
          onClick={openBell}
          aria-label="Notifications"
          className={cn(
            'relative p-2 rounded-lg transition-colors cursor-pointer',
            bellOpen
              ? 'bg-slate-100 text-slate-700'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700',
          )}
        >
          <Bell className="w-[18px] h-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[14px] h-[14px] bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none select-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown panel */}
        {bellOpen && (
          <div className="absolute right-0 top-full mt-2 w-[360px] bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden flex flex-col">

            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-bold text-slate-900">Notifications</p>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold rounded-full leading-none">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              {unreadCount > 0 && canWrite && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  disabled={markingAll}
                  className="flex items-center gap-1 text-[10px] font-semibold text-[#14B87A] hover:text-green-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {markingAll
                    ? <span className="w-2.5 h-2.5 border border-[#14B87A] border-t-transparent rounded-full animate-spin" />
                    : <CheckCheck className="w-3 h-3" />}
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[340px]">
              {bellLoading ? (
                <div className="flex flex-col gap-0">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 animate-pulse">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 shrink-0" />
                      <div className="flex-1 space-y-1.5 py-0.5">
                        <div className="h-3 bg-slate-100 rounded w-3/4" />
                        <div className="h-2.5 bg-slate-100 rounded w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                    <BellOff className="w-4.5 h-4.5 text-slate-300" />
                  </div>
                  <p className="text-[12px] font-semibold text-slate-600">All clear</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">No notifications to show</p>
                </div>
              ) : (
                items.map((n) => {
                  const cfg  = getCfg(n);
                  const dest = resolveDest(n);
                  const Icon = cfg.icon;
                  const isUnread = !n.readAt;

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleItemClick(n)}
                      className={cn(
                        'group relative flex items-start gap-3 px-4 py-3 border-b border-slate-50 transition-colors last:border-0',
                        dest ? 'cursor-pointer' : 'cursor-default',
                        isUnread ? 'bg-white hover:bg-slate-50/80' : 'bg-white/50 hover:bg-white',
                      )}
                    >
                      {/* Unread accent */}
                      {isUnread && (
                        <div className="absolute left-0 top-3 bottom-3 w-[2.5px] bg-[#14B87A] rounded-r-full" />
                      )}

                      {/* Icon */}
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
                        <Icon className={cn('w-3.5 h-3.5', cfg.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <p className={cn(
                            'text-[12px] leading-snug truncate',
                            isUnread ? 'font-semibold text-slate-900' : 'font-medium text-slate-600',
                          )}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-1 mt-px">{timeAgo(n.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 leading-relaxed">{n.body}</p>
                      </div>

                      {/* Mark read button */}
                      {isUnread && canWrite && (
                        <button
                          type="button"
                          aria-label="Mark as read"
                          onClick={(e) => { e.stopPropagation(); void handleMarkRead(n.id); }}
                          disabled={markingId === n.id}
                          className="opacity-0 group-hover:opacity-100 shrink-0 p-1 rounded text-slate-300 hover:text-[#14B87A] hover:bg-[#14B87A]/10 disabled:opacity-30 transition-all cursor-pointer mt-0.5"
                        >
                          {markingId === n.id
                            ? <span className="w-2.5 h-2.5 border border-[#14B87A] border-t-transparent rounded-full animate-spin block" />
                            : <Check className="w-2.5 h-2.5" />}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer — View all */}
            <div className="shrink-0 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setBellOpen(false); navigate('/notifications'); }}
                className="flex items-center justify-between w-full px-4 py-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#14B87A] transition-colors cursor-pointer group"
              >
                <span>View all notifications</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#14B87A] transition-colors" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-200 mx-2" />

      {/* ── User menu ── */}
      <div className="relative" ref={userRef}>
        <button
          type="button"
          onClick={() => setUserOpen((v) => !v)}
          className="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div className="w-7 h-7 bg-green-700 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 ring-2 ring-[#14B87A]/20 select-none">
            {initials}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-slate-900 leading-tight">{user?.name ?? 'Admin'}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{roleLabel}</p>
          </div>
          <ChevronDown className={cn('w-3 h-3 text-slate-400 transition-transform hidden sm:block', userOpen && 'rotate-180')} />
        </button>

        {userOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded border border-slate-200 shadow-lg z-50 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <div className="w-8 h-8 bg-green-700 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 select-none">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate leading-tight">{user?.name ?? 'Admin'}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{roleLabel}</p>
              </div>
            </div>
            <div className="py-1">
              <button
                type="button"
                onClick={() => { setUserOpen(false); navigate('/profile'); }}
                className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <UserCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                My profile
              </button>
              <button
                type="button"
                onClick={() => { setUserOpen(false); navigate('/settings'); }}
                className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Settings
              </button>
              <div className="mx-3 my-1 h-px bg-slate-100" />
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
