import { RIYADH_CENTER } from '@/app/config/geo';

// Mock data for the Fleet Management System

export interface Vehicle {
  id: string;
  name: string;
  type: 'truck' | 'ev' | 'drone';
  status: 'on-route' | 'delayed' | 'idle';
  lat: number;
  lng: number;
  driverId: string;
  driverName: string;
  batteryLevel?: number;
  fuelLevel?: number;
  currentLoad: number;
  maxLoad: number;
  routeStopIds: string[];
}

export type DeliveryStopType =
  | 'depot'
  | 'residential'
  | 'commercial'
  | 'office'
  | 'industrial'
  | 'landmark';

export interface DeliveryStop {
  id: string;
  name: string;
  nameAr: string;
  address: string;
  lat: number;
  lng: number;
  status: 'pending' | 'completed' | 'current';
  type: DeliveryStopType;
  scheduledTime: string;
  actualTime: string | null;
  estimatedTime?: string;
  packageCount?: number;
}

export interface Route {
  id: string;
  vehicleId: string;
  driverId: string;
  stops: DeliveryStop[];
  totalDistance: number;
  estimatedDuration: number;
  status: 'active' | 'completed' | 'planned';
}

export interface KPIData {
  totalCost: number;
  co2Emissions: number;
  fleetUtilization: number;
  workloadFairness: number;
}

// Mock Vehicles — positioned at their first assigned delivery stop in Riyadh, KSA.
// Each vehicle carries a `routeStopIds` list (distinct across vehicles); the last
// id is the vehicle's final destination.
export const mockVehicles: Vehicle[] = [
  {
    id: 'V001',
    name: 'Truck-01',
    type: 'truck',
    status: 'on-route',
    lat: 24.6800,
    lng: 46.6900,
    driverId: 'D001',
    driverName: 'Ahmed Al-Rashid',
    fuelLevel: 75,
    currentLoad: 850,
    maxLoad: 1000,
    routeStopIds: ['S003', 'S009', 'S010'],
  },
  {
    id: 'V002',
    name: 'EV-02',
    type: 'ev',
    status: 'on-route',
    lat: RIYADH_CENTER.lat,
    lng: RIYADH_CENTER.lng,
    driverId: 'D002',
    driverName: 'Mohammed Al-Saud',
    batteryLevel: 68,
    currentLoad: 600,
    maxLoad: 800,
    routeStopIds: ['S004', 'S005', 'S006', 'S008'],
  },
  {
    id: 'V003',
    name: 'Truck-03',
    type: 'truck',
    status: 'idle',
    lat: 24.8300,
    lng: 46.6100,
    driverId: 'D003',
    driverName: 'Khalid Al-Mansour',
    fuelLevel: 92,
    currentLoad: 0,
    maxLoad: 1000,
    routeStopIds: ['S007', 'S011', 'S015'],
  },
  {
    id: 'V004',
    name: 'EV-04',
    type: 'ev',
    status: 'delayed',
    lat: 24.7100,
    lng: 46.7500,
    driverId: 'D004',
    driverName: 'Fahad Al-Najjar',
    batteryLevel: 45,
    currentLoad: 720,
    maxLoad: 800,
    routeStopIds: ['S014', 'S019', 'S020'],
  },
  {
    id: 'V005',
    name: 'Truck-05',
    type: 'truck',
    status: 'on-route',
    lat: 24.6700,
    lng: 46.7400,
    driverId: 'D005',
    driverName: 'Omar Al-Qassim',
    fuelLevel: 58,
    currentLoad: 900,
    maxLoad: 1000,
    routeStopIds: ['S012', 'S013', 'S016'],
  },
  {
    id: 'V006',
    name: 'EV-06',
    type: 'ev',
    status: 'idle',
    lat: 24.6300,
    lng: 46.7800,
    driverId: 'D006',
    driverName: 'Abdullah Al-Farsi',
    batteryLevel: 88,
    currentLoad: 0,
    maxLoad: 800,
    routeStopIds: ['S017', 'S018', 'S020'],
  },
];

