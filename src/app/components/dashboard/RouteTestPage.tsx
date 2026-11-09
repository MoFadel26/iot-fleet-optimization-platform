import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { MapPin, Plus, Trash2, Loader2, Check, AlertTriangle, Play, RotateCw, Truck, Home } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useLanguage } from '@/app/i18n/LanguageContext';
import {
  fetchStreetRoute,
  fetchAlternateStreetRoute,
  polylineLength,
  type LatLng,
} from '@/app/utils/streetRouting';
import { buildPendingStopIcon, buildFinalStopIcon } from '@/app/utils/stopMarkers';
import { apiUrl } from '@/services/api';
import { RIYADH_CENTER } from '@/app/config/geo';

// ── Types ─────────────────────────────────────────────────────────────────────

type LocStatus = 'idle' | 'loading' | 'ok' | 'error';

interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
  formatted: string;
}

interface LocatedPoint {
  query: string;
  status: LocStatus;
  errorKey?: string;
  result?: GeocodeResult;
}

interface CustomerEntry extends LocatedPoint {
  id: string;
  name: string;
}

interface VehicleAssignment {
  index: number;
  color: string;
  customerIndices: number[];
  path: LatLng[];
  distanceKm: number;
}

interface RouteResult {
  vehicles: VehicleAssignment[];
  totalDistanceKm: number;
  recalculated: boolean;
}

const MAX_CUSTOMERS = 10;
const MAX_VEHICLES = 6;
const DEFAULT_CENTER: [number, number] = [RIYADH_CENTER.lat, RIYADH_CENTER.lng];

const PRESET_ADDRESSES = [
  "REMA8928",
  "RAYA6801",
  "RAYB7223",
  "RASB7938",
  "RFGA3376",
  "RUQC2893",
  "RQSA3067",
  "RESA2573",
  "REQA3909",
  "RBMA2613",
  "RBFA7005",
  "RBUA6443",
  "RBSA7287",
  "REFA7887",
  "RQWA3477",
];

// Muted palette (mirrors LiveFleetMapPage style)
const VEHICLE_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#0891b2', '#ca8a04', '#475569'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function emptyPoint(): LocatedPoint {
  return { query: '', status: 'idle' };
}

function newCustomer(): CustomerEntry {
  return { id: makeId(), name: '', query: '', status: 'idle' };
}

