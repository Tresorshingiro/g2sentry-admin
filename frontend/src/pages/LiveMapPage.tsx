import { Building2, RefreshCw, Shield } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { fetchGuardians } from '@/services/api';
import type { ClientLocation, Guardian, GuardianStatus } from '@/types/guardian';

const ESRI_PORTAL_URL = 'https://esri-rw.maps.arcgis.com';
const ESRI_WEBMAP_ITEM_ID = 'b72c93025ca44956a5411d593d589265';
const ESRI_API_VERSION = '4.31';
const DEFAULT_CENTER = { longitude: 30.030157, latitude: -1.960956 };
const DEFAULT_ZOOM = 12;

const STATUS_COLORS: Record<GuardianStatus, [number, number, number]> = {
  ON_DUTY:   [59, 130, 246],
  AVAILABLE: [34, 197, 94],
  OFFLINE:   [156, 163, 175],
};

function buildMapHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="https://js.arcgis.com/${ESRI_API_VERSION}/esri/themes/light/main.css" />
    <style>
      html, body, #viewDiv { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
      .esri-attribution { font-size: 9px !important; }
    </style>
  </head>
  <body>
    <div id="viewDiv"></div>
    <script src="https://js.arcgis.com/${ESRI_API_VERSION}/"></script>
    <script>
      (function () {
        function post(payload) {
          window.parent.postMessage(JSON.stringify(payload), '*');
        }

        require([
          "esri/WebMap",
          "esri/views/MapView",
          "esri/layers/GraphicsLayer",
          "esri/Graphic",
          "esri/geometry/Point"
        ], function (WebMap, MapView, GraphicsLayer, Graphic, Point) {

          var webmap = new WebMap({
            portalItem: {
              id: "${ESRI_WEBMAP_ITEM_ID}",
              portal: { url: "${ESRI_PORTAL_URL}" }
            }
          });

          var guardianLayer = new GraphicsLayer({ id: 'guardians' });
          var clientLayer   = new GraphicsLayer({ id: 'clients' });
          webmap.addMany([clientLayer, guardianLayer]);

          var view = new MapView({
            container: "viewDiv",
            map: webmap,
            center: [${DEFAULT_CENTER.longitude}, ${DEFAULT_CENTER.latitude}],
            zoom: ${DEFAULT_ZOOM},
            ui: { components: ["zoom", "attribution"] }
          });

          view.when(function () {
            post({ type: 'ready' });
          }, function (err) {
            post({ type: 'error', message: err && err.message ? err.message : String(err) });
          });

          var labelStyle = {
            type: 'text',
            color: [15, 23, 42, 255],
            haloColor: [255, 255, 255, 230],
            haloSize: 2,
            font: { size: 11, weight: 'bold', family: 'sans-serif' },
            xoffset: 12,
            yoffset: 4,
            horizontalAlignment: 'left'
          };

          window.__G2__ = {
            setGuardians: function (items) {
              guardianLayer.removeAll();
              items.forEach(function (g) {
                if (!isFinite(g.lat) || !isFinite(g.lng)) return;
                var color = g.status === 'ON_DUTY'   ? [59,130,246,240]
                          : g.status === 'AVAILABLE' ? [34,197,94,240]
                          :                            [156,163,175,200];
                var pt = new Point({ longitude: g.lng, latitude: g.lat });
                var attrs = { id: g.id, name: g.name, status: g.status, code: g.district };
                var popup = { title: '{name}', content: '<b>Code:</b> {code}<br/><b>Status:</b> {status}' };
                guardianLayer.add(new Graphic({
                  geometry: pt,
                  symbol: { type: 'simple-marker', color: color, size: 16, outline: { color: [255,255,255,255], width: 2.5 } },
                  attributes: attrs,
                  popupTemplate: popup
                }));
                guardianLayer.add(new Graphic({
                  geometry: pt,
                  symbol: Object.assign({}, labelStyle, { text: g.name }),
                  attributes: attrs,
                  popupTemplate: popup
                }));
              });
            },
            setClients: function (items) {
              clientLayer.removeAll();
              items.forEach(function (c) {
                if (!isFinite(c.lat) || !isFinite(c.lng)) return;
                var pt = new Point({ longitude: c.lng, latitude: c.lat });
                var attrs = { id: c.id, name: c.name || 'Client site', org: c.organizationName || '', district: c.district || '' };
                var popup = { title: '{name}', content: '<b>Organisation:</b> {org}<br/><b>District:</b> {district}' };
                clientLayer.add(new Graphic({
                  geometry: pt,
                  symbol: { type: 'simple-marker', style: 'square', color: [217,119,6,230], size: 14, outline: { color: [255,255,255,255], width: 2.5 } },
                  attributes: attrs,
                  popupTemplate: popup
                }));
                clientLayer.add(new Graphic({
                  geometry: pt,
                  symbol: Object.assign({}, labelStyle, { text: c.name || 'Client site', color: [124,45,18,255] }),
                  attributes: attrs,
                  popupTemplate: popup
                }));
              });
            }
          };
        });
      })();
    </script>
  </body>
