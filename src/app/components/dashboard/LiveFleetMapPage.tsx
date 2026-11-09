import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import {
  Wifi, WifiOff, Satellite, Settings, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Thermometer, Wind, Gauge, MapPin, CheckCircle2, Battery, Truck, Zap, RefreshCw,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import { useLanguage } from '@/app/i18n/LanguageContext';
import { useIoT } from '@/app/context/IoTContext';
import { useRoute } from '@/app/context/RouteContext';
import type { Disruption } from '@/app/hooks/useDisruptionDetector';
import { IOT_CONFIG } from '@/app/config/iotConfig';
import { fetchStreetRoute, type LatLng } from '@/app/utils/streetRouting';
import {
  buildCompletedStopIcon,
  buildCurrentStopIcon,
  buildPendingStopIcon,
  buildFinalStopIcon,
} from '@/app/utils/stopMarkers';
import { RIYADH_CENTER } from '@/app/config/geo';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEPOT_LAT = RIYADH_CENTER.lat;
const DEPOT_LON = RIYADH_CENTER.lng;

const DRIVER_NAMES = [
  'Mohammed Al-Saud', 'Abdullah Al-Otaibi', 'Khalid Al-Qahtani',
  'Omar Al-Dosari', 'Faisal Al-Harbi', 'Saleh Al-Shehri', 'Tariq Al-Zahrani',
];

function depotIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:34px;height:34px;border-radius:50%;background:#1d4ed8;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:16px;">🏭</div>`,
    iconSize: [34, 34], iconAnchor: [17, 17],
  });
}

