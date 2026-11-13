import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { useIoT } from '@/app/context/IoTContext';
import { apiUrl } from '@/services/api';
import {
  fetchAlternateStreetRoute,
  fetchStreetRoute,
  type LatLng,
} from '@/app/utils/streetRouting';

export type StopStatus = 'completed' | 'current' | 'upcoming' | 'final';

export interface RouteStop {
  id: number;
  name: string;
  lat: number;
  lon: number;
  status: StopStatus;
}

export interface FleetVehicle {
  id: string;
  name: string;
  vehicle_type: 'ICE' | 'EV' | 'Hybrid';
  stops: RouteStop[];
  distance_km: number;
  cost_sar: number;
  co2_kg: number;
  load_kg: number;
  idle: boolean;
}

export interface Depot {
  name: string;
  lat: number;
  lon: number;
}

interface FleetRoutesResponse {
  depot: Depot;
  vehicles: FleetVehicle[];
  source: 'optimized' | 'baseline';
  distance_source: 'road' | 'straight_line';
}

type RouteContextValue = {
  activeStops: RouteStop[] | null;
  depot: Depot | null;
  vehicles: FleetVehicle[] | null;
  source: 'optimized' | 'baseline' | null;
  routePath: LatLng[] | null;
  previousRoutePath: LatLng[] | null;
  isRouting: boolean;
  isLoadingFleet: boolean;
  recalculate: (asRecalc?: boolean) => void;
};

const RouteContext = createContext<RouteContextValue | undefined>(undefined);

export function useRoute(): RouteContextValue {
  const ctx = useContext(RouteContext);
  if (!ctx) throw new Error('useRoute must be used inside RouteProvider');
  return ctx;
}

export function RouteProvider({ children }: { children: React.ReactNode }) {
  const { iotData, isRecalculating, setHasRecalculated } = useIoT();

  const [activeStops, setActiveStops] = useState<RouteStop[] | null>(null);
  const [depot, setDepot] = useState<Depot | null>(null);
  const [vehicles, setVehicles] = useState<FleetVehicle[] | null>(null);
  const [source, setSource] = useState<'optimized' | 'baseline' | null>(null);
  const [routePath, setRoutePath] = useState<LatLng[] | null>(null);
  const [previousRoutePath, setPreviousRoutePath] = useState<LatLng[] | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [isLoadingFleet, setIsLoadingFleet] = useState(true);

  // Refs for stable access inside recalculate so its identity stays put.
  const iotDataRef = useRef(iotData);
  const activeStopsRef = useRef<RouteStop[] | null>(null);
  const depotRef = useRef<Depot | null>(null);
  const prevPathRef = useRef<LatLng[] | null>(null);
  const routingTokenRef = useRef(0);

  useEffect(() => { iotDataRef.current = iotData; }, [iotData]);
  useEffect(() => { activeStopsRef.current = activeStops; }, [activeStops]);
  useEffect(() => { depotRef.current = depot; }, [depot]);

  const recalculate = useCallback(async (asRecalc = false) => {
    const stops = activeStopsRef.current;
    const dep = depotRef.current;
    if (!stops || stops.length === 0) return;

    const startLat = iotDataRef.current?.lat ?? dep?.lat;
    const startLon = iotDataRef.current?.lon ?? dep?.lon;
    if (startLat == null || startLon == null) return;

    const token = ++routingTokenRef.current;
    setIsRouting(true);

    const waypoints: LatLng[] = [
      [startLat, startLon],
      ...stops.map(s => [s.lat, s.lon] as LatLng),
    ];

    const baseline = prevPathRef.current;
    const path = asRecalc
      ? await fetchAlternateStreetRoute(waypoints, baseline, 5)
      : await fetchStreetRoute(waypoints);

    if (token !== routingTokenRef.current) return;

    prevPathRef.current = path;
    setPreviousRoutePath(path);
    setRoutePath(path);
    if (asRecalc) setHasRecalculated(true);
    setIsRouting(false);
  }, [setHasRecalculated]);

  // Fetch fleet routes once and seed the active vehicle + initial OSRM path.
  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl('/fleet-routes'))
      .then(r => r.json())
      .then((envelope) => {
        if (cancelled) return;
        if (!envelope?.success) {
          throw new Error(envelope?.error?.message ?? 'fleet-routes failed');
        }
        const data = envelope.data as FleetRoutesResponse;
        const active = data.vehicles.find(v => !v.idle);
        setDepot(data.depot);
        setVehicles(data.vehicles);
        setSource(data.source);
        if (active) setActiveStops(active.stops);
      })
      .catch(() => {
        if (cancelled) return;
        setDepot(null);
        setVehicles(null);
        setSource(null);
        setActiveStops(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingFleet(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Once the active vehicle's stops land, kick off the initial OSRM route.
  const initialRouteDoneRef = useRef(false);
  useEffect(() => {
    if (initialRouteDoneRef.current) return;
    if (!activeStops || activeStops.length === 0 || !depot) return;
    initialRouteDoneRef.current = true;
    recalculate(false);
  }, [activeStops, depot, recalculate]);

  // Falling-edge listener for IoT-triggered recalculations.
  const prevIsRecalcRef = useRef(false);
  useEffect(() => {
    const was = prevIsRecalcRef.current;
    prevIsRecalcRef.current = isRecalculating;
    if (!was || isRecalculating) return;
    if (!activeStopsRef.current || activeStopsRef.current.length === 0) return;
    recalculate(true);
  }, [isRecalculating, recalculate]);

  const value: RouteContextValue = {
    activeStops,
    depot,
    vehicles,
    source,
    routePath,
    previousRoutePath,
    isRouting,
    isLoadingFleet,
    recalculate,
  };

  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}
