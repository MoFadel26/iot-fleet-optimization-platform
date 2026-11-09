// Optimization weights saved by SettingsPage and read by RouteOptimizationPage.
// Stored as whole percentages (0–100) for cost, CO2 and workload balance.

export const WEIGHTS_STORAGE_KEY = 'fleetiot-settings-weights';

export interface SavedWeights {
  cost: number;
  co2: number;
  workload: number;
}

/** Returns the weights saved in Settings, or null if none are saved or they are unreadable. */
export function loadSavedWeights(): SavedWeights | null {
  try {
    const raw = localStorage.getItem(WEIGHTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedWeights>;
    const { cost, co2, workload } = parsed;
    if (typeof cost !== 'number' || typeof co2 !== 'number' || typeof workload !== 'number') return null;
    if (cost + co2 + workload <= 0) return null;
    return { cost, co2, workload };
  } catch {
    return null;
  }
}
