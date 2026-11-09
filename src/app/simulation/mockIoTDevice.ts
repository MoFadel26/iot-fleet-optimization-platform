import { RIYADH_CENTER } from '@/app/config/geo';

export interface IoTPayload {
  temp: number;
  humidity: number;
  temp_status: 'NORMAL' | 'WARM' | 'TOO HOT';
  motion: 'STOPPED' | 'ACCELERATING' | 'DECELERATING' | 'STEADY';
  gps_status: string;
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  satellites: number;
  gps_fix: boolean;
}

// Riyadh warehouse — depot / origin for the active driver.
const BASE_LAT = RIYADH_CENTER.lat;
const BASE_LON = RIYADH_CENTER.lng;

function deriveTempStatus(temp: number): IoTPayload['temp_status'] {
  if (temp >= 32) return 'TOO HOT';
  if (temp >= 29) return 'WARM';
  return 'NORMAL';
}

export function generateMockIoTPayload(tick: number): IoTPayload {
  const isDeliveryStop = tick % 30 < 3;

  const speed = isDeliveryStop ? 0 : 55 + 25 * Math.sin(tick * 0.15);

  let motion: IoTPayload['motion'];
  if (isDeliveryStop || speed < 2) {
    motion = 'STOPPED';
  } else {
    const prevSpeed = 55 + 25 * Math.sin((tick - 1) * 0.15);
    const delta = speed - prevSpeed;
    if (delta > 0.5) motion = 'ACCELERATING';
    else if (delta < -0.5) motion = 'DECELERATING';
    else motion = 'STEADY';
  }

  const lat = BASE_LAT + 0.0002 * Math.sin(tick * 0.1) * tick * 0.01;
  const lon = BASE_LON + 0.0002 * Math.cos(tick * 0.1) * tick * 0.01;
  const temp = 26 + 2 * Math.sin(tick * 0.05);
  const humidity = 50 + 5 * Math.sin(tick * 0.03);
  const altitude = 620 + 10 * Math.sin(tick * 0.02);
  const satellites = 12 + Math.floor(Math.random() * 4);

  return {
    temp: Math.round(temp * 10) / 10,
    humidity: Math.round(humidity * 10) / 10,
    temp_status: deriveTempStatus(temp),
    motion,
    gps_status: 'FIX OK',
    lat: Math.round(lat * 1000000) / 1000000,
    lon: Math.round(lon * 1000000) / 1000000,
    altitude: Math.round(altitude * 10) / 10,
    speed: Math.round(speed * 10) / 10,
    satellites,
    gps_fix: true,
  };
}
