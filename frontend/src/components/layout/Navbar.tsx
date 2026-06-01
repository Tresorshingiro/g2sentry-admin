import { ArrowLeft, Bell, ChevronDown, LogOut, Menu, Settings, UserCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '@/services/api';

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const STATIC_TITLES: Record<string, string> = {
  '/dashboard':        'Overview',
  '/map':              'Live Map',
  '/guardians':        'Guardian Roster',
  '/guardians/new':    'Register Guardian',
  '/verifications':    'Verifications',
  '/assignments':      'Dispatch Jobs',
  '/analytics':        'Analytics',
  '/billing':          'Billing',
  '/audit':            'Audit Log',
  '/clients':          'Clients',
  '/settings':         'Settings',
  '/profile':          'My Profile',
  '/notifications':    'Notifications',
  '/incidents':        'Incidents',
};

function resolveTitle(pathname: string): { title: string; back: string | null } {
  if (STATIC_TITLES[pathname]) return { title: STATIC_TITLES[pathname], back: null };
  if (/^\/guardians\/[^/]+\/onboard$/.test(pathname)) return { title: 'Guardian Onboarding', back: '/guardians' };
  if (/^\/guardians\/[^/]+\/edit$/.test(pathname))   return { title: 'Edit Guardian', back: pathname.replace('/edit', '') };
  if (/^\/guardians\/[^/]+$/.test(pathname))         return { title: 'Guardian Profile', back: '/guardians' };
  if (/^\/assignments\/[^/]+$/.test(pathname))       return { title: 'Job Details', back: '/assignments' };
  if (/^\/clients\/[^/]+$/.test(pathname))           return { title: 'Client Details', back: '/clients' };
  return { title: 'G2Sentry', back: null };
}

function notifDestination(n: NotificationItem): string | null {
  const p = n.payload;
  if (!p) return null;
  if (p.organizationId) return `/clients/${p.organizationId}`;
  if (p.guardianId)     return `/guardians/${p.guardianId}`;
  if (p.jobId)          return `/assignments/${p.jobId}`;
  return null;
}

export function Navbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { user, logout, permissions } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { title, back } = resolveTitle(pathname);

  const [notifOpen, setNotifOpen]     = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);

  const [userOpen, setUserOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef  = useRef<HTMLDivElement>(null);

  const canReadNotifs  = permissions.includes('notifications:read');
  const canWriteNotifs = permissions.includes('notifications:write');

  // Poll for notifications every 30 s
  useEffect(() => {
    if (!canReadNotifs) return;

    function refresh() {
      fetchNotifications(1, 20)
        .then((res) => {
          setNotifications(res.items);
          setUnreadCount(res.items.filter((n) => !n.readAt).length);
          setInitialLoading(false);
        })
        .catch(() => { setInitialLoading(false); });
    }

    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [canReadNotifs]);

  function openNotifications() {
    setNotifOpen((v) => !v);
    setUserOpen(false);
  }

  async function handleMarkRead(id: string) {
    await markNotificationRead(id).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  function handleNotifClick(n: NotificationItem) {
    if (!n.readAt && canWriteNotifs) void handleMarkRead(n.id);
    const dest = notifDestination(n);
    if (dest) { navigate(dest); setNotifOpen(false); }
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userRef.current  && !userRef.current.contains(e.target as Node))  setUserOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const initials  = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';
  const roleLabel = user?.role?.replace(/_/g, ' ').toLowerCase() ?? 'admin';

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 md:px-6 gap-1 shrink-0">
      {/* Hamburger — mobile only */}
      <button
        type="button"
        onClick={onMenuToggle}
        aria-label="Toggle menu"
        className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 mr-1"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Left — page title */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        {back && (
          <button
            type="button"
            onClick={() => navigate(back)}
            aria-label="Go back"
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <h1 className="text-sm font-semibold text-slate-900 truncate">{title}</h1>
      </div>

      {/* Notifications bell */}
      <div className="relative" ref={notifRef}>
        <button
          type="button"
          onClick={openNotifications}
          aria-label="Notifications"
          className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full ring-2 ring-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-100/80 z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-600 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && canWriteNotifs && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-green-600 hover:text-green-700 font-medium transition-colors cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <ul className="max-h-80 overflow-y-auto divide-y divide-slate-50">
              {initialLoading ? (
                <li className="flex justify-center py-10">
                  <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                </li>
              ) : notifications.length === 0 ? (
                <li className="px-4 py-10 text-center">
                  <Bell className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No notifications yet</p>
                </li>
              ) : (
                notifications.map((n) => (
                  <li
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer',
                      !n.readAt ? 'bg-green-50/50 hover:bg-green-50' : 'hover:bg-slate-50',
                    )}
                  >
                    <div className="mt-1.5 shrink-0">
                      <div className={cn(
                        'w-1.5 h-1.5 rounded-full',
                        !n.readAt ? 'bg-green-500' : 'bg-slate-200',
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-xs leading-snug',
                        !n.readAt ? 'text-slate-900 font-semibold' : 'text-slate-600',
                      )}>
                        {n.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>

            {/* Footer — view all */}
            <div className="border-t border-slate-100 bg-slate-50/60">
              <button
                type="button"
                onClick={() => { setNotifOpen(false); navigate('/notifications'); }}
                className="w-full px-4 py-2.5 text-xs font-medium text-green-600 hover:text-green-700 hover:bg-slate-100 transition-colors cursor-pointer text-center"
              >
                View all notifications
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* User menu */}
      <div className="relative" ref={userRef}>
        <button
          type="button"
          onClick={() => { setUserOpen((v) => !v); setNotifOpen(false); }}
          className="flex items-center gap-2.5 pl-1 pr-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <div className="w-7 h-7 bg-green-600 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 ring-2 ring-green-500/20">
            {initials}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-slate-900 leading-tight">{user?.name ?? 'Admin'}</p>
            <p className="text-[10px] text-slate-400 capitalize leading-tight">{roleLabel}</p>
          </div>
          <ChevronDown className={cn(
            'w-3.5 h-3.5 text-slate-400 transition-transform hidden sm:block',
            userOpen && 'rotate-180',
          )} />
        </button>

        {userOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-100/80 z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <p className="text-xs font-semibold text-slate-900 truncate">{user?.name ?? 'Admin'}</p>
              <p className="text-[11px] text-slate-400 capitalize mt-0.5">{roleLabel}</p>
            </div>
            <div className="py-1">
              <button
                type="button"
                onClick={() => { setUserOpen(false); navigate('/profile'); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <UserCircle className="w-4 h-4 text-slate-400 shrink-0" />
                My profile
              </button>
              <button
                type="button"
                onClick={() => { setUserOpen(false); navigate('/settings'); }}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                Settings
              </button>
              <div className="mx-3 my-1 h-px bg-slate-100" />
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