</html>`;
}

type GuardianTab = 'ALL' | 'DUTY' | 'AVAILABLE';
type SidebarView = 'GUARDIANS' | 'SITES';

interface MapState {
  guardians: Guardian[];
  clientLocations: ClientLocation[];
}

export function LiveMapPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [data, setData] = useState<MapState>({ guardians: [], clientLocations: [] });
  const [guardianTab, setGuardianTab] = useState<GuardianTab>('ALL');
  const [sidebarView, setSidebarView] = useState<SidebarView>('GUARDIANS');

  const html = useMemo(() => buildMapHtml(), []);

  const loadData = useCallback(async () => {
    const { guardians, clientLocations } = await fetchGuardians();
    setData({ guardians, clientLocations });
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);
  const { countdown, refresh } = useAutoRefresh(30, loadData);

  // Push data into iframe whenever map is ready or data changes
  useEffect(() => {
    if (!mapReady || !iframeRef.current?.contentWindow) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g2 = (iframeRef.current.contentWindow as any).__G2__;
      if (g2) {
        g2.setGuardians(data.guardians);
        g2.setClients(data.clientLocations);
      }
    } catch { /* cross-origin fallback */ }
  }, [mapReady, data]);

  // Listen for messages from iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      try {
        const msg = JSON.parse(e.data as string) as { type: string; message?: string };
        if (msg.type === 'ready') setMapReady(true);
        if (msg.type === 'error') setMapError(msg.message ?? 'Map error');
      } catch { /* ignore */ }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const { guardians, clientLocations } = data;
  const onDuty    = useMemo(() => guardians.filter((g) => g.status === 'ON_DUTY'),    [guardians]);
  const available = useMemo(() => guardians.filter((g) => g.status === 'AVAILABLE'),  [guardians]);
  const offline   = useMemo(() => guardians.filter((g) => g.status === 'OFFLINE'),    [guardians]);

  const filteredGuardians =
    guardianTab === 'DUTY'      ? onDuty
    : guardianTab === 'AVAILABLE' ? available
    : guardians;

  const guardianTabs: { tab: GuardianTab; label: string }[] = [
    { tab: 'ALL',       label: `All (${guardians.length})` },
    { tab: 'DUTY',      label: `Duty (${onDuty.length})` },
    { tab: 'AVAILABLE', label: `Available (${available.length})` },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 overflow-hidden">

        {/* Map */}
        <div className="flex-1 relative">
          <iframe
            ref={iframeRef}
            srcDoc={html}
            className="absolute inset-0 w-full h-full border-0"
            title="G2Sentry Live Map"
            sandbox="allow-scripts allow-same-origin"
          />

          {/* Loading overlay */}
          {!mapReady && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-500">Loading ESRI Rwanda map…</p>
              </div>
            </div>
          )}

          {/* Error */}
          {mapError && (
            <div className="absolute top-4 left-16 right-4 z-10 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              Map error · {mapError}
            </div>
          )}

          {/* Legend + refresh — top right */}
          <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 shadow-sm pointer-events-none">
              {[
                { color: 'bg-blue-500',   label: 'On duty' },
                { color: 'bg-green-500',  label: 'Available' },
                { color: 'bg-gray-400',   label: 'Offline' },
                { color: 'bg-orange-500', label: 'Client site', square: true },
              ].map(({ color, label, square }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 ${square ? 'rounded-sm' : 'rounded-full'} ${color}`} />
                  {label}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 hover:bg-white shadow-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {countdown}s
            </button>
          </div>

          {/* Status counters — bottom left (away from zoom controls) */}
          <div className="absolute bottom-6 left-4 z-10 flex gap-2 pointer-events-none">
            {[
              { count: onDuty.length,    label: 'On duty',   bg: 'bg-blue-600' },
              { count: available.length, label: 'Available', bg: 'bg-green-600' },
              { count: offline.length,   label: 'Offline',   bg: 'bg-gray-500' },
            ].map(({ count, label, bg }) => (
              <div key={label} className={`${bg} text-white rounded-lg px-3 py-2 shadow-sm`}>
                <p className="font-bold text-lg leading-none">{count}</p>
                <p className="text-xs opacity-80">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-72 bg-white border-l flex flex-col">

          {/* Sidebar view toggle */}
          <div className="flex border-b">
            <button
              type="button"
              onClick={() => setSidebarView('GUARDIANS')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors cursor-pointer ${
                sidebarView === 'GUARDIANS'
                  ? 'border-b-2 border-green-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> Guardians
            </button>
            <button
              type="button"
              onClick={() => setSidebarView('SITES')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors cursor-pointer ${
                sidebarView === 'SITES'
                  ? 'border-b-2 border-orange-500 text-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" /> Sites ({clientLocations.length})
            </button>
          </div>

          {/* Guardian list */}
          {sidebarView === 'GUARDIANS' && (
            <>
              <div className="p-3 border-b">
                <div className="flex gap-1">
                  {guardianTabs.map(({ tab, label }) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setGuardianTab(tab)}
                      className={`flex-1 py-1.5 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                        guardianTab === tab
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
                {filteredGuardians.map((g) => {
                  const [r, gr, b] = STATUS_COLORS[g.status];
                  return (
                    <li key={g.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                        style={{ backgroundColor: `rgb(${r},${gr},${b})` }}
                      >
                        {g.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{g.name}</p>
                        <p className="text-xs text-gray-400 truncate">{g.district}</p>
                      </div>
                      <StatusBadge status={g.status} />
                    </li>
                  );
                })}
                {filteredGuardians.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-gray-400">No guardians</li>
                )}
              </ul>
            </>
          )}

          {/* Client sites list */}
          {sidebarView === 'SITES' && (
            <ul className="flex-1 overflow-y-auto divide-y">
              {clientLocations.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {s.name ?? 'Client site'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {s.organizationName ? `${s.organizationName}${s.district ? ` · ${s.district}` : ''}` : (s.district ?? '—')}
                    </p>
                  </div>
                  <div className="w-3 h-3 rounded-sm bg-orange-400 shrink-0" />
                </li>
              ))}
              {clientLocations.length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-gray-400">No client sites</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
