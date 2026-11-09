import React, { createContext, useContext, useState } from 'react';
import { useIoTDevice } from '@/app/hooks/useIoTDevice';
import { useDisruptionDetector, Disruption } from '@/app/hooks/useDisruptionDetector';
import { IoTPayload } from '@/app/simulation/mockIoTDevice';
import { IOT_CONFIG } from '@/app/config/iotConfig';

const MOCK_STORAGE_KEY = 'fleetiot-iot-use-mock';

function readStoredUseMock(): boolean {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    // storage unavailable — use the build-time default
  }
  return IOT_CONFIG.USE_MOCK;
}

interface IoTContextType {
  iotData: IoTPayload | null;
  isConnected: boolean;
  lastUpdated: Date | null;
  consecutiveFailures: number;
  /** Why the real device is disconnected; null while connected or in mock mode. */
  deviceError: string | null;
  useMock: boolean;
  setUseMock: (v: boolean) => void;

  disruptions: Disruption[];
  isRecalculating: boolean;
  recalcTimeMs: number | null;
  systemReliability: number;
  acknowledgeDisruption: (id: string) => void;

  hasRecalculated: boolean;
  setHasRecalculated: (v: boolean) => void;
}

const IoTContext = createContext<IoTContextType | undefined>(undefined);

export function useIoT(): IoTContextType {
  const ctx = useContext(IoTContext);
  if (!ctx) throw new Error('useIoT must be used inside IoTProvider');
  return ctx;
}

export function IoTProvider({ children }: { children: React.ReactNode }) {
  const [useMock, setUseMockState] = useState<boolean>(readStoredUseMock);
  const setUseMock = (v: boolean) => {
    setUseMockState(v);
    try {
      localStorage.setItem(MOCK_STORAGE_KEY, String(v));
    } catch {
      // ignore
    }
  };
  const { data, isConnected, lastUpdated, consecutiveFailures, error } = useIoTDevice(useMock);
  const {
    disruptions,
    isRecalculating,
    recalcTimeMs,
    systemReliability,
    acknowledgeDisruption,
  } = useDisruptionDetector(data);

  const [hasRecalculated, setHasRecalculated] = useState<boolean>(false);

  const value: IoTContextType = {
    iotData: data,
    isConnected,
    lastUpdated,
    consecutiveFailures,
    deviceError: error,
    useMock,
    setUseMock,

    disruptions,
    isRecalculating,
    recalcTimeMs,
    systemReliability,
    acknowledgeDisruption,

    hasRecalculated,
    setHasRecalculated,
  };

  return <IoTContext.Provider value={value}>{children}</IoTContext.Provider>;
}
