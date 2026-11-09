import { useState, useEffect, useRef } from 'react';
import { IOT_CONFIG } from '@/app/config/iotConfig';
import { generateMockIoTPayload, IoTPayload } from '@/app/simulation/mockIoTDevice';

// Raw JSON shape the ESP32 firmware sends
interface ESP32Response {
  temp_ok: boolean;
  motion_ok: boolean;
  sim_ok: boolean;
  temp_c: number;
  humidity: number;
  temp_status: string;
  motion: string;
  sim_status: string;
}

const BASE_LAT = 24.774265;
const BASE_LON = 46.738586;

function mapESP32(raw: ESP32Response, tick: number): IoTPayload {
  const lat = BASE_LAT + 0.0002 * Math.sin(tick * 0.1) * tick * 0.01;
  const lon = BASE_LON + 0.0002 * Math.cos(tick * 0.1) * tick * 0.01;

  const tempStatus: IoTPayload['temp_status'] =
    raw.temp_status === 'TOO HOT' ? 'TOO HOT' :
    raw.temp_status === 'WARM'    ? 'WARM'    : 'NORMAL';

  const motion: IoTPayload['motion'] =
    raw.motion === 'ACCELERATING' ? 'ACCELERATING' :
    raw.motion === 'DECELERATING' ? 'DECELERATING' :
    raw.motion === 'STEADY'       ? 'STEADY'       : 'STOPPED';

  const speed =
    motion === 'STOPPED'      ? 0 :
    motion === 'STEADY'       ? 45 :
    motion === 'ACCELERATING' ? Math.min(100, 40 + tick % 30) :
    /* DECELERATING */          Math.max(10, 70 - tick % 30);

  return {
    temp: raw.temp_ok ? raw.temp_c : 0,
    humidity: raw.temp_ok ? raw.humidity : 0,
    temp_status: tempStatus,
    motion,
    gps_status: 'SIMULATED',
    lat,
    lon,
    altitude: 620,
    speed: Math.round(speed * 10) / 10,
    satellites: 12,
    gps_fix: true,
  };
}

interface IoTDeviceState {
  data: IoTPayload | null;
  isConnected: boolean;
  lastUpdated: Date | null;
  error: string | null;
  consecutiveFailures: number;
}

const INITIAL_STATE: IoTDeviceState = {
  data: null,
  isConnected: false,
  lastUpdated: null,
  error: null,
  consecutiveFailures: 0,
};

// Turns a failed device request into a message the UI can show as-is.
function describeFailure(err: unknown): string {
  const where = `ESP32 at ${IOT_CONFIG.DEVICE_URL}`;
  if (err instanceof DOMException && err.name === 'TimeoutError') {
    return `${where} did not respond within ${IOT_CONFIG.REQUEST_TIMEOUT / 1000}s`;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return `Cannot reach ${where} (${msg})`;
}

export function useIoTDevice(useMock: boolean): IoTDeviceState {
  const [state, setState] = useState<IoTDeviceState>(INITIAL_STATE);

  const tickRef = useRef(0);
  const failuresRef = useRef(0);
  const lastDataRef = useRef<IoTPayload | null>(null);

  useEffect(() => {
    // Start each mode from a clean state so mock data never shows as live
    // device data (and the reverse).
    setState(INITIAL_STATE);
    failuresRef.current = 0;
    lastDataRef.current = null;
    // Ignore responses that arrive after the mode changed or the page unmounted.
    let cancelled = false;

    const pollMock = () => {
      tickRef.current += 1;
      const data = generateMockIoTPayload(tickRef.current);
      lastDataRef.current = data;
      setState({
        data,
        isConnected: true,
        lastUpdated: new Date(),
        error: null,
        consecutiveFailures: 0,
      });
    };

    // Real device — fetch through the Vite dev proxy (/iot-device) to avoid
    // mixed-content and CORS blocks.
    const pollDevice = async () => {
      try {
        const res = await fetch('/iot-device/data', {
          signal: AbortSignal.timeout(IOT_CONFIG.REQUEST_TIMEOUT),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // Without the dev proxy (vite preview / production) the request falls
        // through to index.html instead of reaching the device.
        if ((res.headers.get('content-type') ?? '').includes('text/html')) {
          throw new Error('no /iot-device proxy; the real device only works with npm run dev');
        }
        const raw: ESP32Response = await res.json();
        if (cancelled) return;
        tickRef.current += 1;
        const data = mapESP32(raw, tickRef.current);
        lastDataRef.current = data;
        failuresRef.current = 0;
        setState({
          data,
          isConnected: true,
          lastUpdated: new Date(),
          error: null,
          consecutiveFailures: 0,
        });
      } catch (err) {
        if (cancelled) return;
        failuresRef.current += 1;
        const failures = failuresRef.current;
        const offline = failures >= IOT_CONFIG.FAILURE_THRESHOLD;
        setState(prev => ({
          ...prev,
          data: lastDataRef.current,
          isConnected: offline ? false : prev.isConnected,
          error: offline ? describeFailure(err) : prev.error,
          consecutiveFailures: failures,
        }));
      }
    };

    const poll = useMock ? pollMock : pollDevice;
    poll();
    const interval = setInterval(poll, IOT_CONFIG.POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [useMock]);

  return state;
}
