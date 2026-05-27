import {
  BarChart2,
  Briefcase,
  Building2,
  FileText,
  LayoutDashboard,
  MapPin,
  Settings,
  Shield,
} from 'lucide-react';
import type { ElementType } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  label: string;
  icon: ElementType;
  path: string;
}

interface NavGroup {
  section: string;
  items: NavItem[];
}

const nav: NavGroup[] = [
  {
    section: 'Main',
    items: [
      { label: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
      { label: 'Live Map', icon: MapPin, path: '/map' },
      { label: 'Assignments', icon: Briefcase, path: '/assignments' },
      { label: 'Guardians', icon: Shield, path: '/guardians' },
      { label: 'Clients', icon: Building2, path: '/clients' },
    ],
  },
  {
    section: 'Reports',
    items: [
      { label: 'Analytics', icon: BarChart2, path: '/analytics' },
      { label: 'Billing', icon: FileText, path: '/billing' },
    ],
  },
  {
    section: 'System',
    items: [{ label: 'Settings', icon: Settings, path: '/settings' }],
  },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AD';

  const roleLabel = user?.role
    ? user.role.replace('_', ' ').toLowerCase()
    : 'Super admin';

  return (
    <aside className="w-60 bg-[#0D1117] flex flex-col shrink-0 h-full">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="w-7 h-7 bg-green-500 rounded-md flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-semibold text-base">G2Sentry</span>
      </div>

      <nav className="flex-1 px-3 space-y-4 overflow-y-auto py-2">
        {nav.map((group) => (
          <div key={group.section}>
            <p className="text-gray-500 text-xs font-medium uppercase tracking-wider px-2 mb-1">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-green-700 text-white'
                          : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="flex items-center gap-3 w-full px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="text-left">
            <p className="text-white text-sm font-medium leading-none">
              {user?.name ?? 'Admin'}
            </p>
            <p className="text-gray-400 text-xs mt-0.5 capitalize">{roleLabel}</p>
          </div>
        </button>
      </div>
    </aside>
  );
}
