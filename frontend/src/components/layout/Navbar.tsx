import { ArrowLeft, ChevronDown, LogOut, Settings, UserCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

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
  if (/^\/guardians\/[^/]+\/edit$/.test(pathname))   return { title: 'Edit Guardian',        back: pathname.replace('/edit', '') };
  if (/^\/guardians\/[^/]+$/.test(pathname))         return { title: 'Guardian Profile',     back: '/guardians' };
  if (/^\/assignments\/[^/]+$/.test(pathname))       return { title: 'Job Details',          back: '/assignments' };
  if (/^\/clients\/[^/]+$/.test(pathname))           return { title: 'Client Details',       back: '/clients' };
  if (/^\/billing\/[^/]+$/.test(pathname))           return { title: 'Invoice Details',      back: '/billing' };
  return { title: 'G2Sentry', back: null };
}

export function Navbar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { title, back } = resolveTitle(pathname);

  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

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
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';
  const roleLabel = user?.role?.replace(/_/g, ' ') ?? 'Admin';

  return (
    <header
      style={{ fontFamily: IBM }}
      className="h-14 bg-white border-b border-slate-200 flex items-center px-4 md:px-5 gap-1 shrink-0"
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
        <div>
          <h1 className="text-sm font-semibold text-slate-900 leading-tight truncate">{title}</h1>
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-200 mx-2" />

      {/* User menu */}
      <div className="relative" ref={userRef}>
        <button
          type="button"
          onClick={() => setUserOpen((v) => !v)}
          className="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded hover:bg-slate-50 transition-colors cursor-pointer"
        >
          {/* Avatar */}
          <div className="w-7 h-7 bg-green-700 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 ring-2 ring-[#14B87A]/20 select-none">
            {initials}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-slate-900 leading-tight">{user?.name ?? 'Admin'}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{roleLabel}</p>
          </div>
          <ChevronDown className={cn(
            'w-3 h-3 text-slate-400 transition-transform hidden sm:block',
            userOpen && 'rotate-180',
          )} />
        </button>

        {userOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded border border-slate-200 shadow-lg z-50 overflow-hidden">
            {/* User info header */}
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
                className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <UserCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                My profile
              </button>
              <button
                type="button"
                onClick={() => { setUserOpen(false); navigate('/settings'); }}
                className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Settings
              </button>
              <div className="mx-3 my-1 h-px bg-slate-100" />
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
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
