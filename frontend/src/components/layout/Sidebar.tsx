import {
  BarChart2,
  Briefcase,
  Building2,
  CheckSquare,
  FileText,
  LayoutDashboard,
  MapPin,
  ScrollText,
  Settings,
  Shield,
  Siren,
  X,
} from 'lucide-react';
import type { ElementType } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

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
      { label: 'Analytics',     icon: BarChart2,  path: '/analytics',     permission: 'admin:analytics:read' },
      { label: 'Audit Log',     icon: ScrollText, path: '/audit',          permission: 'admin:audit:read' },
      { label: 'Settings',      icon: Settings,   path: '/settings' },
    ],
  },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { permissions } = useAuth();

  function canSee(item: NavItem) {
    if (!item.permission) return true;
    return permissions.includes(item.permission);
  }

  return (
    <aside
      className={cn(
        'w-60 bg-[#0D1117] flex flex-col h-full shrink-0',
        // Mobile: fixed overlay, slides in/out
        'fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out',
        // Desktop: static in flow, always visible
        'md:relative md:translate-x-0 md:z-auto',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Logo row */}
      <div className="flex items-center justify-between px-5 py-5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-500 rounded-md flex items-center justify-center shadow-sm shadow-green-500/40">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-base tracking-tight">G2Sentry</span>
        </div>
        {/* Close button — mobile only */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="md:hidden p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-4 overflow-y-auto py-2">
        {nav.map((group) => {
          const visible = group.items.filter(canSee);
          if (!visible.length) return null;
          return (
            <div key={group.section}>
              <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest px-2 mb-1">
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
                          'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
                          isActive
                            ? 'bg-green-700/90 text-white'
                            : 'text-gray-400 hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
