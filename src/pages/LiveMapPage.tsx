import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { fetchGuardians } from '@/services/api';
import type { ClientLocation, Guardian, GuardianStatus } from '@/types/guardian';

const STATUS_COLORS: Record<GuardianStatus, string> = {
  ON_DUTY: '#3b82f6',
  AVAILABLE: '#22c55e',
  OFFLINE: '#9ca3af',
};

function guardianIcon(g: Guardian) {
  const color = STATUS_COLORS[g.status];
  return L.divIcon({
    html: `<div style="background:${color};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.3)">${g.initials}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function clientIcon() {
  return L.divIcon({
    html: `<div style="background:#d97706;width:22px;height:22px;border-radius:4px;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.3)"></div>`,
    className: '',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

type FilterTab = 'ALL' | 'DUTY' | 'AVAILABLE';

export function LiveMapPage() {
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [clients, setClients] = useState<ClientLocation[]>([]);
  const [activeTab, setTab] = useState<FilterTab>('ALL');

  const loadData = useCallback(async () => {
    const { guardians: g, clientLocations: c } = await fetchGuardians();
    setGuardians(g);
    setClients(c);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const { countdown, refresh } = useAutoRefresh(30, loadData);

  const onDuty = useMemo(
    () => guardians.filter((g) => g.status === 'ON_DUTY'),
    [guardians],
  );
  const available = useMemo(
    () => guardians.filter((g) => g.status === 'AVAILABLE'),
    [guardians],
  );
  const offline = useMemo(
    () => guardians.filter((g) => g.status === 'OFFLINE'),
    [guardians],
  );

  const filtered =
    activeTab === 'ALL'
      ? guardians
      : activeTab === 'DUTY'
        ? onDuty
        : available;

  const tabData: { tab: FilterTab; label: string; count: number }[] = [
    { tab: 'ALL', label: `All (${guardians.length})`, count: guardians.length },
    { tab: 'DUTY', label: `Duty (${onDuty.length})`, count: onDuty.length },
    {
      tab: 'AVAILABLE',
      label: `Available (${available.length})`,
      count: available.length,
    },
  ];

  const center = useMemo(() => {
    if (guardians.length) return [guardians[0].lat, guardians[0].lng] as [number, number];
    if (clients.length) return [clients[0].lat, clients[0].lng] as [number, number];
    return [-1.9441, 30.0619] as [number, number];
  }, [clients, guardians]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b shrink-0">
        <h1 className="text-xl font-semibold text-gray-900">Live Map</h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-1.5 text-sm text-gray-600 border rounded-md px-3 py-1.5 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> On duty
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-400" /> Offline
            </span>
          </div>
          <span className="text-sm text-gray-400">Auto-refresh in {countdown}s</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <MapContainer
            center={center}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; <a href=&quot;https://www.openstreetmap.org/copyright&quot;>OpenStreetMap</a> &copy; <a href=&quot;https://carto.com/attributions&quot;>CARTO</a>"
            />

            {guardians.map((g) => (
              <Marker key={g.id} position={[g.lat, g.lng]} icon={guardianIcon(g)}>
                <Popup>
                  <p className="font-medium">{g.name}</p>
                  <p className="text-sm text-gray-500">
                    {g.district}
                    {g.assignmentType ? ` · ${g.assignmentType}` : ''}
                  </p>
                </Popup>
              </Marker>
            ))}

            {clients.map((c) => (
              <Marker key={c.id} position={[c.lat, c.lng]} icon={clientIcon()} />
            ))}
          </MapContainer>

          <div className="absolute top-4 left-4 z-[1000] flex gap-2">
            {[
              { count: onDuty.length, label: 'On duty', bg: 'bg-blue-600' },
              {
                count: available.length,
                label: 'Available',
                bg: 'bg-green-600',
              },
              { count: offline.length, label: 'Offline', bg: 'bg-gray-500' },
            ].map(({ count, label, bg }) => (
              <div
                key={label}
                className={`${bg} text-white rounded-lg px-3 py-2`}
              >
                <p className="font-bold text-lg leading-none">{count}</p>
                <p className="text-xs opacity-80">{label}</p>
              </div>
            ))}
          </div>

          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-72">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search guardian or location..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white shadow text-sm outline-none"
                readOnly
              />
            </div>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] bg-white rounded-lg shadow px-4 py-2 flex items-center gap-4 text-xs text-gray-600">
            {[
              { color: STATUS_COLORS.ON_DUTY, initials: 'JM', label: 'On duty' },
              {
                color: STATUS_COLORS.AVAILABLE,
                initials: 'EM',
                label: 'Available',
              },
              { color: STATUS_COLORS.OFFLINE, initials: 'EH', label: 'Offline' },
            ].map(({ color, initials, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-xs"
                  style={{ backgroundColor: color }}
                >
                  {initials}
                </span>
                {label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-sm bg-amber-600" /> Client location
            </span>
          </div>
        </div>

        <div className="w-72 bg-white border-l flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900 mb-3">Active guardians</h2>
            <div className="flex gap-1">
              {tabData.map(({ tab, label }) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setTab(tab)}
                  className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ul className="flex-1 overflow-y-auto divide-y">
            {filtered.map((g) => (
              <li
                key={g.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[g.status] }}
                >
                  {g.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{g.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {g.district}
                    {g.assignmentType ? ` · ${g.assignmentType}` : ''}
                  </p>
                </div>
                <StatusBadge status={g.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

