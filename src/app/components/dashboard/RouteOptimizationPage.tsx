import React, { useRef } from 'react';
import {
  Settings, Play, DollarSign, Leaf, Users,
  CheckCircle2, XCircle, TrendingDown, Truck, Sliders,
} from 'lucide-react';
import { useLanguage } from '@/app/i18n/LanguageContext';
import { Button } from '@/app/components/ui/button';
import { apiUrl } from '@/services/api';
import { loadSavedWeights } from '@/app/config/optimizationWeights';
import { toast } from 'sonner';

// ── Types matching optimizer_api.py response ──────────────────────────────────

interface RouteEntry {
  vehicle: string;
  vehicle_type: string;
  route: number[];
  route_names: string[];
  distance_km: number;
  cost_sar: number;
  co2_kg: number;
  load_kg: number;
  capacity_util: number;
}

interface ApiResult {
  n_customers: number;
  n_vehicles: number;
  baseline: {
    total_cost_sar: number;
    total_co2_kg: number;
    vehicles_used: number;
    workload_balance: number;
  };
  optimized: {
    total_cost_sar: number;
    total_co2_kg: number;
    total_distance_km: number;
    vehicles_used: number;
    fleet_utilization: number;
    workload_balance: number;
    status: 'Optimal' | 'Feasible';
    /** 'Optimal' when proven, otherwise 'Best found (gap X%)'. */
    status_label: string;
    gap_pct: number | null;
    solve_time_s: number;
    routes: Record<string, RouteEntry>;
  };
  comparison: {
    cost_reduction_pct: number;
    co2_reduction_pct: number;
    vehicles_baseline: number;
    vehicles_optimized: number;
    workload_baseline: number;
    workload_optimized: number;
    spec1_met: boolean;
    spec3_met: boolean;
    spec2_met: boolean;
  };
}

const WEIGHTS = {
  cost:     { w_cost: 0.7, w_co2: 0.2, w_fairness: 0.1 },
  co2:      { w_cost: 0.2, w_co2: 0.7, w_fairness: 0.1 },
  workload: { w_cost: 0.2, w_co2: 0.2, w_fairness: 0.6 },
};

type Objective = keyof typeof WEIGHTS | 'settings';

// ── Small helpers ─────────────────────────────────────────────────────────────

