// DEVICE_URL is read from VITE_IOT_DEVICE_URL at build time. The default
// matches the Vite dev proxy fallback in vite.config.ts.
const DEFAULT_DEVICE_URL = 'http://172.20.10.6';
const ENV_DEVICE_URL = (import.meta.env.VITE_IOT_DEVICE_URL as string | undefined) ?? '';

export const IOT_CONFIG = {
  // Default telemetry source. Mock unless VITE_IOT_USE_MOCK=false.
  // Users can switch at runtime with the Mock / ESP32 toggle on the Live Fleet map.
  USE_MOCK: import.meta.env.VITE_IOT_USE_MOCK !== 'false',

  // Real device URL (override via VITE_IOT_DEVICE_URL in .env). The browser
  // reaches it through the dev-only /iot-device proxy in vite.config.ts.
  DEVICE_URL: ENV_DEVICE_URL || DEFAULT_DEVICE_URL,

  // How often to poll in milliseconds
  POLL_INTERVAL: 4000,

  // Abort a device request after this many milliseconds
  REQUEST_TIMEOUT: 3000,

  // How many failures before marking device as offline
  FAILURE_THRESHOLD: 3,
} as const;
