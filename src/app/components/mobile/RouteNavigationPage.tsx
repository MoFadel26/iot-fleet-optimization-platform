import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { toast } from 'sonner';
import { MapPin, CheckCircle2, Clock, AlertTriangle, Package, Inbox } from 'lucide-react';
import { useLanguage } from '@/app/i18n/LanguageContext';
import { useIoT } from '@/app/context/IoTContext';
import { useRoute, type StopStatus } from '@/app/context/RouteContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { EmptyState } from '@/app/components/ui/EmptyState';
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

const FALLBACK_DEPOT_LAT = RIYADH_CENTER.lat;
const FALLBACK_DEPOT_LON = RIYADH_CENTER.lng;

function motionArrow(motion: string): string {
  if (motion === 'ACCELERATING') return '↑';
  if (motion === 'DECELERATING') return '↓';
  if (motion === 'STOPPED') return '■';
  return '→';
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RouteNavigationPage() {
  const { t, isRTL } = useLanguage();
  const {
    iotData: data,
    isConnected,
    isRecalculating,
    recalcTimeMs,
    hasRecalculated,
  } = useIoT();
  const {
    activeStops,
    depot,
    routePath,
    isRouting,
    isLoadingFleet,
  } = useRoute();

  const stops = activeStops ?? [];
  const depotName = depot?.name ?? 'Depot';
  const depotLat = depot?.lat ?? FALLBACK_DEPOT_LAT;
  const depotLon = depot?.lon ?? FALLBACK_DEPOT_LON;

  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [deliveredIds, setDeliveredIds] = useState<Set<number>>(new Set());
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [delayReason, setDelayReason] = useState('traffic');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const vehicleMarkerRef = useRef<L.CircleMarker | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const stopMarkersRef = useRef<L.Marker[]>([]);

  const currentStop = stops[currentStopIndex] ?? null;

  const handleMarkDelivered = () => {
    if (!currentStop) return;
    setDeliveredIds(prev => new Set(prev).add(currentStop.id));
    toast.success(t('nav2.deliveredToast'));
    if (currentStopIndex < stops.length - 1) setCurrentStopIndex(i => i + 1);
  };

  const handleSubmitDelay = () => {
    setDelayDialogOpen(false);
    toast.success(t('nav2.delayReportedToast'));
  };

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, { zoomControl: false })
      .setView([depotLat, depotLon], 13);
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    const marker = L.circleMarker([depotLat, depotLon], {
      radius: 12, fillColor: '#2563eb', color: '#1d4ed8', weight: 3, fillOpacity: 0.95,
    }).addTo(map).bindPopup('EV-02');
    vehicleMarkerRef.current = marker;
    return () => {
      map.remove();
      mapRef.current = null;
      vehicleMarkerRef.current = null;
      routePolylineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw stop markers whenever the active stops change
  useEffect(() => {
    if (!mapRef.current || stops.length === 0) return;
    const map = mapRef.current;

    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];

    let upcomingCount = 0;
    stops.forEach(stop => {
      const label = stop.status === 'upcoming' ? ++upcomingCount : 0;
      const icon =
        stop.status === 'completed' ? buildCompletedStopIcon() :
        stop.status === 'current'   ? buildCurrentStopIcon()   :
        stop.status === 'final'     ? buildFinalStopIcon('Final') :
                                      buildPendingStopIcon(label);
      const marker = L.marker([stop.lat, stop.lon], {
        icon, keyboard: false,
      }).addTo(map).bindTooltip(stop.name, { direction: 'top', offset: [0, -8] });
      stopMarkersRef.current.push(marker);
    });
  }, [stops]);

  // Draw / refresh polyline whenever the shared routePath updates
  useEffect(() => {
    if (!routePath || !mapRef.current) return;
    const prev = routePolylineRef.current;
    if (prev) { prev.setStyle({ opacity: 0 }); setTimeout(() => prev.remove(), 500); }
    routePolylineRef.current = L.polyline(routePath, {
      color: hasRecalculated ? '#f59e0b' : '#2563eb',
      weight: 4, opacity: 0.9,
      dashArray: hasRecalculated ? '10 8' : undefined,
      lineJoin: 'round', lineCap: 'round',
    }).addTo(mapRef.current);
  }, [routePath, hasRecalculated]);

  // Follow vehicle
  useEffect(() => {
    if (!data?.gps_fix || !vehicleMarkerRef.current || !mapRef.current) return;
    vehicleMarkerRef.current.setLatLng([data.lat, data.lon]);
    mapRef.current.setView([data.lat, data.lon], undefined, { animate: true });
  }, [data]);

  const speedColor = !data ? 'text-gray-500' :
    data.speed > 90 ? 'text-red-600' :
    data.speed >= 60 ? 'text-amber-600' : 'text-green-600';

  const tempBadge = !data ? '' :
    data.temp_status === 'TOO HOT' ? 'bg-red-100 text-red-700' :
    data.temp_status === 'WARM' ? 'bg-amber-100 text-amber-700' :
    'bg-green-100 text-green-700';

  const statusLabel = (s: StopStatus) => {
    if (s === 'completed') return t('nav2.completed');
    if (s === 'current')   return t('nav2.current');
    if (s === 'final')     return 'Final';
    return t('nav2.upcoming');
  };

  return (
    <div className="h-full flex flex-col">

      {/* MAP */}
      <div className="relative isolate flex-shrink-0 h-[240px] landscape:h-[180px]">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {(isLoadingFleet || isRouting) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow px-3 py-1 rounded text-xs text-gray-600 flex items-center gap-2" style={{ zIndex: 1000 }}>
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Loading Riyadh route…
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-2 left-2 bg-white/95 border border-gray-200 shadow-md rounded-md px-2 py-1.5 text-[10px] text-gray-700" style={{ zIndex: 1000 }}>
          <div className="font-semibold text-gray-900 mb-0.5">{t('fleet.legend.title')}</div>
          <div className="flex items-center gap-1 mb-0.5">
            <svg width="18" height="5"><line x1="0" y1="2.5" x2="18" y2="2.5" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" /></svg>
            <span className={hasRecalculated ? 'text-gray-400' : ''}>{t('fleet.legend.original')}</span>
          </div>
          {hasRecalculated && (
            <div className="flex items-center gap-1">
              <svg width="18" height="5"><line x1="0" y1="2.5" x2="18" y2="2.5" stroke="#f59e0b" strokeWidth="3" strokeDasharray="4 3" /></svg>
              <span className="font-semibold text-amber-700">{t('fleet.legend.recalc')}</span>
            </div>
          )}
        </div>
      </div>

      {/* LIVE STATS */}
      {data && (
        <div className={`flex items-center gap-3 px-3 py-2 bg-gray-900 text-white text-xs flex-shrink-0 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="flex items-center gap-1 font-bold text-green-400 min-w-[60px]">● {t('iot.liveIndicator')}</span>
          <span className="text-gray-400">|</span>
          <span className={`font-semibold min-w-[60px] ${speedColor}`}>{data.speed.toFixed(1)} km/h</span>
          <span className="text-gray-400">|</span>
          <span className="font-medium">{motionArrow(data.motion)} {data.motion}</span>
          <span className="text-gray-400">|</span>
          <span className="flex items-center gap-1">
            {data.temp.toFixed(1)}°C
            <span className={`px-1 py-0.5 rounded text-xs font-semibold ${tempBadge}`}>{data.temp_status}</span>
          </span>
          <span className="text-gray-400">|</span>
          <span>🛰 {data.satellites}</span>
        </div>
      )}

      {/* DISRUPTION BANNER */}
      {isRecalculating && (
        <div className="bg-amber-500 text-white px-4 py-2 text-sm font-medium flex-shrink-0 flex items-center gap-2">
          ⚡ {t('iot.recalculating')}
          {recalcTimeMs !== null && <span className="text-amber-100 text-xs">{(recalcTimeMs / 1000).toFixed(1)}s</span>}
        </div>
      )}
      {!isConnected && (
        <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 text-xs text-gray-600 flex-shrink-0">
          📡 {t('iot.lastKnown')}
        </div>
      )}

      {/* Current stop detail */}
      {currentStop && (
        <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
          <div className={`flex items-start gap-3 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin className="w-6 h-6 text-blue-700" />
            </div>
            <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">{currentStop.name}</h3>
              <div className={`flex items-center gap-3 text-sm text-gray-600 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Package className="w-4 h-4" />
                  <span>{t('nav2.packages')}</span>
                </div>
                <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Clock className="w-4 h-4" />
                  <span>{t('nav2.eta')}: —</span>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <button onClick={handleMarkDelivered} disabled={deliveredIds.has(currentStop.id)}
              className={`w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${isRTL ? 'flex-row-reverse' : ''}`}>
              <CheckCircle2 className="w-5 h-5" />
              {deliveredIds.has(currentStop.id) ? t('nav2.completed') : t('nav2.markDelivered')}
            </button>
            <button onClick={() => setDelayDialogOpen(true)}
              className={`w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <AlertTriangle className="w-5 h-5" />
              {t('route.reportDelay')}
            </button>
          </div>
        </div>
      )}

      {/* Stops list */}
      <div className="bg-white border-t border-gray-200 flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className={`text-sm font-semibold text-gray-900 mb-1 ${isRTL ? 'text-right' : ''}`}>
            {depotName}
          </h3>
          <p className="text-xs text-gray-400 mb-3">{stops.length} stops · OSRM road routing</p>
          {stops.length === 0 ? (
            <EmptyState icon={Inbox} title={t('nav2.empty.title')} description={t('nav2.empty.desc')} />
          ) : (
            <div className="space-y-2">
              {stops.map((stop, index) => {
                const isDone = deliveredIds.has(stop.id);
                const isCurrent = index === currentStopIndex;
                const effectiveStatus: StopStatus = isDone ? 'completed' : isCurrent ? 'current' : stop.status;
                return (
                  <button key={stop.id} onClick={() => setCurrentStopIndex(index)}
                    className={`w-full ${isRTL ? 'text-right' : 'text-left'} p-3 rounded-lg border transition-colors ${
                      isCurrent ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                    <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                        effectiveStatus === 'completed' ? 'bg-gray-400 text-white' :
                        effectiveStatus === 'current'   ? 'bg-blue-600 text-white' :
                        effectiveStatus === 'final'     ? 'bg-red-600 text-white'  :
                        'bg-white border-2 border-blue-500 text-blue-700'
                      }`}>
                        {effectiveStatus === 'completed' ? <CheckCircle2 className="w-4 h-4" /> :
                         effectiveStatus === 'final' ? '★' : index + 1}
                      </div>
                      <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : ''}`}>
                        <p className={`text-sm font-medium truncate ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>{stop.name}</p>
                        <p className="text-xs text-gray-500">{stop.lat.toFixed(4)}, {stop.lon.toFixed(4)}</p>
                      </div>
                      {(isCurrent || effectiveStatus === 'final') && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          effectiveStatus === 'final' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>{statusLabel(effectiveStatus)}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delay dialog */}
      <Dialog open={delayDialogOpen} onOpenChange={setDelayDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('route.reportDelay')}</DialogTitle>
            <DialogDescription>{t('nav2.delayDialogDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="delay-reason" className="text-sm font-medium text-foreground">{t('nav2.delayReason')}</label>
            <select id="delay-reason" value={delayReason} onChange={e => setDelayReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
              <option value="traffic">{t('nav2.delayReason.traffic')}</option>
              <option value="weather">{t('nav2.delayReason.weather')}</option>
              <option value="vehicle">{t('nav2.delayReason.vehicle')}</option>
              <option value="customer">{t('nav2.delayReason.customer')}</option>
              <option value="other">{t('nav2.delayReason.other')}</option>
            </select>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{t('common.cancel')}</Button></DialogClose>
            <Button variant="default" onClick={handleSubmitDelay}>{t('common.submit')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