function SpecBadge({ met, label }: { met: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${
      met ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {met ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

function Counter({
  value, onChange, min, max,
}: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center text-sm">−</button>
      <span className="w-8 text-center text-sm font-semibold text-gray-900">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))}
        className="w-7 h-7 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center text-sm">+</button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RouteOptimizationPage() {
  const { t, isRTL } = useLanguage();
  // Weights saved on the Settings page (percentages). Read once on mount.
  const [savedWeights] = React.useState(loadSavedWeights);
  const [objective, setObjective] = React.useState<Objective>(savedWeights ? 'settings' : 'cost');
  const [isOptimizing, setIsOptimizing] = React.useState(false);
  const [nCustomers, setNCustomers] = React.useState(10);
  const [nVehicles, setNVehicles] = React.useState(5);
  const [apiResult, setApiResult] = React.useState<ApiResult | null>(null);
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestWeights = () => {
    if (objective === 'settings' && savedWeights) {
      // Normalise so the three weights sum to 1, like the presets.
      const total = savedWeights.cost + savedWeights.co2 + savedWeights.workload;
      return {
        w_cost: savedWeights.cost / total,
        w_co2: savedWeights.co2 / total,
        w_fairness: savedWeights.workload / total,
      };
    }
    return WEIGHTS[objective === 'settings' ? 'cost' : objective];
  };

  const handleOptimize = async () => {
    setIsOptimizing(true);
    setElapsedSec(0);
    timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);

    try {
      const res = await fetch(apiUrl('/optimize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          n_customers: nCustomers,
          n_vehicles: nVehicles,
          ...requestWeights(),
          seed: 42,
        }),
      });
      const envelope = await res.json().catch(() => null);
      if (!res.ok || !envelope?.success) {
        const message = envelope?.error?.message ?? `HTTP ${res.status}`;
        throw new Error(message);
      }
      setApiResult(envelope.data as ApiResult);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('failed to fetch')) {
        toast.error('Cannot reach optimizer — run: python optimizer_api.py');
      } else {
        toast.error(`Optimization failed: ${msg}`);
      }
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsOptimizing(false);
    }
  };

  const objectives = [
    ...(savedWeights ? [{
      key: 'settings' as const, icon: Sliders, label: t('route.settingsWeights'),
      desc: `${t('route.settingsWeightsDesc')} ${savedWeights.cost}/${savedWeights.co2}/${savedWeights.workload}`,
      active: 'border-amber-500 bg-amber-50', iconBg: 'bg-amber-100', iconColor: 'text-amber-700',
    }] : []),
    { key: 'cost' as const,     icon: DollarSign, label: t('route.costMin'),    desc: t('route.costMinDesc'),    active: 'border-blue-500 bg-blue-50',   iconBg: 'bg-blue-100',   iconColor: 'text-blue-700'   },
    { key: 'co2' as const,      icon: Leaf,        label: t('route.co2Min'),     desc: t('route.co2MinDesc'),     active: 'border-green-500 bg-green-50', iconBg: 'bg-green-100',  iconColor: 'text-green-700'  },
    { key: 'workload' as const, icon: Users,       label: t('route.balanced'),   desc: t('route.balancedDesc'),   active: 'border-purple-500 bg-purple-50',iconBg: 'bg-purple-100', iconColor: 'text-purple-700' },
  ];

  const comp = apiResult?.comparison;
  const opt  = apiResult?.optimized;
  const base = apiResult?.baseline;

  return (
    <div className={`p-8 ${isRTL ? 'text-right' : ''}`}>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">{t('route.title')}</h1>
        <p className="text-gray-600">{t('route.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* ── LEFT PANEL ── */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className={`flex items-center gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Settings className="w-5 h-5 text-gray-700" />
              <h2 className="text-lg font-semibold text-gray-900">{t('route.configuration')}</h2>
            </div>

            {/* Objective selector */}
            <div className="space-y-3 mb-6">
              {objectives.map(({ key, icon: Icon, label, desc, active, iconBg, iconColor }) => (
                <button key={key} onClick={() => setObjective(key)}
                  className={`w-full p-4 rounded-lg border-2 transition-all ${isRTL ? 'text-right' : 'text-left'} ${
                    objective === key ? active : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${objective === key ? iconBg : 'bg-gray-100'}`}>
                      <Icon className={`w-5 h-5 ${objective === key ? iconColor : 'text-gray-700'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Fleet parameters */}
            <div className="border-t border-gray-100 pt-5 mb-6 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Fleet Parameters</h3>
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-sm text-gray-600">Customers</span>
                <Counter value={nCustomers} onChange={setNCustomers} min={5} max={15} />
              </div>
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-sm text-gray-600">Vehicles</span>
                <Counter value={nVehicles} onChange={setNVehicles} min={2} max={8} />
              </div>
              <p className="text-xs text-gray-400 pt-1">No time limit · up to 15 customers</p>
            </div>

            <Button
              variant="default" size="lg"
              onClick={handleOptimize} disabled={isOptimizing}
              className="w-full transition-colors duration-150"
            >
              {isOptimizing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Optimizing… ({elapsedSec}s)
                </>
              ) : (
                <><Play className="w-5 h-5" />{t('route.runOptimization')}</>
              )}
            </Button>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('route.fleetSummary')}</h3>
            <div className="space-y-2 text-sm text-gray-600">
              {[
                { label: t('optimization.fleetSize'),   value: opt ? `${opt.vehicles_used}/${nVehicles} active` : `${nVehicles} configured` },
                { label: t('optimization.algorithm'),   value: 'MILP (PuLP/CBC)' },
                { label: t('route.solveTime'),           value: opt ? `${opt.solve_time_s}s` : '—' },
                { label: 'Solver status:',               value: opt ? opt.status_label : '—' },
              ].map(({ label, value }) => (
                <div key={label} className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span>{label}</span>
                  <span className="font-medium text-gray-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="lg:col-span-2">
          {isOptimizing ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 flex flex-col items-center justify-center gap-4 min-h-80">
              <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900">Running MILP Optimizer…</p>
                <p className="text-sm text-gray-500 mt-1">Elapsed: {elapsedSec}s · No time limit</p>
                <p className="text-xs text-gray-400 mt-2">{nCustomers} customers · {nVehicles} vehicles</p>
              </div>
            </div>

          ) : !apiResult ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 flex flex-col items-center justify-center gap-4 min-h-80">
              <Settings className="w-16 h-16 text-gray-300" />
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-1">{t('route.waitingTitle')}</h3>
                <p className="text-gray-500 text-sm mb-3">{t('route.waitingDesc')}</p>
                <p className="text-xs text-gray-400">
                  Requires Python server:&nbsp;
                  <code className="bg-gray-100 px-1 py-0.5 rounded">python optimizer_api.py</code>
                </p>
              </div>
            </div>

          ) : comp && opt && base ? (
            <div className="space-y-6">

              {/* Before → After cards */}
              <div className="grid grid-cols-3 gap-4">
                {([
                  { icon: TrendingDown, label: 'Cost (SAR)',    before: base.total_cost_sar, after: opt.total_cost_sar, pct: comp.cost_reduction_pct, met: comp.spec1_met, spec: 'Spec 1 ≥15%', color: 'text-blue-600' },
                  { icon: Leaf,         label: 'CO₂ (kg)',      before: base.total_co2_kg,   after: opt.total_co2_kg,   pct: comp.co2_reduction_pct,  met: comp.spec3_met, spec: 'Spec 3 ≥10%', color: 'text-green-600' },
                  { icon: Truck,        label: 'Vehicles used', before: base.vehicles_used,  after: opt.vehicles_used,  pct: null,                    met: comp.spec2_met, spec: 'Spec 2',      color: 'text-purple-600' },
                ] as const).map(({ icon: Icon, label, before, after, pct, met, spec, color }) => (
                  <div key={label} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className={`flex items-center gap-2 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                    <p className="text-xs text-gray-400">{before} → <span className="text-gray-900 font-semibold">{after}</span></p>
                    <p className={`text-xl font-bold mt-1 ${met ? 'text-green-600' : 'text-amber-500'}`}>
                      {pct !== null ? `↓ ${pct}%` : (after > before ? `+${after - before}` : String(after))}
                    </p>
                    <div className="mt-1"><SpecBadge met={met} label={spec} /></div>
                  </div>
                ))}
              </div>

              {/* Workload + solve time */}
              <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Workload balance</p>
                  <p className="text-xs text-gray-500">{base.workload_balance} → <span className="font-semibold text-gray-900">{opt.workload_balance}</span> (higher = better)</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p>Solved in <span className="font-semibold text-gray-900">{opt.solve_time_s}s</span></p>
                  <p>Status: <span className={`font-semibold ${opt.status === 'Optimal' ? 'text-green-700' : 'text-amber-600'}`}>{opt.status_label}</span></p>
                  <p>{apiResult.n_customers} customers · {apiResult.n_vehicles} vehicles</p>
                </div>
              </div>

              {/* Per-vehicle routes */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-5 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">{t('route.results')}</h2>
                </div>
                <div className="divide-y divide-gray-100">
                  {Object.entries(opt.routes).map(([vid, r]) => (
                    <div key={vid} className="p-5 hover:bg-gray-50">
                      <div className={`flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                          <span className="text-sm font-semibold text-gray-900">{r.vehicle}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            r.vehicle_type === 'EV'     ? 'bg-green-100 text-green-700' :
                            r.vehicle_type === 'Hybrid' ? 'bg-blue-100 text-blue-700'  :
                                                          'bg-gray-100 text-gray-700'
                          }`}>{r.vehicle_type}</span>
                        </div>
                        <span className="text-xs text-gray-500">{r.distance_km} km</span>
                      </div>
                      <p className="text-xs text-gray-400 font-mono mb-3">{r.route.join(' → ')}</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div><p className="text-xs text-gray-500">Cost</p><p className="text-sm font-medium text-gray-900">{r.cost_sar} SAR</p></div>
                        <div><p className="text-xs text-gray-500">CO₂</p><p className="text-sm font-medium text-gray-900">{r.co2_kg} kg</p></div>
                        <div><p className="text-xs text-gray-500">Load</p><p className="text-sm font-medium text-gray-900">{r.load_kg} kg ({r.capacity_util}%)</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="default" size="lg" onClick={handleOptimize} className="w-full">
                <Play className="w-5 h-5" /> Re-run Optimization
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
