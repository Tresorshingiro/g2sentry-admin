import {
  BarChart2,
  Briefcase,
  Building2,
  CheckSquare,
  FileText,
  LayoutDashboard,
  LogOut,
  MapPin,
  ScrollText,
  Settings,
  Shield,
  Siren,
  X,
} from 'lucide-react';
import type { ElementType } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const IBM = "'IBM Plex Sans', system-ui, sans-serif";

interface NavItem {
  label: string;
  icon: ElementType;
  path: string;
  permission?: string;
}
interface NavGroup {
  section: string;
  items: NavItem[];
}

const nav: NavGroup[] = [
  {
    section: 'Main',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', permission: 'admin:analytics:read' },
      { label: 'Live Map',  icon: MapPin,          path: '/map' },
    ],
  },
  {
    section: 'Verifications',
    items: [
      { label: 'Verifications', icon: CheckSquare, path: '/verifications', permission: 'admin:verification:read' },
    ],
  },
  {
    section: 'Guardians',
    items: [
      { label: 'All Guardians', icon: Shield, path: '/guardians', permission: 'admin:guardians:read' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Jobs',      icon: Briefcase, path: '/assignments', permission: 'jobs:read' },
      { label: 'Incidents', icon: Siren,     path: '/incidents',   permission: 'jobs:read' },
    ],
  },
  {
    section: 'Clients',
    items: [
      { label: 'Clients', icon: Building2, path: '/clients' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { label: 'Billing', icon: FileText, path: '/billing', permission: 'admin:invoices:read' },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Analytics', icon: BarChart2,  path: '/analytics', permission: 'admin:analytics:read' },
      { label: 'Audit Log', icon: ScrollText, path: '/audit',     permission: 'admin:audit:read' },
      { label: 'Settings',  icon: Settings,   path: '/settings' },
    ],
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { user, permissions, logout } = useAuth();
  const navigate = useNavigate();

  function canSee(item: NavItem) {
    if (!item.permission) return true;
    return permissions.includes(item.permission);
  }

  const initials  = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';
  const roleLabel = user?.role?.replace(/_/g, ' ') ?? 'Admin';

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside
      style={{ fontFamily: IBM }}
      className={cn(
        'w-60 bg-[#0D1117] flex flex-col h-full shrink-0',
        'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out',
        'md:relative md:translate-x-0 md:z-auto',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* ── Logo ── */}
      <div className="flex items-center justify-between px-5 py-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#14B87A] rounded flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-sm tracking-tight leading-none">G2Sentry</span>
            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest leading-none mt-0.5">Admin Portal</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="md:hidden p-1.5 rounded text-slate-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 space-y-4 overflow-y-auto py-2">
        {nav.map((group) => {
          const visible = group.items.filter(canSee);
          if (!visible.length) return null;
          return (
            <div key={group.section}>
              <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-2 mb-1.5">
                {group.section}
              </p>
              <ul className="space-y-0.5">
                {visible.map((item) => (
                  <li key={`${item.path}-${item.label}`}>
                    <NavLink
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 px-2.5 py-2 rounded text-xs transition-colors',
                          isActive
                            ? 'bg-[#14B87A]/15 text-[#14B87A] font-semibold'
                            : 'text-slate-400 hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      <item.icon className="w-3.5 h-3.5 shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* ── Account panel at bottom ── */}
      <div className="shrink-0 border-t border-white/5 px-3 py-3">
        <div className="flex items-center gap-2.5 px-2.5 py-2.5 rounded bg-white/[0.03] border border-white/5">
          {/* Avatar */}
          <div className="w-8 h-8 rounded bg-green-700 flex items-center justify-center text-white text-[11px] font-bold shrink-0 select-none ring-2 ring-[#14B87A]/20">
            {initials}
          </div>

          {/* Name + role */}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold leading-tight truncate">
              {user?.name ?? 'Admin'}
            </p>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-tight mt-0.5 truncate">
              {roleLabel}
            </p>
          </div>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign out"
            className="p-1.5 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