// 20-stop dataset for Riyadh, KSA. S001 is the backend depot; the other stops
// use the district coordinates from AREAS in seed_db.py (no duplicates).
export const mockDeliveryStops: DeliveryStop[] = [
  // --- DEPOTS ---
  { id: 'S001', name: 'Riyadh Warehouse (Depot)', nameAr: 'مستودع الرياض', address: 'Riyadh', lat: RIYADH_CENTER.lat, lng: RIYADH_CENTER.lng, status: 'completed', scheduledTime: '08:00', actualTime: '08:00', type: 'depot' },
  { id: 'S002', name: 'Al Murabba Branch', nameAr: 'فرع المربع', address: 'Al Murabba, Riyadh', lat: 24.6500, lng: 46.7100, status: 'completed', scheduledTime: '08:30', actualTime: '08:35', type: 'depot' },

  // --- RESIDENTIAL ---
  { id: 'S003', name: 'Al Wurud District', nameAr: 'حي الورود', address: 'Al Wurud, Riyadh', lat: 24.6800, lng: 46.6900, status: 'completed', scheduledTime: '09:00', actualTime: '09:05', type: 'residential' },
  { id: 'S004', name: 'Al Rawdah District', nameAr: 'حي الروضة', address: 'Al Rawdah, Riyadh', lat: 24.7300, lng: 46.7200, status: 'current', scheduledTime: '09:30', actualTime: null, type: 'residential' },
  { id: 'S005', name: 'Al Nakheel District', nameAr: 'حي النخيل', address: 'Al Nakheel, Riyadh', lat: 24.7650, lng: 46.6350, status: 'pending', scheduledTime: '10:00', actualTime: null, type: 'residential' },
  { id: 'S006', name: 'Al Yasmin District', nameAr: 'حي الياسمين', address: 'Al Yasmin, Riyadh', lat: 24.8100, lng: 46.6200, status: 'pending', scheduledTime: '10:20', actualTime: null, type: 'residential' },
  { id: 'S007', name: 'Al Narjis District', nameAr: 'حي النرجس', address: 'Al Narjis, Riyadh', lat: 24.8300, lng: 46.6100, status: 'pending', scheduledTime: '10:45', actualTime: null, type: 'residential' },
  { id: 'S008', name: 'Hittin District', nameAr: 'حي حطين', address: 'Hittin, Riyadh', lat: 24.7700, lng: 46.6000, status: 'pending', scheduledTime: '11:10', actualTime: null, type: 'residential' },
  { id: 'S009', name: 'Al Suwaidi District', nameAr: 'حي السويدي', address: 'Al Suwaidi, Riyadh', lat: 24.6100, lng: 46.6400, status: 'pending', scheduledTime: '11:35', actualTime: null, type: 'residential' },

  // --- COMMERCIAL ---
  { id: 'S010', name: 'Al Olaya Commercial Area', nameAr: 'منطقة العليا التجارية', address: 'Al Olaya, Riyadh', lat: 24.6900, lng: 46.6850, status: 'pending', scheduledTime: '12:00', actualTime: null, type: 'commercial' },
  { id: 'S011', name: 'Al Malaz Market Area', nameAr: 'منطقة سوق الملز', address: 'Al Malaz, Riyadh', lat: 24.6650, lng: 46.7200, status: 'pending', scheduledTime: '12:25', actualTime: null, type: 'commercial' },
  { id: 'S012', name: 'Al Rabwah Retail Strip', nameAr: 'شارع الربوة التجاري', address: 'Al Rabwah, Riyadh', lat: 24.6700, lng: 46.7400, status: 'pending', scheduledTime: '12:45', actualTime: null, type: 'commercial' },
  { id: 'S013', name: 'Al Hamra Shops', nameAr: 'محلات الحمراء', address: 'Al Hamra, Riyadh', lat: 24.7400, lng: 46.6100, status: 'pending', scheduledTime: '13:05', actualTime: null, type: 'commercial' },

  // --- OFFICE / BUSINESS ---
  { id: 'S014', name: 'King Fahd District Offices', nameAr: 'مكاتب حي الملك فهد', address: 'King Fahd District, Riyadh', lat: 24.7100, lng: 46.7500, status: 'pending', scheduledTime: '13:25', actualTime: null, type: 'office' },
  { id: 'S015', name: 'Sulaimaniyah Office Area', nameAr: 'مكاتب السليمانية', address: 'Sulaimaniyah, Riyadh', lat: 24.6950, lng: 46.6600, status: 'pending', scheduledTime: '13:45', actualTime: null, type: 'office' },
  { id: 'S016', name: 'Al Mursalat Business Area', nameAr: 'منطقة أعمال المرسلات', address: 'Al Mursalat, Riyadh', lat: 24.7200, lng: 46.6400, status: 'pending', scheduledTime: '14:05', actualTime: null, type: 'office' },

  // --- INDUSTRIAL ---
  { id: 'S017', name: 'Al Aziziyah Industrial Area', nameAr: 'المنطقة الصناعية بالعزيزية', address: 'Al Aziziyah, Riyadh', lat: 24.6300, lng: 46.7800, status: 'pending', scheduledTime: '14:30', actualTime: null, type: 'industrial' },
  { id: 'S018', name: 'Al Shifa Industrial Area', nameAr: 'المنطقة الصناعية بالشفا', address: 'Al Shifa, Riyadh', lat: 24.5800, lng: 46.7000, status: 'pending', scheduledTime: '15:00', actualTime: null, type: 'industrial' },

  // --- MIXED USE / LANDMARKS ---
  { id: 'S019', name: 'Al Sahafah District', nameAr: 'حي الصحافة', address: 'Al Sahafah, Riyadh', lat: 24.7900, lng: 46.6500, status: 'pending', scheduledTime: '15:20', actualTime: null, type: 'landmark' },
  { id: 'S020', name: 'Tuwaiq District', nameAr: 'حي طويق', address: 'Tuwaiq, Riyadh', lat: 24.6250, lng: 46.5900, status: 'pending', scheduledTime: '15:45', actualTime: null, type: 'landmark' },
];

