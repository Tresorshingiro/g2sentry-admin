import { ArrowLeft, ChevronDown, LogOut, Menu, Settings, UserCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const STATIC_TITLES: Record<string, string> = {
  '/dashboard':     'Overview',
  '/map':           'Live Map',
  '/guardians':     'Guardian Roster',
  '/guardians/new': 'Register Guardian',
  '/verifications': 'Verifications',
  '/assignments':   'Dispatch Jobs',
  '/analytics':     'Analytics',
  '/billing':       'Billing',
  '/audit':         'Audit Log',
  '/clients':       'Clients',
  '/settings':      'Settings',
  '/profile':       'My Profile',
  '/incidents':     'Incidents',
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

export function Navbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { title, back } = resolveTitle(pathname);

  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
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

      {/* Divider */}
      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* User menu */}
      <div className="relative" ref={userRef}>
        <button
          type="button"
          onClick={() => setUserOpen((v) => !v)}
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
