// API base URL helper.
//
// In production, set VITE_API_URL at build time to the deployed Flask URL
// (e.g. https://api.example.com). Locally, the Flask dev
// server (optimizer_api.py or run.py) listens on :5001, which matches the
// fallback below. (Not 5000: macOS AirPlay Receiver uses that port.)

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:5001';

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

export const API_BASE_URL = API_BASE;