// Mock KPI Data
export const mockKPIData: KPIData = {
  totalCost: 45280,
  co2Emissions: 2847,
  fleetUtilization: 73,
  workloadFairness: 0.82,
};

// Mock Analytics Data - Cost vs CO2 over time
export const mockCostCO2Data = [
  { date: 'Jan', cost: 42000, co2: 2950 },
  { date: 'Feb', cost: 41500, co2: 2820 },
  { date: 'Mar', cost: 43200, co2: 2900 },
  { date: 'Apr', cost: 44800, co2: 3100 },
  { date: 'May', cost: 45280, co2: 2847 },
];

// Mock Fleet Utilization Over Time
export const mockUtilizationData = [
  { time: '00:00', utilization: 45 },
  { time: '04:00', utilization: 38 },
  { time: '08:00', utilization: 68 },
  { time: '12:00', utilization: 82 },
  { time: '16:00', utilization: 75 },
  { time: '20:00', utilization: 58 },
];

// Mock Driver Workload Distribution
export const mockWorkloadData = [
  { driver: 'Ahmed', deliveries: 42, hours: 38 },
  { driver: 'Mohammed', deliveries: 38, hours: 36 },
  { driver: 'Khalid', deliveries: 45, hours: 40 },
  { driver: 'Fahad', deliveries: 40, hours: 37 },
  { driver: 'Omar', deliveries: 43, hours: 39 },
  { driver: 'Abdullah', deliveries: 39, hours: 35 },
];

// Mock Notifications
export interface Notification {
  id: string;
  type: 'route-update' | 'delay' | 'message';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

export const mockNotifications: Notification[] = [
  {
    id: 'N001',
    type: 'route-update',
    title: 'Route Updated',
    message: 'Your delivery route has been optimized. Check the new sequence.',
    time: '10 min ago',
    read: false,
  },
  {
    id: 'N002',
    type: 'message',
    title: 'Message from Dispatcher',
    message: 'Please prioritize deliveries in Al Malqa District today.',
    time: '1 hour ago',
    read: false,
  },
  {
    id: 'N003',
    type: 'delay',
    title: 'Traffic Alert',
    message: 'Heavy traffic reported on King Fahd Road. Consider alternate route.',
    time: '2 hours ago',
    read: true,
  },
];

// Mock Driver Performance
export interface DriverPerformance {
  totalDeliveries: number;
  onTimeRate: number;
  efficiency: number;
  workloadBalance: number;
}

export const mockDriverPerformance: DriverPerformance = {
  totalDeliveries: 156,
  onTimeRate: 94,
  efficiency: 87,
  workloadBalance: 82,
};