function depotIcon(): L.DivIcon {
  return L.divIcon({
    className: 'route-test-depot',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
        <div style="background:#16a34a;color:white;border-radius:9999px;width:34px;height:34px;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;">🏠</div>
        <div style="background:#16a34a;color:white;font-size:10px;font-weight:700;letter-spacing:0.5px;padding:2px 8px;border-radius:4px;margin-top:4px;box-shadow:0 1px 4px rgba(0,0,0,0.25);white-space:nowrap;">Depot</div>
      </div>
    `,
    iconSize: [80, 54],
    iconAnchor: [40, 44],
  });
}

async function geocodeQuery(query: string): Promise<GeocodeResult> {
  const res = await fetch(apiUrl(`/api/geocode?q=${encodeURIComponent(query)}`));
  const envelope = await res.json().catch(() => null);
  if (!envelope?.success) {
    // Callers switch on the error code (not the human message) for i18n mapping.
    const code = envelope?.error?.code || 'address_not_found';
    throw new Error(code);
  }
  const data = envelope.data;
  if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
    throw new Error('address_not_found');
  }
  return {
    lat: data.latitude,
    lng: data.longitude,
    label: data.title || data.formatted_address || query,
    formatted: data.formatted_address || data.title || query,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RouteTestPage() {
  const { t, isRTL } = useLanguage();

  const [depot, setDepot] = useState<LocatedPoint>(emptyPoint());
  const [finalDest, setFinalDest] = useState<LocatedPoint>(emptyPoint());
  const [customers, setCustomers] = useState<CustomerEntry[]>([newCustomer()]);
  const [vehicleCount, setVehicleCount] = useState(1);
  const [enforceVehicles, setEnforceVehicles] = useState(false);

  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [editingAfterRoute, setEditingAfterRoute] = useState(false);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const depotMarkerRef = useRef<L.Marker | null>(null);
  const finalMarkerRef = useRef<L.Marker | null>(null);
  const customerMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const routePolylinesRef = useRef<L.Polyline[]>([]);
  const previousPathsRef = useRef<LatLng[][]>([]);

  // ── Map init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: true })
      .setView(DEFAULT_CENTER, 11);
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      depotMarkerRef.current = null;
      finalMarkerRef.current = null;
      customerMarkersRef.current.clear();
      routePolylinesRef.current = [];
    };
  }, []);

  // ── Marker sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (depot.status === 'ok' && depot.result) {
      const { lat, lng, label } = depot.result;
      if (!depotMarkerRef.current) {
        depotMarkerRef.current = L.marker([lat, lng], { icon: depotIcon(), keyboard: false })
          .addTo(map)
          .bindTooltip(`<b>${t('test.depot')}</b><br>${label}`, { direction: 'top', offset: [0, -8] });
      } else {
        depotMarkerRef.current.setLatLng([lat, lng]);
        depotMarkerRef.current.setTooltipContent(`<b>${t('test.depot')}</b><br>${label}`);
      }
    } else if (depotMarkerRef.current) {
      depotMarkerRef.current.remove();
      depotMarkerRef.current = null;
    }
  }, [depot, t]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (finalDest.status === 'ok' && finalDest.result) {
      const { lat, lng, label } = finalDest.result;
      const icon = buildFinalStopIcon(t('test.finalDestShort'));
      if (!finalMarkerRef.current) {
        finalMarkerRef.current = L.marker([lat, lng], { icon, keyboard: false })
          .addTo(map)
          .bindTooltip(`<b>${t('test.finalDest')}</b><br>${label}`, { direction: 'top', offset: [0, -8] });
      } else {
        finalMarkerRef.current.setLatLng([lat, lng]);
        finalMarkerRef.current.setIcon(icon);
        finalMarkerRef.current.setTooltipContent(`<b>${t('test.finalDest')}</b><br>${label}`);
      }
    } else if (finalMarkerRef.current) {
      finalMarkerRef.current.remove();
      finalMarkerRef.current = null;
    }
  }, [finalDest, t]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    customers.forEach((c, idx) => {
      seen.add(c.id);
      if (c.status !== 'ok' || !c.result) {
        const existing = customerMarkersRef.current.get(c.id);
        if (existing) {
          existing.remove();
          customerMarkersRef.current.delete(c.id);
        }
        return;
      }
      const { lat, lng, label } = c.result;
      const tooltip = `<b>${c.name || `${t('test.customer')} ${idx + 1}`}</b><br>${label}`;
      const icon = buildPendingStopIcon(idx + 1);
      const existing = customerMarkersRef.current.get(c.id);
      if (existing) {
        existing.setLatLng([lat, lng]);
        existing.setIcon(icon);
        existing.setTooltipContent(tooltip);
      } else {
        const m = L.marker([lat, lng], { icon, keyboard: false })
          .addTo(map)
          .bindTooltip(tooltip, { direction: 'top', offset: [0, -8] });
        customerMarkersRef.current.set(c.id, m);
      }
    });
    // Drop markers for removed customers
    customerMarkersRef.current.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove();
        customerMarkersRef.current.delete(id);
      }
    });
  }, [customers, t]);

  // Auto-fit when located points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points: [number, number][] = [];
    if (depot.result) points.push([depot.result.lat, depot.result.lng]);
    if (finalDest.result) points.push([finalDest.result.lat, finalDest.result.lng]);
    customers.forEach(c => c.result && points.push([c.result.lat, c.result.lng]));
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13, { animate: true });
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [60, 60], animate: true });
  }, [depot, finalDest, customers]);

  // ── Locate handlers ────────────────────────────────────────────────────────
  const locate = useCallback(
    async (kind: 'depot' | 'final' | 'customer', id?: string) => {
      const setLoading = (status: LocStatus, errorKey?: string, gr?: GeocodeResult) => {
        if (kind === 'depot') {
          setDepot(prev => ({ ...prev, status, errorKey, result: gr ?? prev.result }));
        } else if (kind === 'final') {
          setFinalDest(prev => ({ ...prev, status, errorKey, result: gr ?? prev.result }));
        } else if (id) {
          setCustomers(prev =>
            prev.map(c => (c.id === id ? { ...c, status, errorKey, result: gr ?? c.result } : c))
          );
        }
      };
      const target =
        kind === 'depot' ? depot :
        kind === 'final' ? finalDest :
        customers.find(c => c.id === id);
      if (!target) return;
      const query = target.query.trim();
      if (!query) {
        setLoading('error', 'test.error.emptyInput');
        return;
      }
      setLoading('loading');
      try {
        const gr = await geocodeQuery(query);
        setLoading('ok', undefined, gr);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'address_not_found';
        const key =
          msg === 'address_not_found' ? 'test.error.notFound' :
          msg === 'empty_query' ? 'test.error.emptyInput' :
          msg === 'missing_api_key' ? 'test.error.missingKey' :
          'test.error.upstream';
        setLoading('error', key);
      }
    },
    [depot, finalDest, customers]
  );

  // ── Mutators ───────────────────────────────────────────────────────────────
  const setDepotQuery = (v: string) =>
    setDepot(prev => ({ ...prev, query: v, status: prev.query !== v ? 'idle' : prev.status, errorKey: undefined, result: undefined }));
  const setFinalQuery = (v: string) =>
    setFinalDest(prev => ({ ...prev, query: v, status: prev.query !== v ? 'idle' : prev.status, errorKey: undefined, result: undefined }));
  const setCustomerName = (id: string, name: string) =>
    setCustomers(prev => prev.map(c => (c.id === id ? { ...c, name } : c)));
  const setCustomerQuery = (id: string, query: string) =>
    setCustomers(prev =>
      prev.map(c =>
        c.id === id
          ? { ...c, query, status: c.query !== query ? 'idle' : c.status, errorKey: undefined, result: undefined }
          : c
      )
    );
  const addCustomer = () => {
    if (customers.length >= MAX_CUSTOMERS) return;
    setCustomers(prev => [...prev, newCustomer()]);
  };
  const removeCustomer = (id: string) => {
    setCustomers(prev => (prev.length <= 1 ? prev : prev.filter(c => c.id !== id)));
  };

  // ── Routing ────────────────────────────────────────────────────────────────
  const locatedCustomers = useMemo(
    () => customers.filter(c => c.status === 'ok' && c.result),
    [customers]
  );

  const canGenerate =
    depot.status === 'ok' &&
    finalDest.status === 'ok' &&
    locatedCustomers.length > 0 &&
    vehicleCount >= 1 &&
    !routing;

  const clearRoutePolylines = () => {
    // Remove every explicitly-tracked polyline.
    routePolylinesRef.current.forEach(p => p.remove());
    routePolylinesRef.current = [];

    // Defensive sweep: also remove any route polyline still attached to the map
    // that escaped the ref (e.g. from a partial earlier run). L.Polygon extends
    // L.Polyline, so exclude it — only loose route lines get swept.
    const map = mapRef.current;
    if (map) {
      map.eachLayer(layer => {
        if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
          layer.remove();
        }
      });
    }
  };

  const generate = useCallback(
    async (asRecalc: boolean) => {
      if (!mapRef.current) return;
      if (!depot.result || !finalDest.result) return;
      const located = customers
        .map((c, idx) => ({ idx, customer: c }))
        .filter(({ customer }) => customer.status === 'ok' && customer.result);
      if (located.length === 0) return;

      setRouting(true);
      setRouteError(null);

      try {
        // Ask the backend optimizer for stop-to-vehicle assignment + ordering.
        const res = await fetch(apiUrl('/api/optimize-custom'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            depot: {
              lat: depot.result.lat,
              lng: depot.result.lng,
              name: depot.result.label,
            },
            customers: located.map(({ customer }) => ({
              lat: customer.result!.lat,
              lng: customer.result!.lng,
              name: customer.name || customer.result!.label,
            })),
            n_vehicles: vehicleCount,
            w_cost: 0.5,
            w_co2: 0.3,
            w_fairness: 0.2,
            enforce_vehicles: enforceVehicles,
          }),
        });
        const envelope = await res.json().catch(() => null);
        if (!res.ok || !envelope?.success) {
          throw new Error(envelope?.error?.message ?? `HTTP ${res.status}`);
        }
        const optimizerRoutes = envelope.data.routes as Record<string, {
          vehicle: string;
          stops: Array<{ lat: number; lng: number; name: string }>;
          distance_km: number;
        }>;

        // Map a returned stop back to its index in customers[] by lat/lng.
        const matchCustomer = (lat: number, lng: number): number => {
          for (const { idx, customer } of located) {
            const cr = customer.result!;
            if (Math.abs(cr.lat - lat) < 1e-6 && Math.abs(cr.lng - lng) < 1e-6) {
              return idx;
            }
          }
          return -1;
        };

        const newPaths: LatLng[][] = [];
        const assignments: VehicleAssignment[] = [];
        const routeEntries = Object.values(optimizerRoutes);

        for (let v = 0; v < routeEntries.length; v++) {
          const entry = routeEntries[v];
          const customerIndicesInBucket = entry.stops
            .map(s => matchCustomer(s.lat, s.lng))
            .filter(i => i >= 0);

          const waypoints: LatLng[] = [
            [depot.result.lat, depot.result.lng],
            ...entry.stops.map(s => [s.lat, s.lng] as LatLng),
            [finalDest.result.lat, finalDest.result.lng],
          ];

          let path: LatLng[];
          if (asRecalc && previousPathsRef.current[v]) {
            path = await fetchAlternateStreetRoute(waypoints, previousPathsRef.current[v], 5);
          } else {
            path = await fetchStreetRoute(waypoints);
          }

          newPaths.push(path);
          assignments.push({
            index: v,
            color: VEHICLE_COLORS[v % VEHICLE_COLORS.length],
            customerIndices: customerIndicesInBucket,
            path,
            distanceKm: polylineLength(path),
          });
        }

        clearRoutePolylines();
        const map = mapRef.current!;
        assignments.forEach(a => {
          const poly = L.polyline(a.path, {
            color: a.color,
            weight: 5,
            opacity: 0.9,
            dashArray: asRecalc ? '10 8' : undefined,
            lineJoin: 'round',
            lineCap: 'round',
          }).addTo(map);
          routePolylinesRef.current.push(poly);
        });

        // Fit bounds to all markers + paths
        const allPts: [number, number][] = [];
        allPts.push([depot.result.lat, depot.result.lng]);
        allPts.push([finalDest.result.lat, finalDest.result.lng]);
        located.forEach(({ customer }) => allPts.push([customer.result!.lat, customer.result!.lng]));
        assignments.forEach(a => a.path.forEach(p => allPts.push(p)));
        if (allPts.length > 0) {
          map.fitBounds(L.latLngBounds(allPts), { padding: [60, 60], animate: true });
        }

        previousPathsRef.current = newPaths;
        setResult({
          vehicles: assignments,
          totalDistanceKm: assignments.reduce((s, a) => s + a.distanceKm, 0),
          recalculated: asRecalc,
        });
        setEditingAfterRoute(false);
      } catch (err) {
        console.warn('[RouteTestPage] routing failed:', err);
        setRouteError('test.error.routing');
      } finally {
        setRouting(false);
      }
    },
    [depot, finalDest, customers, vehicleCount, enforceVehicles]
  );

  // ── Status icon ────────────────────────────────────────────────────────────
  const StatusIcon = ({ status }: { status: LocStatus }) => {
    if (status === 'loading') return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    if (status === 'ok') return <Check className="w-4 h-4 text-green-600" />;
    if (status === 'error') return <AlertTriangle className="w-4 h-4 text-red-500" />;
    return <MapPin className="w-4 h-4 text-gray-400" />;
  };

  const fieldsLocked = result !== null && !editingAfterRoute;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`h-full flex flex-col ${isRTL ? 'direction-rtl' : ''}`}>
      <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
        <Truck className="w-5 h-5 text-blue-600" />
        <div>
          <h1 className="text-base font-semibold text-gray-900 leading-tight">{t('test.title')}</h1>
          <p className="text-xs text-gray-500">{t('test.subtitle')}</p>
        </div>
      </div>

      <div className={`flex flex-1 min-h-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {/* LEFT — FORM */}
        <aside
          className={`w-[420px] flex-shrink-0 bg-white overflow-y-auto ${
            isRTL ? 'border-l border-gray-200' : 'border-r border-gray-200'
          }`}
        >
          <div className="p-4 space-y-5">
            {/* Depot */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4 text-green-600" />
                <h2 className="text-sm font-semibold text-gray-900">{t('test.depot')}</h2>
              </div>
              <LocationField
                placeholder={t('test.addressPlaceholder')}
                value={depot.query}
                status={depot.status}
                errorKey={depot.errorKey}
                resultLabel={depot.result?.formatted}
                disabled={fieldsLocked}
                onChange={setDepotQuery}
                onLocate={() => locate('depot')}
                t={t}
                StatusIcon={StatusIcon}
              />
            </section>

            {/* Final destination */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red-600 text-base leading-none">★</span>
                <h2 className="text-sm font-semibold text-gray-900">{t('test.finalDest')}</h2>
              </div>
              <LocationField
                placeholder={t('test.addressPlaceholder')}
                value={finalDest.query}
                status={finalDest.status}
                errorKey={finalDest.errorKey}
                resultLabel={finalDest.result?.formatted}
                disabled={fieldsLocked}
                onChange={setFinalQuery}
                onLocate={() => locate('final')}
                t={t}
                StatusIcon={StatusIcon}
              />
            </section>

            {/* Customers */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-900">
                  {t('test.customers')} ({customers.length}/{MAX_CUSTOMERS})
                </h2>
              </div>

              <div className="space-y-3">
                {customers.map((c, idx) => (
                  <div key={c.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50/40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white border-2 border-blue-500 text-blue-700 text-xs font-bold">
                        {idx + 1}
                      </span>
                      {(customers.length > 1 && (!fieldsLocked || editingAfterRoute)) && (
                        <button
                          type="button"
                          onClick={() => removeCustomer(c.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          aria-label={t('test.removeCustomer')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder={t('test.customerName')}
                      value={c.name}
                      disabled={fieldsLocked}
                      onChange={e => setCustomerName(c.id, e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                    <LocationField
                      placeholder={t('test.addressPlaceholder')}
                      value={c.query}
                      status={c.status}
                      errorKey={c.errorKey}
                      resultLabel={c.result?.formatted}
                      disabled={fieldsLocked}
                      onChange={v => setCustomerQuery(c.id, v)}
                      onLocate={() => locate('customer', c.id)}
                      t={t}
                      StatusIcon={StatusIcon}
                    />
                  </div>
                ))}
              </div>

              {(!fieldsLocked || editingAfterRoute) && customers.length < MAX_CUSTOMERS && (
                <button
                  type="button"
                  onClick={addCustomer}
                  className="mt-3 w-full flex items-center justify-center gap-1.5 text-sm text-blue-600 border border-dashed border-blue-300 rounded-lg py-2 hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-4 h-4" /> {t('test.addCustomer')}
                </button>
              )}
            </section>

            {/* Vehicles */}
            <section>
              <h2 className="text-sm font-semibold text-gray-900 mb-2">{t('test.vehicles')}</h2>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={MAX_VEHICLES}
                  value={vehicleCount}
                  disabled={fieldsLocked}
                  onChange={e => {
                    const n = Math.max(1, Math.min(MAX_VEHICLES, Number(e.target.value) || 1));
                    setVehicleCount(n);
                  }}
                  className="w-20 text-sm border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <span className="text-xs text-gray-500">{t('test.vehiclesHelp')}</span>
              </div>

              <label className="flex items-center gap-2 mt-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={enforceVehicles}
                  disabled={fieldsLocked}
                  onChange={e => setEnforceVehicles(e.target.checked)}
                  className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                />
                {t('test.enforceVehicles')}
              </label>
              {enforceVehicles && (
                <p className="text-xs text-gray-500 mt-1">{t('test.enforceVehiclesHint')}</p>
              )}
            </section>

            {/* Generate / Recalc */}
            <section className="space-y-2 pt-2 border-t border-gray-200">
              {!result && (
                <Button
                  type="button"
                  onClick={() => generate(false)}
                  disabled={!canGenerate}
                  className="w-full flex items-center justify-center gap-2"
                >
                  {routing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {routing ? t('test.routing') : t('test.generate')}
                </Button>
              )}

              {result && !editingAfterRoute && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingAfterRoute(true)}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <RotateCw className="w-4 h-4" /> {t('test.recalculate')}
                </Button>
              )}

              {result && editingAfterRoute && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingAfterRoute(false)}
                    disabled={routing}
                    className="flex-1"
                  >
                    {t('test.cancel')}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => generate(true)}
                    disabled={routing || locatedCustomers.length === 0}
                    className="flex-1 flex items-center justify-center gap-2"
                  >
                    {routing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                    {routing ? t('test.routing') : t('test.confirmRecalc')}
                  </Button>
                </div>
              )}

              {routeError && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {t(routeError)}
                </p>
              )}
              {!canGenerate && !result && !routing && (
                <p className="text-xs text-gray-500">{t('test.generateHint')}</p>
              )}
            </section>

            {/* Results */}
            {result && (
              <section className="border-t border-gray-200 pt-3 space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">{t('test.results')}</h2>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">{t('test.totalStops')}</p>
                    <p className="text-base font-bold text-gray-900">
                      {result.vehicles.reduce((s, v) => s + v.customerIndices.length, 0)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">{t('test.totalDistance')}</p>
                    <p className="text-base font-bold text-gray-900">
                      {result.totalDistanceKm.toFixed(1)} km
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded p-2">
                    <p className="text-xs text-gray-500">{t('test.vehiclesUsed')}</p>
                    <p className="text-base font-bold text-gray-900">{result.vehicles.length}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {result.vehicles.map(v => (
                    <div key={v.index} className="border border-gray-200 rounded-lg p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-3 h-3 rounded-full"
                            style={{ background: v.color }}
                          />
                          <span className="text-xs font-semibold text-gray-900">
                            {t('test.vehicle')} {v.index + 1}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">{v.distanceKm.toFixed(1)} km</span>
                      </div>
                      <ol className="text-xs text-gray-700 space-y-0.5">
                        <li className="flex items-center gap-1.5">
                          <span className="text-green-600">●</span> {t('test.depot')}
                        </li>
                        {v.customerIndices.map(ci => {
                          const c = customers[ci];
                          return (
                            <li key={c.id} className="flex items-center gap-1.5">
                              <span className="inline-block w-4 h-4 rounded-full bg-white border border-blue-500 text-blue-700 text-[10px] font-bold flex items-center justify-center">
                                {ci + 1}
                              </span>
                              <span className="truncate">
                                {c.name || `${t('test.customer')} ${ci + 1}`}
                              </span>
                            </li>
                          );
                        })}
                        <li className="flex items-center gap-1.5">
                          <span className="text-red-600">★</span> {t('test.finalDest')}
                        </li>
                      </ol>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </aside>

        {/* RIGHT — MAP */}
        <div className="flex-1 relative isolate" role="application" aria-label={t('test.mapAriaLabel')}>
          <div ref={mapContainerRef} className="absolute inset-0" />

          {/* Legend */}
          <div
            className="absolute bottom-2 left-2 bg-white/95 border border-gray-200 shadow-md rounded-md px-2.5 py-2 text-[10px] text-gray-700 space-y-1"
            style={{ zIndex: 1000 }}
          >
            <div className="font-semibold text-gray-900 mb-1">{t('test.legendTitle')}</div>
            <div className="flex items-center gap-1.5">
              <span
                style={{
                  background: '#16a34a',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                }}
              >
                🏠
              </span>{' '}
              {t('test.depot')}
            </div>
            <div className="flex items-center gap-1.5">
              <span
                style={{
                  background: '#fff',
                  border: '2px solid #6b7280',
                  borderRadius: '50%',
                  width: 16,
                  height: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                N
              </span>{' '}
              {t('test.customer')}
            </div>
            <div className="flex items-center gap-1.5">
              <span style={{ color: '#dc2626', fontSize: 14 }}>★</span> {t('test.finalDest')}
            </div>
            {result && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-gray-200">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    result.recalculated
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {result.recalculated ? t('test.legendRecalculated') : t('test.legendOriginal')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponent: Locate field with input + button + status ───────────────────

function LocationField({
  placeholder,
  value,
  status,
  errorKey,
  resultLabel,
  disabled,
  onChange,
  onLocate,
  t,
  StatusIcon,
}: {
  placeholder: string;
  value: string;
  status: LocStatus;
  errorKey?: string;
  resultLabel?: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onLocate: () => void;
  t: (k: string) => string;
  StatusIcon: React.FC<{ status: LocStatus }>;
}) {
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder={placeholder}
            value={value}
            disabled={disabled}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !disabled && status !== 'loading') {
                e.preventDefault();
                onLocate();
              }
            }}
            className="w-full text-sm border border-gray-300 rounded px-2.5 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            <StatusIcon status={status} />
          </span>
        </div>
        <select
          value=""
          disabled={disabled}
          onChange={e => {
            const v = e.target.value;
            if (!v) return;
            onChange(v);
            e.target.value = '';
          }}
          aria-label={t('test.presets')}
          className="w-24 text-sm border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option value="">{t('test.presets')}</option>
          {PRESET_ADDRESSES.map(addr => (
            <option key={addr} value={addr}>{addr}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={onLocate}
          disabled={disabled || status === 'loading' || !value.trim()}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'loading' ? t('test.locating') : t('test.locate')}
        </button>
      </div>
      {status === 'ok' && resultLabel && (
        <p className="text-xs text-green-700 truncate">✓ {resultLabel}</p>
      )}
      {status === 'error' && errorKey && (
        <p className="text-xs text-red-600">{t(errorKey)}</p>
      )}
    </div>
  );
}