function timeAgo(date: Date): string {
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

function formatDisruptionType(type: Disruption['type']): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LiveFleetMapPage() {
  const { t, isRTL } = useLanguage();
  const {
    iotData: data,
    isConnected,
    lastUpdated,
    consecutiveFailures,
    deviceError,
    useMock,
    setUseMock,
    disruptions,
    isRecalculating,
    recalcTimeMs,
    systemReliability,
    acknowledgeDisruption,
    hasRecalculated,
  } = useIoT();
  const {
    vehicles,
    depot,
    source,
    isLoadingFleet,
    routePath,
    isRouting,
    recalculate,
  } = useRoute();

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const ev02MarkerRef = useRef<L.CircleMarker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const routesDrawnRef = useRef(false);

  // Per-vehicle layers: polyline + stop markers
  const vehiclePolylinesRef = useRef<Map<string, L.Polyline>>(new Map());
  const vehicleMarkersRef = useRef<Map<string, L.Marker[]>>(new Map());

  // UI state
  const [logOpen, setLogOpen] = useState(true);
  const [deviceIpEdit, setDeviceIpEdit] = useState(false);
  const [deviceIp, setDeviceIp] = useState(IOT_CONFIG.DEVICE_URL.replace('http://', ''));
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 1024
  );

  useEffect(() => {
    const handleResize = () => setSidebarOpen(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const unresolvedDisruptions = disruptions.filter((d: Disruption) => d.resolvedAt === null);
  const selectedVehicle = vehicles?.find(v => v.id === selectedVehicleId) ?? null;
  const activeVehiclesCount = vehicles?.filter(v => !v.idle).length ?? 0;

  const panTo = useCallback((lat: number, lng: number, zoom = 14) => {
    mapRef.current?.setView([lat, lng], zoom, { animate: true });
  }, []);

  // Solo mode: hide all vehicle routes/markers, show only the selected vehicle's
  const applySoloMode = useCallback((vehicleId: string | null) => {
    vehiclePolylinesRef.current.forEach((poly, vid) => {
      if (!vehicleId || vid === vehicleId) {
        poly.setStyle({ opacity: 0.9, weight: 5 });
        poly.bringToFront();
      } else {
        poly.setStyle({ opacity: 0, weight: 0 });
      }
    });
    vehicleMarkersRef.current.forEach((markers, vid) => {
      markers.forEach(m => {
        if (!vehicleId || vid === vehicleId) {
          m.setOpacity(1);
        } else {
          m.setOpacity(0);
        }
      });
    });
  }, []);

  const selectVehicle = useCallback((id: string) => {
    setSelectedVehicleId(id);
    applySoloMode(id);
    // Fit map to this vehicle's stops
    const vehicle = vehicles?.find(v => v.id === id);
    if (vehicle && depot && mapRef.current && vehicle.stops.length > 0) {
      const lats = [depot.lat, ...vehicle.stops.map(s => s.lat)];
      const lons = [depot.lon, ...vehicle.stops.map(s => s.lon)];
      const bounds = L.latLngBounds(
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)]
      );
      mapRef.current.fitBounds(bounds, { padding: [40, 40], animate: true });
    }
  }, [vehicles, depot, applySoloMode]);

  // Init base map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: true })
      .setView([DEPOT_LAT, DEPOT_LON], 12);
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);

    // EV-02 live marker (blue dot, updates from IoT GPS)
    const ev02 = L.circleMarker([DEPOT_LAT, DEPOT_LON], {
      radius: 14, fillColor: '#2563eb', color: '#1d4ed8', weight: 3, fillOpacity: 0.9,
    }).addTo(map);
    ev02.bindPopup('EV-02 (Live IoT)');
    ev02.on('click', () => setSelectedVehicleId('EV-02'));
    ev02MarkerRef.current = ev02;

    return () => {
      map.remove();
      mapRef.current = null;
      ev02MarkerRef.current = null;
      routePolylineRef.current = null;
      vehiclePolylinesRef.current.clear();
      vehicleMarkersRef.current.clear();
      routesDrawnRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw all vehicle routes + stops when fleet data arrives
  useEffect(() => {
    if (!vehicles || !depot || !mapRef.current || routesDrawnRef.current) return;
    routesDrawnRef.current = true;
    const map = mapRef.current;

    // Depot marker
    L.marker([depot.lat, depot.lon], { icon: depotIcon(), keyboard: false })
      .addTo(map)
      .bindTooltip(`🏭 ${depot.name}`, { direction: 'top' });

    // Draw each vehicle's route and stop markers (all hidden initially)
    vehicles.forEach((vehicle, vIdx) => {
      if (vehicle.idle || vehicle.stops.length === 0) return;

      const markers: L.Marker[] = [];

      // Stop markers
      let upcomingCount = 0;
      vehicle.stops.forEach(stop => {
        const label = stop.status === 'upcoming' ? ++upcomingCount : 0;
        const icon =
          stop.status === 'completed' ? buildCompletedStopIcon() :
          stop.status === 'current'   ? buildCurrentStopIcon()   :
          stop.status === 'final'     ? buildFinalStopIcon('Final') :
                                        buildPendingStopIcon(label);
        const marker = L.marker([stop.lat, stop.lon], {
          icon,
          interactive: true, keyboard: false,
          opacity: 0,
        })
          .addTo(map)
          .bindTooltip(
            `<b>${stop.name}</b><br><span style="font-size:11px;color:#6b7280;">${stop.status.charAt(0).toUpperCase() + stop.status.slice(1)}</span>`,
            { direction: 'top', offset: [0, -8] }
          );
        markers.push(marker);
      });
      vehicleMarkersRef.current.set(vehicle.id, markers);

      // Route polyline via OSRM (all blue, hidden until vehicle is selected)
      const waypoints: LatLng[] = [
        [depot.lat, depot.lon],
        ...vehicle.stops.map(s => [s.lat, s.lon] as LatLng),
        [depot.lat, depot.lon],
      ];
      fetchStreetRoute(waypoints).then(path => {
        if (!mapRef.current) return;
        const poly = L.polyline(path, {
          color: '#2563eb', weight: 5, opacity: 0,
          lineJoin: 'round', lineCap: 'round',
        }).addTo(mapRef.current);
        vehiclePolylinesRef.current.set(vehicle.id, poly);
      });

      // Offset vehicle marker at depot so they don't overlap
      const offsets = [[0, 0], [0.0012, 0], [-0.0012, 0], [0, 0.0012], [0, -0.0012], [0.0012, 0.0012], [-0.0012, -0.0012]];
      const [dLat, dLon] = offsets[vIdx % offsets.length];
      const vColor = vehicle.vehicle_type === 'EV' ? '#16a34a' : vehicle.vehicle_type === 'Hybrid' ? '#7c3aed' : '#6b7280';
      L.circleMarker([depot.lat + dLat, depot.lon + dLon], {
        radius: 9, fillColor: vColor, color: '#fff', weight: 2, fillOpacity: 0.9,
      }).addTo(map)
        .bindPopup(`<b>${vehicle.name}</b><br>${DRIVER_NAMES[vIdx] ?? 'Driver'}<br>${vehicle.stops.length} stops`)
        .on('click', () => selectVehicle(vehicle.id));
    });

    // Show first vehicle's route by default
    const firstActive = vehicles.find(v => !v.idle);
    if (firstActive) {
      // Wait briefly for OSRM fetch to complete
      setTimeout(() => {
        setSelectedVehicleId(firstActive.id);
        applySoloMode(firstActive.id);
      }, 1500);
    }
  }, [vehicles, depot, selectVehicle, applySoloMode]);

  // Update EV-02 marker from live IoT GPS
  useEffect(() => {
    if (!data?.gps_fix || !ev02MarkerRef.current) return;
    ev02MarkerRef.current.setLatLng([data.lat, data.lon]);
    ev02MarkerRef.current.setPopupContent(
      `EV-02 | ${data.speed.toFixed(1)} km/h | ${data.motion} | ${data.temp.toFixed(1)}°C`
    );
  }, [data]);

  // Draw / refresh EV-02 polyline whenever the shared routePath updates.
  useEffect(() => {
    if (!routePath || !mapRef.current) return;
    const prev = routePolylineRef.current;
    if (prev) { prev.setStyle({ opacity: 0 }); setTimeout(() => prev.remove(), 500); }
    routePolylineRef.current = L.polyline(routePath, {
      color: hasRecalculated ? '#f59e0b' : '#1d4ed8',
      weight: 5, opacity: 0.9,
      dashArray: hasRecalculated ? '10 8' : undefined,
      lineJoin: 'round', lineCap: 'round',
    }).addTo(mapRef.current);
  }, [routePath, hasRecalculated]);

  const reliabilityColor =
    systemReliability >= 97 ? 'bg-green-100 text-green-700' :
    systemReliability >= 93 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700';

  const severityBadge = (s: Disruption['severity']) =>
    s === 'high' ? 'bg-red-100 text-red-700' :
    s === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';

  const tempBadge = (status: string) =>
    status === 'TOO HOT' ? 'bg-red-100 text-red-700' :
    status === 'WARM' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';

  return (
    <div className={`h-full flex flex-col ${isRTL ? 'direction-rtl' : ''}`}>

      {/* STATUS BAR */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
              <span className="text-sm font-medium text-green-700">{t('iot.connected')}</span>
            </>
          ) : deviceError ? (
            <>
              <WifiOff className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-600">{t('iot.offline')}</span>
            </>
          ) : (
            <>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
              <span className="text-sm font-medium text-amber-700">{t('iot.connecting')}</span>
            </>
          )}
        </div>
        <div className="h-4 w-px bg-gray-300" />
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${reliabilityColor}`}>
          {t('iot.reliability')}: {systemReliability.toFixed(1)}%
        </span>
        {recalcTimeMs !== null && (
          <><div className="h-4 w-px bg-gray-300" />
          <span className="text-xs text-gray-600">{t('iot.recalcLast')}: {(recalcTimeMs / 1000).toFixed(1)}s</span></>
        )}
        {unresolvedDisruptions.length > 0 && (
          <><div className="h-4 w-px bg-gray-300" />
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">
            ⚠ {unresolvedDisruptions.length} {t('iot.disruption')}
          </span></>
        )}
        <div className="h-4 w-px bg-gray-300" />
        <div className="flex items-center gap-1 text-xs text-gray-600">
          <Satellite className="w-3.5 h-3.5" />
          <span>{data?.satellites ?? '—'} sats</span>
        </div>
        {source && depot && (
          <><div className="h-4 w-px bg-gray-300" />
          <span className="text-xs text-gray-500">
            <span className="font-medium text-gray-800">{source}</span>
            {' · '}{activeVehiclesCount} active · {depot.name}
          </span></>
        )}
        <button
          onClick={() => data && panTo(data.lat, data.lon)}
          className="ml-2 px-2 py-1 text-xs bg-amber-50 border border-amber-300 text-amber-700 rounded hover:bg-amber-100 transition-colors flex items-center gap-1"
        >
          <Zap className="w-3 h-3" /> Track EV-02
        </button>
        <button
          onClick={() => recalculate(true)}
          disabled={isRouting}
          className="px-2 py-1 text-xs bg-blue-50 border border-blue-300 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-60 transition-colors flex items-center gap-1"
        >
          <RefreshCw className={`w-3 h-3 ${isRouting ? 'animate-spin' : ''}`} />
          {isRouting ? t('fleet.routing') : t('fleet.recalculate')}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <div role="group" aria-label={t('iot.source')} className="flex rounded border border-gray-300 overflow-hidden text-xs">
            {([
              { mock: true, label: t('iot.mock') },
              { mock: false, label: t('iot.esp32') },
            ]).map(({ mock, label }) => (
              <button key={label}
                onClick={() => setUseMock(mock)}
                aria-pressed={useMock === mock}
                className={`px-2 py-1 transition-colors ${
                  useMock === mock ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}>
                {label}
              </button>
            ))}
          </div>
          {deviceIpEdit ? (
            <input className="text-xs border border-gray-300 rounded px-2 py-0.5 w-36 focus:outline-none"
              value={deviceIp} onChange={e => setDeviceIp(e.target.value)}
              onBlur={() => setDeviceIpEdit(false)} autoFocus />
          ) : (
            <button onClick={() => setDeviceIpEdit(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">
              <Settings className="w-3.5 h-3.5" />
              {t('iot.deviceConfig')}: {deviceIp}
            </button>
          )}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className={`flex flex-1 min-h-0 ${isRTL ? 'flex-row-reverse' : ''}`}>

        {/* MAP */}
        <div className="flex-1 relative isolate" role="application" aria-label={t('fleet.mapAriaLabel')}>
          <div ref={mapContainerRef} className="absolute inset-0" />

          {isRecalculating && (
            <div className="absolute top-3 right-3 bg-amber-500 text-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium animate-pulse flex items-center gap-2" style={{ zIndex: 1000 }}>
              ⚡ {t('iot.recalculating')}
            </div>
          )}
          {isLoadingFleet && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow px-3 py-1.5 rounded text-xs text-gray-600 flex items-center gap-2" style={{ zIndex: 1000 }}>
              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Loading Riyadh routes from MongoDB…
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-2 left-2 bg-white/95 border border-gray-200 shadow-md rounded-md px-2.5 py-2 text-[10px] text-gray-700 space-y-1" style={{ zIndex: 1000 }}>
            <div className="font-semibold text-gray-900 mb-1">Stop Legend</div>
            <div className="flex items-center gap-1.5"><span style={{ background: '#9ca3af', color: '#fff', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✓</span> Completed</div>
            <div className="flex items-center gap-1.5"><span style={{ background: '#2563eb', borderRadius: '50%', width: 14, height: 14, display: 'inline-block', border: '2px solid #fff', boxShadow: '0 0 0 2px #93c5fd' }} /> Current</div>
            <div className="flex items-center gap-1.5"><span style={{ background: '#fff', border: '2px solid #6b7280', borderRadius: '50%', width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#1f2937', fontWeight: 700 }}>N</span> Upcoming</div>
            <div className="flex items-center gap-1.5"><span style={{ color: '#dc2626', fontSize: 14 }}>★</span> Final stop</div>
            {hasRecalculated && <div className="flex items-center gap-1.5 pt-0.5 border-t border-gray-200"><svg width="18" height="5"><line x1="0" y1="2.5" x2="18" y2="2.5" stroke="#f59e0b" strokeWidth="3" strokeDasharray="4 3" /></svg> Recalculated</div>}
          </div>
        </div>

        {/* SIDEBAR TOGGLE */}
        <Button variant="outline" size="icon"
          onClick={() => setSidebarOpen(o => !o)}
          className={`self-center z-10 h-10 w-6 rounded-none border-y border-gray-200 bg-white hover:bg-muted ${isRTL ? 'border-l-0 border-r' : 'border-r-0 border-l'}`}>
          {sidebarOpen
            ? (isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)
            : (isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />)}
        </Button>

        {/* RIGHT SIDEBAR */}
        <div className={`bg-white overflow-y-auto flex-shrink-0 ${isRTL ? 'border-r' : 'border-l'} border-gray-200 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-80' : 'w-0 overflow-hidden border-0'}`}>

          {/* Selected vehicle detail */}
          {selectedVehicleId === 'EV-02' && (
            <div className="p-4 border-b border-blue-100 bg-blue-50 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-blue-900">EV-02 — Live IoT</h3>
                <button onClick={() => { setSelectedVehicleId(null); applySoloMode(null); if (routePolylineRef.current) routePolylineRef.current.setStyle({ opacity: 0.9 }); }} className="text-xs text-blue-400 hover:text-blue-600">✕ Show all</button>
              </div>
              {data ? (
                <div className="space-y-1 text-xs text-blue-900">
                  <p><span className="text-blue-500">Speed:</span> {data.speed.toFixed(1)} km/h</p>
                  <p><span className="text-blue-500">Motion:</span> {data.motion}</p>
                  <p><span className="text-blue-500">Temp:</span> {data.temp.toFixed(1)}°C <span className={`ml-1 px-1 rounded font-semibold ${data.temp_status === 'TOO HOT' ? 'bg-red-100 text-red-700' : data.temp_status === 'WARM' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{data.temp_status}</span></p>
                  <p><span className="text-blue-500">Humidity:</span> {data.humidity.toFixed(1)}%</p>
                  <p><span className="text-blue-500">Altitude:</span> {data.altitude.toFixed(1)} m</p>
                  <p><span className="text-blue-500">GPS:</span> {data.gps_status} · {data.satellites} sats</p>
                  <p><span className="text-blue-500">Coords:</span> {data.lat.toFixed(5)}, {data.lon.toFixed(5)}</p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Device offline — connect the ESP32 to see live data</p>
              )}
            </div>
          )}

          {selectedVehicleId !== 'EV-02' && selectedVehicle && (
            <div className="p-4 border-b border-blue-100 bg-blue-50 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-blue-900">{selectedVehicle.name}</h3>
                <button onClick={() => { setSelectedVehicleId(null); applySoloMode(null); }} className="text-xs text-blue-400 hover:text-blue-600">✕ Show all</button>
              </div>
              <div className="space-y-1 text-xs text-blue-900">
                <p><span className="text-blue-500">Type:</span> {selectedVehicle.vehicle_type}</p>
                <p><span className="text-blue-500">Distance:</span> {selectedVehicle.distance_km} km</p>
                <p><span className="text-blue-500">Cost:</span> {selectedVehicle.cost_sar} SAR</p>
                <p><span className="text-blue-500">CO₂:</span> {selectedVehicle.co2_kg} kg</p>
                <p><span className="text-blue-500">Load:</span> {selectedVehicle.load_kg} kg</p>
                {selectedVehicle.stops.length > 0 && (
                  <div className="border-t border-blue-200 pt-1 mt-1">
                    <p className="font-semibold text-blue-700 mb-1">Stops ({selectedVehicle.stops.length})</p>
                    {selectedVehicle.stops.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-1.5 mb-0.5">
                        <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                          s.status === 'completed' ? 'bg-gray-400 text-white' :
                          s.status === 'current'   ? 'bg-blue-600 text-white' :
                          s.status === 'final'     ? 'bg-red-600 text-white'  :
                          'bg-white border border-blue-500 text-blue-700'
                        }`}>
                          {s.status === 'completed' ? '✓' : s.status === 'final' ? '★' : i + 1}
                        </span>
                        <span className={`text-xs truncate ${s.status === 'completed' ? 'text-gray-400 line-through' : 'text-blue-900'}`}>{s.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Live IoT Feed */}
          <div className="p-4 border-b border-gray-100">
            <div className={`flex items-center gap-2 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Wifi className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">{t('iot.liveData')}</h3>
            </div>
            {deviceError && (
              <div role="alert" className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 space-y-1">
                <p className="flex items-center gap-2 font-semibold">
                  <WifiOff className="w-4 h-4 flex-shrink-0" />{t('iot.disconnected')}
                </p>
                <p className="break-words">{deviceError}</p>
                <button onClick={() => setUseMock(true)}
                  className="underline font-medium hover:text-red-900">
                  {t('iot.useMock')}
                </button>
              </div>
            )}
            {!isConnected && consecutiveFailures > 0 && data && (
              <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                <WifiOff className="w-4 h-4 flex-shrink-0" />⚠ {t('iot.lastKnown')}
              </div>
            )}
            {data ? (
              <div className="space-y-3">
                <div className="text-center py-2">
                  <p className="text-4xl font-bold text-gray-900">{data.speed.toFixed(1)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">km/h</p>
                </div>
                {[
                  { icon: Gauge, label: t('iot.motion'), value: data.motion },
                  { icon: Thermometer, label: t('iot.temperature'), value: `${data.temp.toFixed(1)}°C`, badge: data.temp_status, badgeClass: tempBadge(data.temp_status) },
                  { icon: Wind, label: t('iot.humidity'), value: `${data.humidity.toFixed(1)}%` },
                  { icon: MapPin, label: t('iot.satellites'), value: `${data.gps_status} · ${data.satellites} sats` },
                ].map(({ icon: Icon, label, value, badge, badgeClass }) => (
                  <div key={label} className={`flex items-center justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-gray-600 flex items-center gap-1"><Icon className="w-3.5 h-3.5" />{label}</span>
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-gray-900">{value}</span>
                      {badge && <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${badgeClass}`}>{badge}</span>}
                    </div>
                  </div>
                ))}
                {lastUpdated && <p className="text-xs text-gray-400 text-center pt-1">{lastUpdated.toLocaleTimeString()}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">
                {deviceError ? t('iot.offline') : t('iot.connecting')}
              </p>
            )}
          </div>

          {/* Fleet list */}
          <div className="p-4 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{t('home.fleetStatus')}</h3>
            <p className="text-xs text-gray-400 mb-3">Click a vehicle to show its route only</p>
            {isLoadingFleet ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <div className="space-y-2">
                {/* EV-02 — always shown first as the live IoT vehicle */}
                <button
                  onClick={() => {
                    setSelectedVehicleId('EV-02');
                    const lat = data?.lat ?? DEPOT_LAT;
                    const lon = data?.lon ?? DEPOT_LON;
                    panTo(lat, lon);
                    // Show EV-02's route (routePolylineRef) and hide optimizer routes
                    vehiclePolylinesRef.current.forEach(poly => poly.setStyle({ opacity: 0, weight: 0 }));
                    vehicleMarkersRef.current.forEach(markers => markers.forEach(m => m.setOpacity(0)));
                    if (routePolylineRef.current) routePolylineRef.current.setStyle({ opacity: 0.9 });
                  }}
                  className={`w-full ${isRTL ? 'text-right' : 'text-left'} p-3 rounded-lg border transition-colors ${
                    selectedVehicleId === 'EV-02' ? 'border-blue-500 bg-blue-50' : 'border-blue-200 bg-blue-50/40 hover:border-blue-400'
                  }`}
                >
                  <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <Battery className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-900">EV-02</span>
                    {isConnected
                      ? <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-blue-600 text-white">● {t('iot.liveIndicator')}</span>
                      : <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-gray-200 text-gray-500">offline</span>
                    }
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Mohammed Al-Saud</p>
                  {data
                    ? <p className="text-xs text-blue-600 mt-0.5">{data.speed.toFixed(1)} km/h · {data.motion}</p>
                    : <p className="text-xs text-gray-400 mt-0.5">Device disconnected</p>
                  }
                </button>

                {vehicles?.map((v, idx) => {
                  const driverName = DRIVER_NAMES[idx] ?? 'Driver';
                  const isSelected = selectedVehicleId === v.id;
                  const typeIcon = v.vehicle_type === 'EV'
                    ? <Battery className="w-4 h-4 text-green-600 flex-shrink-0" />
                    : <Truck className="w-4 h-4 text-gray-600 flex-shrink-0" />;
                  const typeColor = v.vehicle_type === 'EV' ? 'bg-green-100 text-green-700'
                    : v.vehicle_type === 'Hybrid' ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600';

                  return (
                    <button key={v.id}
                      onClick={() => v.idle ? undefined : selectVehicle(v.id)}
                      disabled={v.idle}
                      className={`w-full ${isRTL ? 'text-right' : 'text-left'} p-3 rounded-lg border transition-colors ${
                        v.idle ? 'border-gray-100 bg-gray-50 opacity-60 cursor-default' :
                        isSelected ? 'border-blue-500 bg-blue-50' :
                        'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}>
                      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex items-center gap-2 min-w-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          {typeIcon}
                          <span className="text-sm font-medium text-gray-900 truncate">{v.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeColor}`}>{v.vehicle_type}</span>
                        </div>
                        {isSelected && <span className="text-xs text-blue-600 font-semibold flex-shrink-0">● shown</span>}
                        {v.idle && <span className="text-xs text-gray-400 flex-shrink-0">idle</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{driverName}</p>
                      {!v.idle && (
                        <p className="text-xs text-green-600 font-medium mt-0.5">
                          ● {t('fleet.onRoute')} · {v.stops.length} stops · {v.distance_km} km
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DISRUPTION LOG */}
      <div className="bg-white border-t border-gray-200 flex-shrink-0">
        <button onClick={() => setLogOpen(o => !o)}
          className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{t('fleet.disruptionLog')}</span>
            {unresolvedDisruptions.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">{unresolvedDisruptions.length}</span>
            )}
          </div>
          {logOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
        </button>
        {logOpen && (
          <div className="px-4 pb-3 max-h-48 overflow-y-auto">
            {disruptions.length === 0 ? (
              <p className="text-sm text-green-600 py-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> ✓ {t('iot.noDisruptions')}</p>
            ) : (
              <div className="space-y-2">
                {disruptions.map((d: Disruption) => (
                  <div key={d.id} className={`flex items-start gap-3 py-2 border-b border-gray-100 last:border-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${severityBadge(d.severity)}`}>{d.severity.toUpperCase()}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium text-gray-900 ${d.resolvedAt ? 'line-through text-gray-400' : ''}`}>{formatDisruptionType(d.type)}</p>
                      <p className="text-xs text-gray-500">{d.description}</p>
                      <p className="text-xs text-gray-400">{timeAgo(d.detectedAt)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {d.resolvedAt ? <span className="text-xs text-green-600 font-medium">✓ Resolved</span> : (
                        <><span className="text-xs text-red-500 font-medium">● Active</span>
                        <button onClick={() => acknowledgeDisruption(d.id)} className="text-xs text-gray-400 hover:text-green-600 underline">{t('iot.resolve')}</button></>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
