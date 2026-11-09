import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'ar' | 'ur';
export type DashboardLanguage = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('fleetiot-lang') as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('fleetiot-lang', lang);
  };

  const isRTL = language === 'ar' || language === 'ur';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRTL]);

  const t = (key: string): string => {
    const translations = allTranslations[language];
    return translations?.[key] ?? allTranslations['en'][key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Translation Tables ──────────────────────────────────────────────────────

const en: Record<string, string> = {
  // App top bar
  'app.webDashboard': 'Web Dashboard',
  'app.mobileApp': 'Mobile App',

  // Dashboard Sidebar
  'nav.overview': 'Overview',
  'nav.liveFleet': 'Live Fleet',
  'nav.optimization': 'Optimization',
  'nav.analytics': 'Analytics',
  'nav.compliance': 'Compliance',
  'nav.settings': 'Settings',
  'nav.portal': 'Dispatcher Portal v2.1',
  'nav.project': 'Senior Design Project 2026',

  // CompliancePage
  'compliance.title': 'Regulatory Compliance',
  'compliance.subtitle': 'Saudi Arabia regulatory framework alignment matrix',
  'compliance.stat.total': 'Total Regulations',
  'compliance.stat.implemented': 'Implemented',
  'compliance.stat.planned': 'Planned',
  'compliance.filter.all': 'All',
  'compliance.filter.traffic': 'Traffic & Vehicles',
  'compliance.filter.delivery': 'Delivery Platform',
  'compliance.filter.arabic': 'Arabic Localization',
  'compliance.filter.data': 'Data Protection',
  'compliance.col.regulation': 'Regulation',
  'compliance.col.authority': 'Authority',
  'compliance.col.implementation': 'System Implementation',
  'compliance.col.status': 'Status',
  'compliance.col.proof': 'Proof',
  'compliance.status.implemented': 'Implemented',
  'compliance.status.planned': 'Planned',
  'compliance.proof.view': 'View Proof',
  'compliance.proof.toggleLang': 'Toggle Language',
  'compliance.cat.traffic': 'Traffic',
  'compliance.cat.delivery': 'Delivery',
  'compliance.cat.arabic': 'Arabic',
  'compliance.cat.data': 'Data',

  // Compliance — regulation rows (name = localized, nameAlt = opposite language subtitle)
  'compliance.reg.1.name': 'Saudi Traffic Law',
  'compliance.reg.1.nameAlt': 'نظام المرور',
  'compliance.reg.1.authority': 'BOE / SASO',
  'compliance.reg.1.implementation': 'Vehicle type attributes (axle count, gross weight) stored in fleet model; routing logic prevents assignment of prohibited road classes per vehicle type.',

  'compliance.reg.2.name': 'Driving hours limits',
  'compliance.reg.2.nameAlt': 'حدود ساعات القيادة',
  'compliance.reg.2.authority': 'TGA / PTA',
  'compliance.reg.2.implementation': 'Route scheduler enforces 9-hr daily cap and 56-hr weekly cap for commercial drivers; mandatory 45-min rest after 4.5 hrs of continuous driving built into dispatch logic.',

  'compliance.reg.3.name': 'Vehicle weight limits',
  'compliance.reg.3.nameAlt': 'حدود الأوزان والأبعاد',
  'compliance.reg.3.authority': 'Roads General Authority',
  'compliance.reg.3.implementation': 'Fleet capacity parameters capped at legal axle-weight limits (21–45 tons by axle count); overloaded assignments blocked at route-generation stage.',

  'compliance.reg.4.name': 'City-level truck/time bans',
  'compliance.reg.4.nameAlt': 'حظر الشاحنات في ساعات الذروة',
  'compliance.reg.4.authority': 'Municipal authorities',
  'compliance.reg.4.implementation': 'Configurable no-go zone polygons and vehicle-class time windows per city; Makkah peak-hour truck ban pre-loaded as default constraint.',

  'compliance.reg.5.name': 'TGA Delivery App registration',
  'compliance.reg.5.nameAlt': 'تسجيل التطبيق لدى هيئة النقل',
  'compliance.reg.5.authority': 'TGA',
  'compliance.reg.5.implementation': "Platform architecture designed to meet TGA 'Delivery Applications' category requirements; registration process initiated with TGA portal.",

  'compliance.reg.6.name': 'Driver identity verification',
  'compliance.reg.6.nameAlt': 'التحقق من هوية السائق',
  'compliance.reg.6.authority': 'TGA',
  'compliance.reg.6.implementation': "Driver login flow includes facial-recognition identity check before shift start, fulfilling TGA's mandatory verification requirement for delivery apps.",
  'compliance.reg.6.note': 'Full verification flow lives in the driver mobile app — switch to Mobile App view from the top bar to see it.',

  'compliance.reg.7.name': 'National Address requirement',
  'compliance.reg.7.nameAlt': 'اشتراط العنوان الوطني (يناير 2026)',
  'compliance.reg.7.authority': 'TGA / SPL',
  'compliance.reg.7.implementation': 'Address capture enforces valid National Address field for all shipments; back-end validates format against SPL/Absher schema before order acceptance.',

  'compliance.reg.8.name': 'Parcel delivery licensing',
  'compliance.reg.8.nameAlt': 'ترخيص نقل الطرود البريدية',
  'compliance.reg.8.authority': 'TGA / Postal Regulatory Commission',
  'compliance.reg.8.implementation': 'All integrated carriers verified to hold active TGA and postal licenses; platform terms clearly define intermediary (software) role to avoid unlicensed operator liability.',
  'compliance.reg.8.note': 'See the System Information section for platform and connectivity status.',

  'compliance.reg.9.name': 'National Arabic Language Policy',
  'compliance.reg.9.nameAlt': 'السياسة الوطنية للغة العربية (قرار 588)',
  'compliance.reg.9.authority': 'Council of Ministers',
  'compliance.reg.9.implementation': 'Full Arabic UI across customer app, driver app, and merchant dashboard; all legal texts professionally translated into Arabic as primary language.',
  'compliance.reg.9.note': 'Click to toggle the interface language between English and Arabic to verify full localization.',

  'compliance.reg.10.name': 'ZATCA e-invoicing (Arabic)',
  'compliance.reg.10.nameAlt': 'اشتراط الفاتورة الإلكترونية بالعربية',
  'compliance.reg.10.authority': 'ZATCA',
  'compliance.reg.10.implementation': 'All invoices and credit/debit notes generated with Arabic human-readable fields; supports Arabic and Hindi numerals per ZATCA detailed e-invoicing guideline v2.',
  'compliance.reg.10.note': 'Use the Export Report action on the Analytics page to generate an Arabic-compliant invoice sample.',

  'compliance.reg.11.name': 'Basic Law of Governance',
  'compliance.reg.11.nameAlt': 'النظام الأساسي للحكم (المادة 1)',
  'compliance.reg.11.authority': 'BOE',
  'compliance.reg.11.implementation': 'Arabic set as primary language system-wide; all official communications, contract terms, and mandatory disclosures available in Arabic before any other language.',
  'compliance.reg.11.note': 'Click to toggle the interface language and confirm Arabic is the primary system language.',

  'compliance.reg.12.name': 'Consumer invoice requirements',
  'compliance.reg.12.nameAlt': 'متطلبات فاتورة المستهلك',
  'compliance.reg.12.authority': 'Ministry of Commerce',
  'compliance.reg.12.implementation': 'Receipts and order confirmations include Arabic invoice number, business name, date, product description, and total with VAT — aligned with MCI consumer-rights guidance.',
  'compliance.reg.12.note': 'See the Export Report action on the Analytics page for a sample consumer invoice.',

  'compliance.reg.13.name': 'PDPL – data collection & consent',
  'compliance.reg.13.nameAlt': 'نظام حماية البيانات الشخصية – الموافقة',
  'compliance.reg.13.authority': 'SDAIA',
  'compliance.reg.13.implementation': 'Explicit consent prompts at onboarding; privacy policy explains processing purposes, legal bases, data-sharing with carriers, retention periods, and data-subject rights under PDPL.',
  'compliance.reg.13.note': 'See the Language & Regional Settings and System Information sections for consent and policy controls.',

  'compliance.reg.14.name': 'PDPL – location & courier tracking',
  'compliance.reg.14.nameAlt': 'بيانات الموقع ورصد السائق',
  'compliance.reg.14.authority': 'SDAIA',
  'compliance.reg.14.implementation': 'Real-time location data classified as personal data; AES-256 encryption in transit and at rest; role-based access controls; data minimization applied to location history retention.',

  'compliance.reg.15.name': 'PDPL – data subject rights',
  'compliance.reg.15.nameAlt': 'حقوق صاحب البيانات',
  'compliance.reg.15.authority': 'SDAIA / NDMO',
  'compliance.reg.15.implementation': 'In-app portal for access, correction, and deletion requests; all requests logged with timestamps for SDAIA audit readiness; 30-day response SLA per PDPL.',
  'compliance.reg.15.note': 'See the System Information and Language & Regional Settings sections for data-subject request controls.',

  'compliance.reg.16.name': 'PDPL – cross-border transfer',
  'compliance.reg.16.nameAlt': 'نقل البيانات عبر الحدود',
  'compliance.reg.16.authority': 'SDAIA',
  'compliance.reg.16.implementation': 'Cloud hosting adequacy assessment underway; contractual safeguards in place for non-KSA data centers; primary delivery data earmarked for KSA-region hosting.',
  'compliance.reg.16.note': 'See the System Information section for hosting, API and connectivity details.',

  // HomePage
  'home.title': 'Fleet Operations Dashboard',
  'home.subtitle': 'Real-time monitoring and optimization for hybrid fleet operations',
  'home.liveConnected': 'Live Data Connected',
  'home.lastUpdated': 'Last updated',
  'home.totalCost': 'Total Delivery Cost',
  'home.co2Emissions': 'CO₂ Emissions',
  'home.fleetUtilization': 'Fleet Utilization',
  'home.workloadFairness': 'Workload Fairness Index',
  'home.trendCost': '↓ 3.2% from last month',
  'home.trendCO2': '↓ 8.5% from last month',
  'home.trendUtil': '↑ 5.1% from last month',
  'home.trendTarget': 'Target: > 0.80',
  'home.fleetStatus': 'Fleet Status',
  'home.onRoute': 'On Route',
  'home.activeDeliveries': 'Active deliveries',
  'home.idle': 'Idle',
  'home.availableDispatch': 'Available for dispatch',
  'home.delayed': 'Delayed',
  'home.requiresAttention': 'Requires attention',
  'home.vehicleTypes': 'Vehicle Types Distribution',
  'home.iceTrucks': 'ICE Trucks',
  'home.conventionalFleet': 'Conventional fleet',
  'home.electricVehicles': 'Electric Vehicles',
  'home.zeroEmission': 'Zero emission',
  'home.quickActions': 'Quick Actions',
  'home.runOptimization': 'Run Route Optimization',
  'home.viewFleetMap': 'View Live Fleet Map',
  'home.generateReport': 'Generate Report',
  'home.reportComingSoon': 'Report generation coming soon',
  'home.empty.fleetTitle': 'No vehicles in fleet',
  'home.empty.fleetDesc': 'Add a vehicle from Settings to see fleet status here.',

  // LiveFleetMapPage
  'fleet.title': 'Live Fleet Map',
  'fleet.subtitle': 'Real-time vehicle tracking and status monitoring',
  'fleet.location': 'Riyadh, Saudi Arabia',
  'fleet.liveTracking': 'Live Fleet Tracking',
  'fleet.legend': 'Legend',
  'fleet.onRoute': 'On Route',
  'fleet.delayed': 'Delayed',
  'fleet.idle': 'Idle',
  'fleet.vehicleDetails': 'Vehicle Details',
  'fleet.selectVehicle': 'Select a vehicle on the map to view details',
  'fleet.driver': 'Driver',
  'fleet.currentLocation': 'Current Location',
  'fleet.speed': 'Speed',
  'fleet.nextStop': 'Next Stop',
  'fleet.eta': 'ETA',
  'fleet.remainingStops': 'Remaining Stops',
  'fleet.routeProgress': 'Route Progress',
  'fleet.contactDriver': 'Contact Driver',
  'fleet.battery': 'Battery',
  'fleet.fuel': 'Fuel',
  'fleet.destination': 'Destination',
  'fleet.finalStop': 'FINAL STOP',
  'fleet.recalculate': 'Recalculate Route',
  'fleet.routing': 'Routing…',
  'fleet.legend.title': 'Route Legend',
  'fleet.legend.original': 'Original route',
  'fleet.legend.recalc': 'Recalculated route',
  'fleet.vehicleLoading': 'EV-02 | loading…',
  'fleet.clickVehicleHint': 'Click a vehicle to view details & pan map',
  'fleet.disruptionLog': 'Disruption Log',
  'fleet.disrupted': 'DISRUPTED',
  'fleet.collapseSidebar': 'Collapse sidebar',
  'fleet.expandSidebar': 'Expand sidebar',
  'fleet.mapAriaLabel': 'Interactive fleet map',
  'fleet.empty.title': 'No vehicles found',
  'fleet.empty.desc': 'No vehicles match the current filters.',
  'fleet.resolved': 'Resolved',
  'fleet.active': 'Active',

  // RouteOptimizationPage
  'route.title': 'Route Optimization',
  'route.subtitle': 'AI-powered route planning for hybrid fleet',
  'route.configuration': 'Optimization Configuration',
  'route.costMin': 'Cost Minimization',
  'route.costMinDesc': 'Prioritize SAR cost efficiency',
  'route.co2Min': 'CO₂ Minimization',
  'route.co2MinDesc': 'Reduce carbon footprint',
  'route.balanced': 'Balanced',
  'route.balancedDesc': 'Optimize all objectives equally',
  'route.runOptimization': 'Run Optimization',
  'route.fleetSummary': 'Fleet Summary',
  'route.solveTime': 'Solve time',
  'route.results': 'Optimization Results',
  'route.waitingTitle': 'Ready to Optimize',
  'route.waitingDesc': 'Select an objective and click Run Optimization to generate optimal routes',
  'route.reportDelay': 'Report Delay',
  'route.defaultLabel': 'Active Route',

  // AnalyticsPage
  'analytics.title': 'Analytics & Reporting',
  'analytics.subtitle': 'Fleet performance insights and sustainability metrics',
  'analytics.export': 'Export Report',
  'analytics.costVsCO2': 'Cost vs CO₂ Emissions Over Time',
  'analytics.dailyTrends': 'Daily cost and emission trends',
  'analytics.cost': 'Cost (SAR)',
  'analytics.co2': 'CO₂ (kg)',
  'analytics.insight': 'Insight: Electric vehicles contributed to 23% reduction in CO₂ emissions',
  'analytics.utilizationTitle': 'Hourly Fleet Utilization',
  'analytics.utilizationDesc': 'Vehicle usage patterns throughout the day',
  'analytics.peakHours': 'Peak Hours',
  'analytics.avgUtilization': 'Average Utilization',
  'analytics.offPeak': 'Off-Peak Hours',
  'analytics.vehiclePerf': 'Vehicle Performance Breakdown',
  'analytics.vehiclePerfDesc': 'Individual vehicle efficiency metrics',
  'analytics.alertTitle': 'High Fuel Cost Alert',
  'analytics.alertDesc': 'ICE trucks are consuming 34% more fuel than projected. Consider route rebalancing.',
  'analytics.driverPerf': 'Driver Performance Comparison',
  'analytics.driverPerfDesc': 'Comparative efficiency and delivery metrics',
  'analytics.driverName': 'Driver',
  'analytics.deliveries': 'Deliveries',
  'analytics.onTime': 'On-Time %',
  'analytics.efficiency': 'Efficiency',
  'analytics.hoursWorked': 'Hours Worked',
  'analytics.empty.title': 'No data available',
  'analytics.empty.desc': 'Charts will appear here once data is collected.',
  'analytics.chartCostAria': 'Line chart of cost vs CO₂ emissions over time',
  'analytics.chartUtilizationAria': 'Area chart of hourly fleet utilization',
  'analytics.chartDriverAria': 'Bar chart of driver performance',

  // SettingsPage
  'settings.title': 'Settings',
  'settings.subtitle': 'Configure fleet parameters and system preferences',
  'settings.fleetConfig': 'Fleet Configuration',
  'settings.fleetConfigDesc': 'Manage vehicle types and capacities',
  'settings.iceTrucksCount': 'ICE Trucks Count',
  'settings.iceTruckCapacity': 'ICE Truck Capacity (kg)',
  'settings.evCount': 'Electric Vehicles Count',
  'settings.evCapacity': 'EV Capacity (kg)',
  'settings.startTime': 'Operating Start Time',
  'settings.endTime': 'Operating End Time',
  'settings.optimization': 'Optimization Weights',
  'settings.optimizationDesc': 'Adjust algorithm priorities',
  'settings.costWeight': 'Cost Weight',
  'settings.co2Weight': 'CO₂ Weight',
  'settings.workloadWeight': 'Workload Balance Weight',
  'settings.weightsOk': 'Weights are balanced (100%)',
  'settings.weightsWarning': '⚠ Warning: Weights should sum to 100% (Currently:',
  'settings.language': 'Language & Regional Settings',
  'settings.languageDesc': 'Interface language and localization',
  'settings.interfaceLang': 'Interface Language',
  'settings.english': 'English',
  'settings.arabic': 'العربية',
  'settings.currency': 'Currency',
  'settings.save': 'Save Settings',
  'settings.reset': 'Reset to Defaults',
  'settings.system': 'System Information',
  'settings.systemDesc': 'Platform and connectivity status',
  'settings.version': 'Platform Version',
  'settings.apiStatus': 'API Status',
  'settings.connected': 'Connected',
  'settings.dataRefresh': 'Data Refresh Rate',
  'settings.refreshRate': '30 seconds',
  'settings.ltr': 'LTR',
  'settings.rtl': 'RTL',
  'settings.savedToast': 'Settings saved successfully',
  'settings.saveErrorToast': 'Could not save settings',
  'settings.resetToast': 'Settings reset to defaults',

  // Mobile Layout
  'mobile.appTitle': 'FleetIoT Driver',
  'mobile.home': 'Home',
  'mobile.route': 'Route',
  'mobile.vehicle': 'Vehicle',
  'mobile.alerts': 'Alerts',
  'mobile.profile': 'Profile',

  // DriverHomePage
  'driver.welcome': 'Welcome, Mohammed',
  'driver.today': 'Today is Sunday, February 1, 2026',
  'driver.activeRoute': 'Active Route',
  'driver.stops': 'Stops',
  'driver.estCompletion': 'Est. Completion',
  'driver.progress': 'Progress',
  'driver.packages': 'Packages',
  'driver.estTime': 'Est. Time',
  'driver.nextStop': 'Next Stop',
  'driver.startNavigation': 'Start Navigation',
  'driver.completedToday': 'Completed Today',
  'driver.greatPerformance': 'Great Performance!',
  'driver.aheadSchedule': "You're 15 minutes ahead of schedule",

  // RouteNavigationPage
  'nav2.title': 'Route Navigation',
  'nav2.stopDetails': 'Stop Details',
  'nav2.packages': 'packages',
  'nav2.eta': 'ETA',
  'nav2.navigate': 'Navigate Here',
  'nav2.markDelivered': 'Mark as Delivered',
  'nav2.completed': 'Completed',
  'nav2.current': 'In Progress',
  'nav2.upcoming': 'Upcoming',
  'nav2.deliveredToast': 'Stop marked as delivered',
  'nav2.delayReportedToast': 'Delay reported to dispatch',
  'nav2.delayDialogDesc': 'Tell dispatch why this stop is delayed.',
  'nav2.delayReason': 'Reason',
  'nav2.delayReason.traffic': 'Traffic congestion',
  'nav2.delayReason.weather': 'Weather conditions',
  'nav2.delayReason.vehicle': 'Vehicle issue',
  'nav2.delayReason.customer': 'Customer not available',
  'nav2.delayReason.other': 'Other',
  'nav2.empty.title': 'No upcoming stops',
  'nav2.empty.desc': 'You have completed every stop on this route.',

  // VehicleStatusPage
  'vehicle.title': 'Vehicle EV-02',
  'vehicle.type': 'Electric Vehicle',
  'vehicle.active': 'Active',
  'vehicle.onRoute': 'On Route',
  'vehicle.batteryLevel': 'Battery Level',
  'vehicle.estimatedRange': 'Estimated Range',
  'vehicle.chargingNotRequired': 'Charging: Not Required',
  'vehicle.performance': 'Performance Metrics',
  'vehicle.speed': 'Current Speed',
  'vehicle.temp': 'Motor Temp',
  'vehicle.iotStatus': 'IoT Connectivity Status',
  'vehicle.gps': 'GPS',
  'vehicle.telematics': 'Telematics',
  'vehicle.cellular': 'Cellular',
  'vehicle.diagnostics': 'Vehicle Diagnostics',
  'vehicle.allSystems': 'All Systems Normal',
  'vehicle.allSystemsDesc': 'No warnings or errors detected',
  'vehicle.cargoLoad': 'Cargo Load',
  'vehicle.currentLoad': 'Current Load',
  'vehicle.capacityUsed': 'capacity utilized',
  'vehicle.reportIssue': 'Report Vehicle Issue',
  'vehicle.signalStrong': 'Strong',
  'vehicle.signalWeak': 'Weak',
  'vehicle.excellent': 'Excellent',
  'vehicle.issue.desc': 'Describe what is wrong with the vehicle. Maintenance will be alerted.',
  'vehicle.issue.label': 'Issue description',
  'vehicle.issue.placeholder': 'e.g. Battery dropping unusually fast under load…',
  'vehicle.issue.required': 'Please describe the issue',
  'vehicle.issue.submitted': 'Issue reported to maintenance',

  // NotificationsPage
  'notif.title': 'Notifications',
  'notif.unread': 'unread notification',
  'notif.unreadPlural': 'unread notifications',
  'notif.markAllRead': 'Mark All Read',
  'notifications.weeklyPerformance': 'Weekly Performance Summary',
  'notifications.weeklyPerformanceBody': 'Your performance stats for the week are ready. 42 deliveries, 94% on-time.',
  'notifications.maintenanceReminder': 'Vehicle Maintenance Reminder',
  'notifications.maintenanceReminderBody': 'EV-02 is due for routine maintenance in 2,400 km.',
  'notifications.systemUpdate': 'System Update Available',
  'notifications.systemUpdateBody': 'A new version of the driver app is available.',
  'notifications.markAllRead': 'Mark All Read',
  'notifications.allMarkedRead': 'All notifications marked as read',
  'notifications.empty.title': 'You are all caught up',
  'notifications.empty.desc': 'No new notifications right now.',

  // ProfilePage
  'profile.since': 'Member since Jan 2025',
  'profile.performanceSummary': 'Performance Summary',
  'profile.totalDeliveries': 'Total Deliveries',
  'profile.onTimeRate': 'On-Time Rate',
  'profile.efficiency': 'Efficiency',
  'profile.fuelSavings': 'Fuel Savings',
  'profile.settings': 'Settings',
  'profile.logout': 'Logout',
  'profile.language': 'Language',
  'profile.selectLanguage': 'Select Language',
  'profile.statusActive': 'Active',
  'profile.statusOffline': 'Offline',
  'profile.badge.topPerformer': 'Top Performer',
  'profile.badge.workloadBalance': 'Workload Balance',
  'profile.achievements': 'Achievements',
  'profile.achievement.deliveries': '100 Deliveries',
  'profile.achievement.zeroDelays': 'Zero Delays',
  'profile.achievement.efficiencyKing': 'Efficiency King',
  'profile.achievement.fiveYears': '5-Year Veteran',
  'profile.achievement.fuelSaver': 'Fuel Saver',
  'profile.editProfile': 'Edit Profile',
  'profile.editProfileDesc': 'Update your display name and shift status.',
  'profile.viewAllAchievements': 'View All Achievements',
  'profile.collapseAchievements': 'Show fewer achievements',
  'profile.nameLabel': 'Display name',
  'profile.statusLabel': 'Shift status',
  'profile.savedToast': 'Profile updated',
  'profile.loggedOutToast': 'You have been logged out',
  'profile.settingsComingSoon': 'Mobile settings coming soon',

  // IoT
  'iot.connected': 'IoT Device Connected',
  'iot.offline': 'Device Offline',
  'iot.lastKnown': 'Showing last known data',
  'iot.liveData': 'Live IoT Feed',
  'iot.temperature': 'Temperature',
  'iot.humidity': 'Humidity',
  'iot.motion': 'Motion State',
  'iot.satellites': 'Satellites',
  'iot.altitude': 'Altitude',
  'iot.recalculating': 'Recalculating Route...',
  'iot.disruption': 'Disruption Detected',
  'iot.reliability': 'Reliability',
  'iot.resolve': 'Resolve',
  'iot.noDisruptions': 'No active disruptions',
  'iot.deviceConfig': 'Device IP',
  'iot.liveIndicator': 'LIVE',
  'iot.recalcLast': 'Last Recalc',
  'iot.lastKnownShort': 'Last known',
  'iot.connecting': 'Connecting to ESP32…',
  'iot.disconnected': 'ESP32 disconnected',
  'iot.useMock': 'Switch to mock data',
  'iot.source': 'IoT data source',
  'iot.mock': 'Mock',
  'iot.esp32': 'ESP32',

  // Common
  'common.cancel': 'Cancel',
  'common.submit': 'Submit',
  'common.save': 'Save',
  'common.close': 'Close',

  // Optimization extras
  'optimization.fleetSize': 'Fleet Size:',
  'optimization.activeRoutes': 'Active Routes:',
  'optimization.algorithm': 'Algorithm:',
  'optimization.geneticAlgorithm': 'Genetic Algorithm',

  // Compliance extras
  'compliance.empty.title': 'No regulations found',
  'compliance.empty.desc': 'Try clearing the active filter to see all regulations.',
  'compliance.empty.action': 'Clear filters',

  // Route Planner Test Page
  'nav.routeTest': 'Route Planner Test',
  'test.title': 'Route Planner Test',
  'test.subtitle': 'Build a custom delivery run and visualize the optimized route',
  'test.depot': 'Depot / Source location',
  'test.finalDest': 'Final destination',
  'test.finalDestShort': 'Final',
  'test.customers': 'Customers',
  'test.customer': 'Customer',
  'test.customerName': 'Customer name',
  'test.addressPlaceholder': 'Address or short code (e.g. RCTB4359)',
  'test.locate': 'Locate',
  'test.locating': 'Locating…',
  'test.presets': 'Presets',
  'test.addCustomer': 'Add another customer',
  'test.removeCustomer': 'Remove customer',
  'test.vehicles': 'Number of vehicles',
  'test.vehiclesHelp': '1–6 vehicles (customers split evenly)',
  'test.enforceVehicles': 'Enforce vehicle count',
  'test.enforceVehiclesHint': 'Forces the solver to use exactly the selected number of vehicles.',
  'test.generate': 'Generate Route',
  'test.routing': 'Routing…',
  'test.generateHint': 'Locate the depot, final destination, and at least one customer to enable routing.',
  'test.recalculate': 'Recalculate Route',
  'test.confirmRecalc': 'Confirm & Recalculate',
  'test.cancel': 'Cancel',
  'test.results': 'Results',
  'test.totalStops': 'Stops',
  'test.totalDistance': 'Distance',
  'test.vehiclesUsed': 'Vehicles',
  'test.vehicle': 'Vehicle',
  'test.legendTitle': 'Legend',
  'test.legendOriginal': 'Original route',
  'test.legendRecalculated': 'Recalculated route',
  'test.mapAriaLabel': 'Route planner test map',
  'test.error.notFound': 'Address not found.',
  'test.error.emptyInput': 'Enter an address.',
  'test.error.missingKey': 'Geocoding service not configured.',
  'test.error.upstream': 'Geocoding service unavailable.',
  'test.error.routing': 'Failed to compute route. Please try again.',
};

const ar: Record<string, string> = {
  // App top bar
  'app.webDashboard': 'لوحة التحكم',
  'app.mobileApp': 'تطبيق الجوال',

  // Dashboard Sidebar
  'nav.overview': 'نظرة عامة',
  'nav.liveFleet': 'الأسطول المباشر',
  'nav.optimization': 'التحسين',
  'nav.analytics': 'التحليلات',
  'nav.compliance': 'الامتثال',
  'nav.settings': 'الإعدادات',
  'nav.portal': 'بوابة المرسل v2.1',
  'nav.project': 'مشروع التخرج 2026',

  // CompliancePage
  'compliance.title': 'الامتثال التنظيمي',
  'compliance.subtitle': 'مصفوفة مواءمة الإطار التنظيمي للمملكة العربية السعودية',
  'compliance.stat.total': 'إجمالي اللوائح',
  'compliance.stat.implemented': 'مُنفَّذ',
  'compliance.stat.planned': 'مُخطط له',
  'compliance.filter.all': 'الكل',
  'compliance.filter.traffic': 'المرور والمركبات',
  'compliance.filter.delivery': 'منصة التوصيل',
  'compliance.filter.arabic': 'التوطين العربي',
  'compliance.filter.data': 'حماية البيانات',
  'compliance.col.regulation': 'اللائحة',
  'compliance.col.authority': 'الجهة التنظيمية',
  'compliance.col.implementation': 'التنفيذ في النظام',
  'compliance.col.status': 'الحالة',
  'compliance.col.proof': 'الدليل',
  'compliance.status.implemented': 'مُنفَّذ',
  'compliance.status.planned': 'مُخطط له',
  'compliance.proof.view': 'عرض الدليل',
  'compliance.proof.toggleLang': 'تبديل اللغة',
  'compliance.cat.traffic': 'المرور',
  'compliance.cat.delivery': 'التوصيل',
  'compliance.cat.arabic': 'العربية',
  'compliance.cat.data': 'البيانات',

  // Compliance — regulation rows (name = localized, nameAlt = opposite language subtitle)
  'compliance.reg.1.name': 'نظام المرور',
  'compliance.reg.1.nameAlt': 'Saudi Traffic Law',
  'compliance.reg.1.authority': 'هيئة الخبراء / الهيئة السعودية للمواصفات',
  'compliance.reg.1.implementation': 'يتم تخزين خصائص نوع المركبة (عدد المحاور، الوزن الإجمالي) ضمن نموذج الأسطول؛ ومنطق تخطيط المسارات يمنع تخصيص فئات الطرق المحظورة حسب نوع المركبة.',

  'compliance.reg.2.name': 'حدود ساعات القيادة',
  'compliance.reg.2.nameAlt': 'Driving hours limits',
  'compliance.reg.2.authority': 'الهيئة العامة للنقل',
  'compliance.reg.2.implementation': 'مخطِّط المسارات يفرض سقف 9 ساعات يومياً و56 ساعة أسبوعياً للسائقين التجاريين، مع استراحة إلزامية 45 دقيقة بعد 4.5 ساعات من القيادة المتواصلة ضمن منطق الإرسال.',

  'compliance.reg.3.name': 'حدود الأوزان والأبعاد',
  'compliance.reg.3.nameAlt': 'Vehicle weight limits',
  'compliance.reg.3.authority': 'الهيئة العامة للطرق',
  'compliance.reg.3.implementation': 'معلمات سعة الأسطول مقيدة بحدود الأوزان القانونية للمحاور (21–45 طناً بحسب عدد المحاور)؛ ويُرفض إسناد أي حمولة زائدة في مرحلة إنشاء المسار.',

  'compliance.reg.4.name': 'حظر الشاحنات في ساعات الذروة',
  'compliance.reg.4.nameAlt': 'City-level truck/time bans',
  'compliance.reg.4.authority': 'الأمانات البلدية',
  'compliance.reg.4.implementation': 'مضلعات مناطق المنع قابلة للتهيئة ونوافذ زمنية لكل فئة مركبات لكل مدينة؛ وحظر الشاحنات في ساعات الذروة بمكة محمَّل مسبقاً كقيد افتراضي.',

  'compliance.reg.5.name': 'تسجيل التطبيق لدى هيئة النقل',
  'compliance.reg.5.nameAlt': 'TGA Delivery App registration',
  'compliance.reg.5.authority': 'الهيئة العامة للنقل',
  'compliance.reg.5.implementation': 'صُممت بنية المنصة لتلبية متطلبات فئة "تطبيقات التوصيل" لدى الهيئة العامة للنقل، وجارٍ استكمال إجراءات التسجيل عبر بوابة الهيئة.',

  'compliance.reg.6.name': 'التحقق من هوية السائق',
  'compliance.reg.6.nameAlt': 'Driver identity verification',
  'compliance.reg.6.authority': 'الهيئة العامة للنقل',
  'compliance.reg.6.implementation': 'تتضمن عملية دخول السائق تحققاً من الهوية عبر التعرف على الوجه قبل بدء الوردية، بما يلبي متطلبات التحقق الإلزامية لتطبيقات التوصيل لدى الهيئة العامة للنقل.',
  'compliance.reg.6.note': 'التدفق الكامل للتحقق موجود في تطبيق السائق — بدّل إلى وضع تطبيق الجوال من الشريط العلوي لعرضه.',

  'compliance.reg.7.name': 'اشتراط العنوان الوطني (يناير 2026)',
  'compliance.reg.7.nameAlt': 'National Address requirement',
  'compliance.reg.7.authority': 'هيئة النقل / البريد السعودي',
  'compliance.reg.7.implementation': 'إدخال العنوان يفرض حقل عنوان وطني صالحاً لكل الشحنات؛ ويتحقق الخلفي من التنسيق مقابل نموذج البريد السعودي/أبشر قبل قبول الطلب.',

  'compliance.reg.8.name': 'ترخيص نقل الطرود البريدية',
  'compliance.reg.8.nameAlt': 'Parcel delivery licensing',
  'compliance.reg.8.authority': 'هيئة النقل / هيئة البريد',
  'compliance.reg.8.implementation': 'جميع الناقلين المدمجين جرى التحقق من حيازتهم تراخيص سارية من هيئة النقل وهيئة البريد؛ وتُحدِّد شروط المنصة دور الوسيط (البرمجي) بوضوح لتجنّب المسؤولية كمشغّل غير مرخّص.',
  'compliance.reg.8.note': 'راجع قسم "معلومات النظام" للاطلاع على حالة المنصة والاتصال.',

  'compliance.reg.9.name': 'السياسة الوطنية للغة العربية (قرار 588)',
  'compliance.reg.9.nameAlt': 'National Arabic Language Policy',
  'compliance.reg.9.authority': 'مجلس الوزراء',
  'compliance.reg.9.implementation': 'واجهة عربية كاملة في تطبيق العميل وتطبيق السائق ولوحة التاجر؛ وجميع النصوص القانونية مترجمة ترجمة احترافية إلى العربية كلغة أساسية.',
  'compliance.reg.9.note': 'اضغط لتبديل لغة الواجهة بين الإنجليزية والعربية للتأكد من التوطين الكامل.',

  'compliance.reg.10.name': 'اشتراط الفاتورة الإلكترونية بالعربية',
  'compliance.reg.10.nameAlt': 'ZATCA e-invoicing (Arabic)',
  'compliance.reg.10.authority': 'هيئة الزكاة والضريبة والجمارك',
  'compliance.reg.10.implementation': 'جميع الفواتير وإشعارات الخصم والدائن تُولَّد بحقول عربية مقروءة للبشر؛ وتدعم الأرقام العربية والهندية وفق الدليل التفصيلي للفوترة الإلكترونية v2 الصادر عن الهيئة.',
  'compliance.reg.10.note': 'استخدم إجراء "تصدير التقرير" في صفحة التحليلات لإنشاء نموذج فاتورة متوافقة بالعربية.',

  'compliance.reg.11.name': 'النظام الأساسي للحكم (المادة 1)',
  'compliance.reg.11.nameAlt': 'Basic Law of Governance',
  'compliance.reg.11.authority': 'هيئة الخبراء',
  'compliance.reg.11.implementation': 'العربية مُعيَّنة كلغة أساسية على مستوى النظام؛ وجميع المراسلات الرسمية وبنود العقود والإفصاحات الإلزامية متاحة بالعربية قبل أي لغة أخرى.',
  'compliance.reg.11.note': 'اضغط لتبديل لغة الواجهة والتأكد من أن العربية هي لغة النظام الأساسية.',

  'compliance.reg.12.name': 'متطلبات فاتورة المستهلك',
  'compliance.reg.12.nameAlt': 'Consumer invoice requirements',
  'compliance.reg.12.authority': 'وزارة التجارة',
  'compliance.reg.12.implementation': 'الإيصالات وتأكيدات الطلبات تتضمّن رقم الفاتورة بالعربية واسم المنشأة والتاريخ ووصف المنتج والإجمالي شاملاً ضريبة القيمة المضافة — بما يتسق مع إرشادات حقوق المستهلك لدى وزارة التجارة.',
  'compliance.reg.12.note': 'راجع إجراء "تصدير التقرير" في صفحة التحليلات للاطلاع على نموذج فاتورة المستهلك.',

  'compliance.reg.13.name': 'نظام حماية البيانات الشخصية – الموافقة',
  'compliance.reg.13.nameAlt': 'PDPL – data collection & consent',
  'compliance.reg.13.authority': 'هيئة البيانات والذكاء الاصطناعي',
  'compliance.reg.13.implementation': 'طلبات موافقة صريحة عند التسجيل؛ وسياسة الخصوصية تشرح أغراض المعالجة والأسس القانونية ومشاركة البيانات مع الناقلين وفترات الاحتفاظ وحقوق صاحب البيانات وفق النظام.',
  'compliance.reg.13.note': 'راجع قسمَي "اللغة والإعدادات الإقليمية" و"معلومات النظام" لضوابط الموافقة والسياسة.',

  'compliance.reg.14.name': 'بيانات الموقع ورصد السائق',
  'compliance.reg.14.nameAlt': 'PDPL – location & courier tracking',
  'compliance.reg.14.authority': 'هيئة البيانات والذكاء الاصطناعي',
  'compliance.reg.14.implementation': 'بيانات الموقع الفورية مصنّفة كبيانات شخصية؛ تشفير AES-256 أثناء النقل وفي التخزين؛ وضبط صلاحيات قائم على الأدوار؛ وتقليل البيانات مطبَّق على الاحتفاظ بتاريخ المواقع.',

  'compliance.reg.15.name': 'حقوق صاحب البيانات',
  'compliance.reg.15.nameAlt': 'PDPL – data subject rights',
  'compliance.reg.15.authority': 'هيئة البيانات / المكتب الوطني لإدارة البيانات',
  'compliance.reg.15.implementation': 'بوابة داخل التطبيق لطلبات الاطلاع والتصحيح والحذف؛ وجميع الطلبات تُسجَّل بختم زمني استعداداً لتدقيق الهيئة؛ واتفاقية مستوى خدمة 30 يوماً وفق النظام.',
  'compliance.reg.15.note': 'راجع قسمَي "معلومات النظام" و"اللغة والإعدادات الإقليمية" لضوابط طلبات صاحب البيانات.',

  'compliance.reg.16.name': 'نقل البيانات عبر الحدود',
  'compliance.reg.16.nameAlt': 'PDPL – cross-border transfer',
  'compliance.reg.16.authority': 'هيئة البيانات والذكاء الاصطناعي',
  'compliance.reg.16.implementation': 'جارٍ تقييم كفاية الاستضافة السحابية؛ وضمانات تعاقدية مع مراكز البيانات خارج المملكة؛ وبيانات التوصيل الأساسية مخصصة للاستضافة في منطقة المملكة.',
  'compliance.reg.16.note': 'راجع قسم "معلومات النظام" للاطلاع على تفاصيل الاستضافة وحالة الاتصال.',

  // HomePage
  'home.title': 'لوحة تحكم عمليات الأسطول',
  'home.subtitle': 'المراقبة الفورية والتحسين لعمليات الأسطول الهجين',
  'home.liveConnected': 'البيانات المباشرة متصلة',
  'home.lastUpdated': 'آخر تحديث',
  'home.totalCost': 'إجمالي تكلفة التوصيل',
  'home.co2Emissions': 'انبعاثات ثاني أكسيد الكربون',
  'home.fleetUtilization': 'استخدام الأسطول',
  'home.workloadFairness': 'مؤشر توازن العمل',
  'home.trendCost': '↓ 3.2% مقارنة بالشهر الماضي',
  'home.trendCO2': '↓ 8.5% مقارنة بالشهر الماضي',
  'home.trendUtil': '↑ 5.1% مقارنة بالشهر الماضي',
  'home.trendTarget': 'الهدف: > 0.80',
  'home.fleetStatus': 'حالة الأسطول',
  'home.onRoute': 'في الطريق',
  'home.activeDeliveries': 'توصيلات نشطة',
  'home.idle': 'خامل',
  'home.availableDispatch': 'متاح للإرسال',
  'home.delayed': 'متأخر',
  'home.requiresAttention': 'يحتاج إلى اهتمام',
  'home.vehicleTypes': 'توزيع أنواع المركبات',
  'home.iceTrucks': 'شاحنات ICE',
  'home.conventionalFleet': 'الأسطول التقليدي',
  'home.electricVehicles': 'المركبات الكهربائية',
  'home.zeroEmission': 'صفر انبعاثات',
  'home.quickActions': 'إجراءات سريعة',
  'home.runOptimization': 'تشغيل تحسين المسار',
  'home.viewFleetMap': 'عرض خريطة الأسطول المباشرة',
  'home.generateReport': 'إنشاء تقرير',
  'home.reportComingSoon': 'إنشاء التقارير قادم قريباً',
  'home.empty.fleetTitle': 'لا توجد مركبات في الأسطول',
  'home.empty.fleetDesc': 'أضف مركبة من الإعدادات لعرض حالة الأسطول هنا.',

  // LiveFleetMapPage
  'fleet.title': 'خريطة الأسطول المباشرة',
  'fleet.subtitle': 'تتبع المركبات في الوقت الفعلي ومراقبة الحالة',
  'fleet.location': 'الرياض، المملكة العربية السعودية',
  'fleet.liveTracking': 'تتبع الأسطول المباشر',
  'fleet.legend': 'المفتاح',
  'fleet.onRoute': 'في الطريق',
  'fleet.delayed': 'متأخر',
  'fleet.idle': 'خامل',
  'fleet.vehicleDetails': 'تفاصيل المركبة',
  'fleet.selectVehicle': 'اختر مركبة من الخريطة لعرض التفاصيل',
  'fleet.driver': 'السائق',
  'fleet.currentLocation': 'الموقع الحالي',
  'fleet.speed': 'السرعة',
  'fleet.nextStop': 'المحطة التالية',
  'fleet.eta': 'وقت الوصول المتوقع',
  'fleet.remainingStops': 'المحطات المتبقية',
  'fleet.routeProgress': 'تقدم المسار',
  'fleet.contactDriver': 'التواصل مع السائق',
  'fleet.battery': 'البطارية',
  'fleet.fuel': 'الوقود',
  'fleet.destination': 'الوجهة',
  'fleet.finalStop': 'المحطة الأخيرة',
  'fleet.recalculate': 'إعادة حساب المسار',
  'fleet.routing': 'جارٍ الحساب…',
  'fleet.legend.title': 'مفتاح المسار',
  'fleet.legend.original': 'المسار الأصلي',
  'fleet.legend.recalc': 'المسار المعاد حسابه',
  'fleet.vehicleLoading': 'EV-02 | جارٍ التحميل…',
  'fleet.clickVehicleHint': 'اضغط على مركبة لعرض التفاصيل وتحريك الخريطة',
  'fleet.disruptionLog': 'سجل الاضطرابات',
  'fleet.disrupted': 'مضطرب',
  'fleet.collapseSidebar': 'طيّ الشريط الجانبي',
  'fleet.expandSidebar': 'توسيع الشريط الجانبي',
  'fleet.mapAriaLabel': 'خريطة الأسطول التفاعلية',
  'fleet.empty.title': 'لا توجد مركبات',
  'fleet.empty.desc': 'لا توجد مركبات تطابق عوامل التصفية الحالية.',
  'fleet.resolved': 'تمت المعالجة',
  'fleet.active': 'نشط',

  // RouteOptimizationPage
  'route.title': 'تحسين المسار',
  'route.subtitle': 'تخطيط المسار بالذكاء الاصطناعي للأسطول الهجين',
  'route.configuration': 'إعدادات التحسين',
  'route.costMin': 'تقليل التكلفة',
  'route.costMinDesc': 'إعطاء الأولوية لكفاءة التكلفة بالريال السعودي',
  'route.co2Min': 'تقليل ثاني أكسيد الكربون',
  'route.co2MinDesc': 'تقليل البصمة الكربونية',
  'route.balanced': 'متوازن',
  'route.balancedDesc': 'تحسين جميع الأهداف بالتساوي',
  'route.runOptimization': 'تشغيل التحسين',
  'route.fleetSummary': 'ملخص الأسطول',
  'route.solveTime': 'وقت الحل',
  'route.results': 'نتائج التحسين',
  'route.waitingTitle': 'جاهز للتحسين',
  'route.waitingDesc': 'اختر هدفاً وانقر على تشغيل التحسين لإنشاء مسارات مثلى',
  'route.reportDelay': 'الإبلاغ عن تأخير',
  'route.defaultLabel': 'المسار النشط',

  // AnalyticsPage
  'analytics.title': 'التحليلات والتقارير',
  'analytics.subtitle': 'رؤى أداء الأسطول ومقاييس الاستدامة',
  'analytics.export': 'تصدير التقرير',
  'analytics.costVsCO2': 'التكلفة مقابل انبعاثات ثاني أكسيد الكربون عبر الزمن',
  'analytics.dailyTrends': 'اتجاهات التكلفة والانبعاثات اليومية',
  'analytics.cost': 'التكلفة (ريال)',
  'analytics.co2': 'CO₂ (كجم)',
  'analytics.insight': 'رؤية: أسهمت المركبات الكهربائية في تقليل انبعاثات CO₂ بنسبة 23%',
  'analytics.utilizationTitle': 'استخدام الأسطول بالساعة',
  'analytics.utilizationDesc': 'أنماط استخدام المركبات على مدار اليوم',
  'analytics.peakHours': 'ساعات الذروة',
  'analytics.avgUtilization': 'متوسط الاستخدام',
  'analytics.offPeak': 'ساعات خارج الذروة',
  'analytics.vehiclePerf': 'تفصيل أداء المركبات',
  'analytics.vehiclePerfDesc': 'مقاييس كفاءة المركبات الفردية',
  'analytics.alertTitle': 'تنبيه: ارتفاع تكلفة الوقود',
  'analytics.alertDesc': 'شاحنات ICE تستهلك وقوداً أكثر بنسبة 34% من المتوقع. يُنصح بإعادة توازن المسارات.',
  'analytics.driverPerf': 'مقارنة أداء السائقين',
  'analytics.driverPerfDesc': 'مقاييس الكفاءة والتوصيل المقارنة',
  'analytics.driverName': 'السائق',
  'analytics.deliveries': 'التوصيلات',
  'analytics.onTime': 'نسبة الالتزام بالوقت',
  'analytics.efficiency': 'الكفاءة',
  'analytics.hoursWorked': 'ساعات العمل',
  'analytics.empty.title': 'لا توجد بيانات',
  'analytics.empty.desc': 'ستظهر الرسوم البيانية هنا عند توفر البيانات.',
  'analytics.chartCostAria': 'رسم بياني خطي للتكلفة مقابل انبعاثات CO₂ بمرور الوقت',
  'analytics.chartUtilizationAria': 'رسم بياني للاستخدام بالساعة',
  'analytics.chartDriverAria': 'رسم بياني عمودي لأداء السائقين',

  // SettingsPage
  'settings.title': 'الإعدادات',
  'settings.subtitle': 'تكوين معلمات الأسطول وتفضيلات النظام',
  'settings.fleetConfig': 'إعداد الأسطول',
  'settings.fleetConfigDesc': 'إدارة أنواع المركبات وسعاتها',
  'settings.iceTrucksCount': 'عدد شاحنات ICE',
  'settings.iceTruckCapacity': 'سعة شاحنة ICE (كجم)',
  'settings.evCount': 'عدد المركبات الكهربائية',
  'settings.evCapacity': 'سعة المركبة الكهربائية (كجم)',
  'settings.startTime': 'وقت بدء التشغيل',
  'settings.endTime': 'وقت انتهاء التشغيل',
  'settings.optimization': 'أوزان التحسين',
  'settings.optimizationDesc': 'ضبط أولويات الخوارزمية',
  'settings.costWeight': 'وزن التكلفة',
  'settings.co2Weight': 'وزن ثاني أكسيد الكربون',
  'settings.workloadWeight': 'وزن توازن العمل',
  'settings.weightsOk': 'الأوزان متوازنة (100%)',
  'settings.weightsWarning': '⚠ تحذير: يجب أن تبلغ الأوزان 100% (حالياً:',
  'settings.language': 'اللغة والإعدادات الإقليمية',
  'settings.languageDesc': 'لغة الواجهة والتوطين',
  'settings.interfaceLang': 'لغة الواجهة',
  'settings.english': 'English',
  'settings.arabic': 'العربية',
  'settings.currency': 'العملة',
  'settings.save': 'حفظ الإعدادات',
  'settings.reset': 'إعادة تعيين للافتراضيات',
  'settings.system': 'معلومات النظام',
  'settings.systemDesc': 'حالة المنصة والاتصال',
  'settings.version': 'إصدار المنصة',
  'settings.apiStatus': 'حالة API',
  'settings.connected': 'متصل',
  'settings.dataRefresh': 'معدل تحديث البيانات',
  'settings.refreshRate': '30 ثانية',
  'settings.ltr': 'من اليسار لليمين',
  'settings.rtl': 'من اليمين لليسار',
  'settings.savedToast': 'تم حفظ الإعدادات بنجاح',
  'settings.saveErrorToast': 'تعذّر حفظ الإعدادات',
  'settings.resetToast': 'تمت إعادة الإعدادات إلى الافتراضيات',

  // Mobile Layout
  'mobile.appTitle': 'FleetIoT سائق',
  'mobile.home': 'الرئيسية',
  'mobile.route': 'المسار',
  'mobile.vehicle': 'المركبة',
  'mobile.alerts': 'التنبيهات',
  'mobile.profile': 'الملف',

  // DriverHomePage
  'driver.welcome': 'مرحباً، محمد',
  'driver.today': 'اليوم الأحد، 1 فبراير 2026',
  'driver.activeRoute': 'المسار النشط',
  'driver.stops': 'المحطات',
  'driver.estCompletion': 'وقت الانتهاء المتوقع',
  'driver.progress': 'التقدم',
  'driver.packages': 'الطرود',
  'driver.estTime': 'الوقت المتوقع',
  'driver.nextStop': 'المحطة التالية',
  'driver.startNavigation': 'بدء الملاحة',
  'driver.completedToday': 'مكتمل اليوم',
  'driver.greatPerformance': 'أداء رائع!',
  'driver.aheadSchedule': 'أنت متقدم 15 دقيقة عن الجدول الزمني',

  // RouteNavigationPage
  'nav2.title': 'ملاحة المسار',
  'nav2.stopDetails': 'تفاصيل المحطة',
  'nav2.packages': 'طرود',
  'nav2.eta': 'وقت الوصول',
  'nav2.navigate': 'الملاحة إلى هنا',
  'nav2.markDelivered': 'تعيين كمُسلَّم',
  'nav2.completed': 'مكتمل',
  'nav2.current': 'جارٍ',
  'nav2.upcoming': 'قادم',
  'nav2.deliveredToast': 'تم تعيين المحطة كمُسلَّمة',
  'nav2.delayReportedToast': 'تم إبلاغ الإرسال بالتأخير',
  'nav2.delayDialogDesc': 'أبلغ الإرسال عن سبب تأخر هذه المحطة.',
  'nav2.delayReason': 'السبب',
  'nav2.delayReason.traffic': 'ازدحام مروري',
  'nav2.delayReason.weather': 'أحوال جوية',
  'nav2.delayReason.vehicle': 'مشكلة في المركبة',
  'nav2.delayReason.customer': 'العميل غير متاح',
  'nav2.delayReason.other': 'أخرى',
  'nav2.empty.title': 'لا توجد محطات قادمة',
  'nav2.empty.desc': 'لقد أكملت كل محطات هذا المسار.',

  // VehicleStatusPage
  'vehicle.title': 'المركبة EV-02',
  'vehicle.type': 'مركبة كهربائية',
  'vehicle.active': 'نشط',
  'vehicle.onRoute': 'في الطريق',
  'vehicle.batteryLevel': 'مستوى البطارية',
  'vehicle.estimatedRange': 'المدى المتوقع',
  'vehicle.chargingNotRequired': 'الشحن: غير مطلوب',
  'vehicle.performance': 'مقاييس الأداء',
  'vehicle.speed': 'السرعة الحالية',
  'vehicle.temp': 'حرارة المحرك',
  'vehicle.iotStatus': 'حالة اتصال IoT',
  'vehicle.gps': 'GPS',
  'vehicle.telematics': 'بيانات المركبة',
  'vehicle.cellular': 'شبكة خلوية',
  'vehicle.diagnostics': 'تشخيص المركبة',
  'vehicle.allSystems': 'جميع الأنظمة طبيعية',
  'vehicle.allSystemsDesc': 'لا توجد تحذيرات أو أخطاء',
  'vehicle.cargoLoad': 'حمولة الشحن',
  'vehicle.currentLoad': 'الحمولة الحالية',
  'vehicle.capacityUsed': 'من السعة مستخدمة',
  'vehicle.reportIssue': 'الإبلاغ عن مشكلة في المركبة',
  'vehicle.signalStrong': 'قوية',
  'vehicle.signalWeak': 'ضعيفة',
  'vehicle.excellent': 'ممتاز',
  'vehicle.issue.desc': 'صف المشكلة في المركبة وسيتم إبلاغ الصيانة.',
  'vehicle.issue.label': 'وصف المشكلة',
  'vehicle.issue.placeholder': 'مثال: البطارية تنخفض بسرعة غير معتادة تحت الحمل…',
  'vehicle.issue.required': 'يرجى وصف المشكلة',
  'vehicle.issue.submitted': 'تم إبلاغ الصيانة بالمشكلة',

  // NotificationsPage
  'notif.title': 'الإشعارات',
  'notif.unread': 'إشعار غير مقروء',
  'notif.unreadPlural': 'إشعارات غير مقروءة',
  'notif.markAllRead': 'تعيين الكل كمقروء',
  'notifications.weeklyPerformance': 'ملخص الأداء الأسبوعي',
  'notifications.weeklyPerformanceBody': 'إحصاءات أداء الأسبوع جاهزة. 42 توصيلة، 94% في الوقت.',
  'notifications.maintenanceReminder': 'تذكير بصيانة المركبة',
  'notifications.maintenanceReminderBody': 'EV-02 يحتاج إلى صيانة دورية بعد 2400 كم.',
  'notifications.systemUpdate': 'تحديث للنظام متاح',
  'notifications.systemUpdateBody': 'إصدار جديد من تطبيق السائق متاح.',
  'notifications.markAllRead': 'تعيين الكل كمقروء',
  'notifications.allMarkedRead': 'تم تعيين كل الإشعارات كمقروءة',
  'notifications.empty.title': 'لا توجد إشعارات جديدة',
  'notifications.empty.desc': 'لا إشعارات جديدة في الوقت الحالي.',

  // ProfilePage
  'profile.since': 'عضو منذ يناير 2025',
  'profile.performanceSummary': 'ملخص الأداء',
  'profile.totalDeliveries': 'إجمالي التوصيلات',
  'profile.onTimeRate': 'معدل الالتزام بالوقت',
  'profile.efficiency': 'الكفاءة',
  'profile.fuelSavings': 'توفير الوقود',
  'profile.settings': 'الإعدادات',
  'profile.logout': 'تسجيل الخروج',
  'profile.language': 'اللغة',
  'profile.selectLanguage': 'اختر اللغة',
  'profile.statusActive': 'نشط',
  'profile.statusOffline': 'غير متصل',
  'profile.badge.topPerformer': 'الأفضل أداءً',
  'profile.badge.workloadBalance': 'توازن العمل',
  'profile.achievements': 'الإنجازات',
  'profile.achievement.deliveries': '100 توصيلة',
  'profile.achievement.zeroDelays': 'بدون تأخير',
  'profile.achievement.efficiencyKing': 'ملك الكفاءة',
  'profile.achievement.fiveYears': '5 سنوات خبرة',
  'profile.achievement.fuelSaver': 'موفّر الوقود',
  'profile.editProfile': 'تعديل الملف',
  'profile.editProfileDesc': 'حدّث اسمك المعروض وحالة الوردية.',
  'profile.viewAllAchievements': 'عرض كل الإنجازات',
  'profile.collapseAchievements': 'إخفاء الإنجازات الإضافية',
  'profile.nameLabel': 'اسم العرض',
  'profile.statusLabel': 'حالة الوردية',
  'profile.savedToast': 'تم تحديث الملف',
  'profile.loggedOutToast': 'تم تسجيل الخروج',
  'profile.settingsComingSoon': 'إعدادات الجوال قادمة قريباً',

  // IoT
  'iot.connected': 'جهاز IoT متصل',
  'iot.offline': 'الجهاز غير متصل',
  'iot.lastKnown': 'عرض آخر بيانات معروفة',
  'iot.liveData': 'بيانات IoT المباشرة',
  'iot.temperature': 'درجة الحرارة',
  'iot.humidity': 'الرطوبة',
  'iot.motion': 'حالة الحركة',
  'iot.satellites': 'الأقمار الصناعية',
  'iot.altitude': 'الارتفاع',
  'iot.recalculating': 'إعادة حساب المسار...',
  'iot.disruption': 'تم اكتشاف اضطراب',
  'iot.reliability': 'الموثوقية',
  'iot.resolve': 'حل',
  'iot.noDisruptions': 'لا اضطرابات نشطة',
  'iot.deviceConfig': 'عنوان الجهاز',
  'iot.liveIndicator': 'مباشر',
  'iot.recalcLast': 'آخر إعادة حساب',
  'iot.lastKnownShort': 'آخر بيانات',
  'iot.connecting': 'جارٍ الاتصال بجهاز ESP32…',
  'iot.disconnected': 'جهاز ESP32 غير متصل',
  'iot.useMock': 'التبديل إلى البيانات التجريبية',
  'iot.source': 'مصدر بيانات IoT',
  'iot.mock': 'تجريبي',
  'iot.esp32': 'ESP32',

  // Common
  'common.cancel': 'إلغاء',
  'common.submit': 'إرسال',
  'common.save': 'حفظ',
  'common.close': 'إغلاق',

  // Optimization extras
  'optimization.fleetSize': 'حجم الأسطول:',
  'optimization.activeRoutes': 'المسارات النشطة:',
  'optimization.algorithm': 'الخوارزمية:',
  'optimization.geneticAlgorithm': 'الخوارزمية الجينية',

  // Compliance extras
  'compliance.empty.title': 'لا توجد لوائح',
  'compliance.empty.desc': 'جرّب إزالة عوامل التصفية لعرض جميع اللوائح.',
  'compliance.empty.action': 'مسح عوامل التصفية',

  // Route Planner Test Page
  'nav.routeTest': 'اختبار مخطط المسار',
  'test.title': 'اختبار مخطط المسار',
  'test.subtitle': 'أنشئ مهمة توصيل مخصصة واعرض المسار الأمثل',
  'test.depot': 'المستودع / موقع الانطلاق',
  'test.finalDest': 'الوجهة النهائية',
  'test.finalDestShort': 'النهائية',
  'test.customers': 'العملاء',
  'test.customer': 'عميل',
  'test.customerName': 'اسم العميل',
  'test.addressPlaceholder': 'العنوان أو الرمز المختصر (مثال: RCTB4359)',
  'test.locate': 'تحديد',
  'test.locating': 'جاري التحديد…',
  'test.presets': 'اختر عنواناً',
  'test.addCustomer': 'إضافة عميل آخر',
  'test.removeCustomer': 'إزالة العميل',
  'test.vehicles': 'عدد المركبات',
  'test.vehiclesHelp': '1 إلى 6 مركبات (يُقسم العملاء بالتساوي)',
  'test.enforceVehicles': 'إلزام عدد المركبات',
  'test.enforceVehiclesHint': 'يُجبر المُحسِّن على استخدام عدد المركبات المُحدَّد بالضبط.',
  'test.generate': 'إنشاء المسار',
  'test.routing': 'جاري حساب المسار…',
  'test.generateHint': 'حدّد المستودع والوجهة النهائية وعميلًا واحدًا على الأقل لتفعيل التوجيه.',
  'test.recalculate': 'إعادة حساب المسار',
  'test.confirmRecalc': 'تأكيد وإعادة الحساب',
  'test.cancel': 'إلغاء',
  'test.results': 'النتائج',
  'test.totalStops': 'المحطات',
  'test.totalDistance': 'المسافة',
  'test.vehiclesUsed': 'المركبات',
  'test.vehicle': 'المركبة',
  'test.legendTitle': 'مفتاح الخريطة',
  'test.legendOriginal': 'المسار الأصلي',
  'test.legendRecalculated': 'المسار المُعاد حسابه',
  'test.mapAriaLabel': 'خريطة اختبار مخطط المسار',
  'test.error.notFound': 'العنوان غير موجود.',
  'test.error.emptyInput': 'يرجى إدخال عنوان.',
  'test.error.missingKey': 'خدمة الترميز الجغرافي غير مهيأة.',
  'test.error.upstream': 'خدمة الترميز الجغرافي غير متوفرة.',
  'test.error.routing': 'تعذّر حساب المسار. حاول مرة أخرى.',
};

const ur: Record<string, string> = {
  // App top bar
  'app.webDashboard': 'ویب ڈیش بورڈ',
  'app.mobileApp': 'موبائل ایپ',

  // Dashboard Sidebar
  'nav.overview': 'جائزہ',
  'nav.liveFleet': 'لائیو فلیٹ',
  'nav.optimization': 'اصلاح',
  'nav.analytics': 'تجزیات',
  'nav.compliance': 'تعمیل',
  'nav.settings': 'ترتیبات',
  'nav.portal': 'ڈسپیچر پورٹل v2.1',
  'nav.project': 'سینئر ڈیزائن پروجیکٹ 2026',

  // CompliancePage
  'compliance.title': 'ضابطہ جاتی تعمیل', // TODO: verify Urdu
  'compliance.subtitle': 'سعودی عرب کے ریگولیٹری فریم ورک کا الائنمنٹ میٹرکس', // TODO: verify Urdu
  'compliance.stat.total': 'کل ضوابط', // TODO: verify Urdu
  'compliance.stat.implemented': 'نافذ', // TODO: verify Urdu
  'compliance.stat.planned': 'منصوبہ بند', // TODO: verify Urdu
  'compliance.filter.all': 'سب', // TODO: verify Urdu
  'compliance.filter.traffic': 'ٹریفک اور گاڑیاں', // TODO: verify Urdu
  'compliance.filter.delivery': 'ڈیلیوری پلیٹ فارم', // TODO: verify Urdu
  'compliance.filter.arabic': 'عربی لوکلائزیشن', // TODO: verify Urdu
  'compliance.filter.data': 'ڈیٹا کا تحفظ', // TODO: verify Urdu
  'compliance.col.regulation': 'ضابطہ', // TODO: verify Urdu
  'compliance.col.authority': 'ادارہ', // TODO: verify Urdu
  'compliance.col.implementation': 'سسٹم میں نفاذ', // TODO: verify Urdu
  'compliance.col.status': 'حیثیت', // TODO: verify Urdu
  'compliance.col.proof': 'ثبوت', // TODO: verify Urdu
  'compliance.status.implemented': 'نافذ', // TODO: verify Urdu
  'compliance.status.planned': 'منصوبہ بند', // TODO: verify Urdu
  'compliance.proof.view': 'ثبوت دیکھیں', // TODO: verify Urdu
  'compliance.proof.toggleLang': 'زبان تبدیل کریں', // TODO: verify Urdu
  'compliance.cat.traffic': 'ٹریفک', // TODO: verify Urdu
  'compliance.cat.delivery': 'ڈیلیوری', // TODO: verify Urdu
  'compliance.cat.arabic': 'عربی', // TODO: verify Urdu
  'compliance.cat.data': 'ڈیٹا', // TODO: verify Urdu
  'compliance.empty.title': 'کوئی ضوابط نہیں ملے', // TODO: verify Urdu
  'compliance.empty.desc': 'تمام ضوابط دیکھنے کے لیے فلٹرز ہٹا دیں۔', // TODO: verify Urdu
  'compliance.empty.action': 'فلٹرز صاف کریں', // TODO: verify Urdu

  // HomePage
  'home.title': 'فلیٹ آپریشنز ڈیش بورڈ',
  'home.subtitle': 'ہائبرڈ فلیٹ آپریشنز کی ریئل ٹائم نگرانی',
  'home.liveConnected': 'لائیو ڈیٹا منسلک', // TODO: verify Urdu
  'home.lastUpdated': 'آخری تازہ کاری', // TODO: verify Urdu
  'home.totalCost': 'کل ڈیلیوری لاگت', // TODO: verify Urdu
  'home.co2Emissions': 'CO₂ اخراج', // TODO: verify Urdu
  'home.fleetUtilization': 'فلیٹ کا استعمال', // TODO: verify Urdu
  'home.workloadFairness': 'کام کا توازن انڈیکس', // TODO: verify Urdu
  'home.trendCost': '↓ پچھلے مہینے سے 3.2%', // TODO: verify Urdu
  'home.trendCO2': '↓ پچھلے مہینے سے 8.5%', // TODO: verify Urdu
  'home.trendUtil': '↑ پچھلے مہینے سے 5.1%', // TODO: verify Urdu
  'home.trendTarget': 'ہدف: > 0.80', // TODO: verify Urdu
  'home.fleetStatus': 'فلیٹ کی حیثیت', // TODO: verify Urdu
  'home.onRoute': 'راستے پر', // TODO: verify Urdu
  'home.activeDeliveries': 'فعال ڈیلیوریاں', // TODO: verify Urdu
  'home.idle': 'فارغ', // TODO: verify Urdu
  'home.availableDispatch': 'بھیجنے کے لیے دستیاب', // TODO: verify Urdu
  'home.delayed': 'تاخیر سے', // TODO: verify Urdu
  'home.requiresAttention': 'توجہ درکار', // TODO: verify Urdu
  'home.vehicleTypes': 'گاڑیوں کی اقسام کی تقسیم', // TODO: verify Urdu
  'home.iceTrucks': 'ICE ٹرک', // TODO: verify Urdu
  'home.conventionalFleet': 'روایتی فلیٹ', // TODO: verify Urdu
  'home.electricVehicles': 'برقی گاڑیاں', // TODO: verify Urdu
  'home.zeroEmission': 'صفر اخراج', // TODO: verify Urdu
  'home.quickActions': 'فوری اقدامات', // TODO: verify Urdu
  'home.runOptimization': 'روٹ آپٹیمائزیشن چلائیں', // TODO: verify Urdu
  'home.viewFleetMap': 'لائیو فلیٹ نقشہ دیکھیں', // TODO: verify Urdu
  'home.generateReport': 'رپورٹ بنائیں', // TODO: verify Urdu
  'home.reportComingSoon': 'رپورٹ بنانا جلد آرہا ہے', // TODO: verify Urdu
  'home.empty.fleetTitle': 'فلیٹ میں کوئی گاڑی نہیں', // TODO: verify Urdu
  'home.empty.fleetDesc': 'فلیٹ کی حیثیت دیکھنے کے لیے ترتیبات سے گاڑی شامل کریں۔', // TODO: verify Urdu

  // LiveFleetMapPage
  'fleet.title': 'لائیو فلیٹ نقشہ',
  'fleet.subtitle': 'ریئل ٹائم گاڑی ٹریکنگ اور حیثیت کی نگرانی', // TODO: verify Urdu
  'fleet.location': 'ریاض، سعودی عرب', // TODO: verify Urdu
  'fleet.liveTracking': 'لائیو فلیٹ ٹریکنگ', // TODO: verify Urdu
  'fleet.legend': 'لیجنڈ', // TODO: verify Urdu
  'fleet.onRoute': 'راستے پر', // TODO: verify Urdu
  'fleet.delayed': 'تاخیر سے', // TODO: verify Urdu
  'fleet.idle': 'فارغ', // TODO: verify Urdu
  'fleet.vehicleDetails': 'گاڑی کی تفصیلات', // TODO: verify Urdu
  'fleet.selectVehicle': 'تفصیلات دیکھنے کے لیے نقشے پر گاڑی منتخب کریں', // TODO: verify Urdu
  'fleet.driver': 'ڈرائیور', // TODO: verify Urdu
  'fleet.currentLocation': 'موجودہ مقام', // TODO: verify Urdu
  'fleet.speed': 'رفتار', // TODO: verify Urdu
  'fleet.nextStop': 'اگلا پڑاؤ', // TODO: verify Urdu
  'fleet.eta': 'متوقع آمد', // TODO: verify Urdu
  'fleet.remainingStops': 'باقی پڑاؤ', // TODO: verify Urdu
  'fleet.routeProgress': 'راستے کی پیش رفت', // TODO: verify Urdu
  'fleet.contactDriver': 'ڈرائیور سے رابطہ', // TODO: verify Urdu
  'fleet.battery': 'بیٹری', // TODO: verify Urdu
  'fleet.fuel': 'ایندھن', // TODO: verify Urdu
  'fleet.destination': 'منزل', // TODO: verify Urdu
  'fleet.finalStop': 'آخری پڑاؤ', // TODO: verify Urdu
  'fleet.recalculate': 'راستہ دوبارہ حساب کریں', // TODO: verify Urdu
  'fleet.routing': 'راستہ بنایا جا رہا ہے…', // TODO: verify Urdu
  'fleet.legend.title': 'راستہ لیجنڈ', // TODO: verify Urdu
  'fleet.legend.original': 'اصلی راستہ', // TODO: verify Urdu
  'fleet.legend.recalc': 'دوبارہ حساب شدہ راستہ', // TODO: verify Urdu
  'fleet.vehicleLoading': 'EV-02 | لوڈ ہو رہا ہے…', // TODO: verify Urdu
  'fleet.clickVehicleHint': 'تفصیلات دیکھنے اور نقشہ منتقل کرنے کے لیے گاڑی پر کلک کریں', // TODO: verify Urdu
  'fleet.disruptionLog': 'خلل لاگ', // TODO: verify Urdu
  'fleet.disrupted': 'خلل', // TODO: verify Urdu
  'fleet.collapseSidebar': 'سائڈبار سکیڑیں', // TODO: verify Urdu
  'fleet.expandSidebar': 'سائڈبار کھولیں', // TODO: verify Urdu
  'fleet.mapAriaLabel': 'انٹرایکٹو فلیٹ نقشہ', // TODO: verify Urdu
  'fleet.empty.title': 'کوئی گاڑی نہیں ملی', // TODO: verify Urdu
  'fleet.empty.desc': 'موجودہ فلٹرز سے کوئی گاڑی میل نہیں کھاتی۔', // TODO: verify Urdu
  'fleet.resolved': 'حل ہو گیا', // TODO: verify Urdu
  'fleet.active': 'فعال', // TODO: verify Urdu

  // RouteOptimizationPage
  'route.title': 'راستے کی اصلاح',
  'route.subtitle': 'ہائبرڈ فلیٹ کے لیے AI سے چلنے والی روٹ پلاننگ', // TODO: verify Urdu
  'route.configuration': 'اصلاح کی ترتیب', // TODO: verify Urdu
  'route.costMin': 'لاگت کم سے کم', // TODO: verify Urdu
  'route.costMinDesc': 'SAR لاگت کی کارکردگی کو ترجیح', // TODO: verify Urdu
  'route.co2Min': 'CO₂ کم سے کم', // TODO: verify Urdu
  'route.co2MinDesc': 'کاربن فٹ پرنٹ کم کریں', // TODO: verify Urdu
  'route.balanced': 'متوازن', // TODO: verify Urdu
  'route.balancedDesc': 'تمام مقاصد کو برابر بہتر بنائیں', // TODO: verify Urdu
  'route.runOptimization': 'اصلاح چلائیں', // TODO: verify Urdu
  'route.fleetSummary': 'فلیٹ کا خلاصہ', // TODO: verify Urdu
  'route.solveTime': 'حل کا وقت', // TODO: verify Urdu
  'route.results': 'اصلاح کے نتائج', // TODO: verify Urdu
  'route.waitingTitle': 'اصلاح کے لیے تیار', // TODO: verify Urdu
  'route.waitingDesc': 'مقصد منتخب کریں اور بہترین راستے بنانے کے لیے اصلاح چلائیں پر کلک کریں', // TODO: verify Urdu
  'route.reportDelay': 'تاخیر کی اطلاع', // TODO: verify Urdu
  'route.defaultLabel': 'فعال راستہ', // TODO: verify Urdu

  // AnalyticsPage
  'analytics.title': 'تجزیات اور رپورٹنگ',
  'analytics.subtitle': 'فلیٹ کی کارکردگی کی بصیرت اور پائیداری کی پیمائش', // TODO: verify Urdu
  'analytics.export': 'رپورٹ ایکسپورٹ', // TODO: verify Urdu
  'analytics.costVsCO2': 'وقت کے ساتھ لاگت بمقابلہ CO₂ اخراج', // TODO: verify Urdu
  'analytics.dailyTrends': 'روزانہ لاگت اور اخراج کے رجحانات', // TODO: verify Urdu
  'analytics.cost': 'لاگت (SAR)', // TODO: verify Urdu
  'analytics.co2': 'CO₂ (کلوگرام)', // TODO: verify Urdu
  'analytics.insight': 'بصیرت: برقی گاڑیوں نے CO₂ اخراج میں 23% کمی میں حصہ لیا', // TODO: verify Urdu
  'analytics.utilizationTitle': 'گھنٹہ وار فلیٹ استعمال', // TODO: verify Urdu
  'analytics.utilizationDesc': 'دن بھر گاڑیوں کے استعمال کا انداز', // TODO: verify Urdu
  'analytics.peakHours': 'چوٹی کے گھنٹے', // TODO: verify Urdu
  'analytics.avgUtilization': 'اوسط استعمال', // TODO: verify Urdu
  'analytics.offPeak': 'غیر چوٹی گھنٹے', // TODO: verify Urdu
  'analytics.vehiclePerf': 'گاڑیوں کی کارکردگی کی تفصیل', // TODO: verify Urdu
  'analytics.vehiclePerfDesc': 'انفرادی گاڑیوں کی کارکردگی کی پیمائش', // TODO: verify Urdu
  'analytics.alertTitle': 'بلند ایندھن لاگت الرٹ', // TODO: verify Urdu
  'analytics.alertDesc': 'ICE ٹرک متوقع سے 34% زیادہ ایندھن خرچ کر رہے ہیں۔ راستے دوبارہ متوازن کریں۔', // TODO: verify Urdu
  'analytics.driverPerf': 'ڈرائیور کی کارکردگی کا موازنہ', // TODO: verify Urdu
  'analytics.driverPerfDesc': 'موازنہ کارکردگی اور ڈیلیوری کی پیمائش', // TODO: verify Urdu
  'analytics.driverName': 'ڈرائیور', // TODO: verify Urdu
  'analytics.deliveries': 'ڈیلیوریاں', // TODO: verify Urdu
  'analytics.onTime': 'بروقت %', // TODO: verify Urdu
  'analytics.efficiency': 'کارکردگی', // TODO: verify Urdu
  'analytics.hoursWorked': 'کام کے گھنٹے', // TODO: verify Urdu
  'analytics.empty.title': 'کوئی ڈیٹا دستیاب نہیں', // TODO: verify Urdu
  'analytics.empty.desc': 'ڈیٹا جمع ہونے پر چارٹ یہاں ظاہر ہوں گے۔', // TODO: verify Urdu
  'analytics.chartCostAria': 'وقت کے ساتھ لاگت بمقابلہ CO₂ کا لائن چارٹ', // TODO: verify Urdu
  'analytics.chartUtilizationAria': 'گھنٹہ وار فلیٹ استعمال کا چارٹ', // TODO: verify Urdu
  'analytics.chartDriverAria': 'ڈرائیور کی کارکردگی کا بار چارٹ', // TODO: verify Urdu

  // SettingsPage
  'settings.title': 'ترتیبات',
  'settings.subtitle': 'فلیٹ پیرامیٹرز اور سسٹم کی ترجیحات ترتیب دیں', // TODO: verify Urdu
  'settings.fleetConfig': 'فلیٹ کی ترتیب', // TODO: verify Urdu
  'settings.fleetConfigDesc': 'گاڑیوں کی اقسام اور صلاحیت کا انتظام', // TODO: verify Urdu
  'settings.iceTrucksCount': 'ICE ٹرکوں کی تعداد', // TODO: verify Urdu
  'settings.iceTruckCapacity': 'ICE ٹرک کی صلاحیت (کلوگرام)', // TODO: verify Urdu
  'settings.evCount': 'برقی گاڑیوں کی تعداد', // TODO: verify Urdu
  'settings.evCapacity': 'EV کی صلاحیت (کلوگرام)', // TODO: verify Urdu
  'settings.startTime': 'آپریٹنگ شروع کا وقت', // TODO: verify Urdu
  'settings.endTime': 'آپریٹنگ ختم کا وقت', // TODO: verify Urdu
  'settings.optimization': 'اصلاح کے وزن', // TODO: verify Urdu
  'settings.optimizationDesc': 'الگورتھم کی ترجیحات ایڈجسٹ کریں', // TODO: verify Urdu
  'settings.costWeight': 'لاگت کا وزن', // TODO: verify Urdu
  'settings.co2Weight': 'CO₂ کا وزن', // TODO: verify Urdu
  'settings.workloadWeight': 'کام کے توازن کا وزن', // TODO: verify Urdu
  'settings.weightsOk': 'وزن متوازن ہیں (100%)', // TODO: verify Urdu
  'settings.weightsWarning': '⚠ تنبیہ: وزن کا مجموعہ 100% ہونا چاہیے (موجودہ:', // TODO: verify Urdu
  'settings.language': 'زبان اور علاقائی ترتیبات', // TODO: verify Urdu
  'settings.languageDesc': 'انٹرفیس زبان اور لوکلائزیشن', // TODO: verify Urdu
  'settings.interfaceLang': 'انٹرفیس زبان', // TODO: verify Urdu
  'settings.english': 'English',
  'settings.arabic': 'العربية',
  'settings.currency': 'کرنسی', // TODO: verify Urdu
  'settings.save': 'ترتیبات محفوظ کریں', // TODO: verify Urdu
  'settings.reset': 'ڈیفالٹ پر ری سیٹ کریں', // TODO: verify Urdu
  'settings.system': 'سسٹم کی معلومات', // TODO: verify Urdu
  'settings.systemDesc': 'پلیٹ فارم اور کنیکٹیویٹی کی حیثیت', // TODO: verify Urdu
  'settings.version': 'پلیٹ فارم ورژن', // TODO: verify Urdu
  'settings.apiStatus': 'API کی حیثیت', // TODO: verify Urdu
  'settings.connected': 'منسلک', // TODO: verify Urdu
  'settings.dataRefresh': 'ڈیٹا ریفریش ریٹ', // TODO: verify Urdu
  'settings.refreshRate': '30 سیکنڈ', // TODO: verify Urdu
  'settings.ltr': 'LTR', // TODO: verify Urdu
  'settings.rtl': 'RTL', // TODO: verify Urdu
  'settings.savedToast': 'ترتیبات کامیابی سے محفوظ ہو گئیں', // TODO: verify Urdu
  'settings.saveErrorToast': 'ترتیبات محفوظ نہیں ہو سکیں', // TODO: verify Urdu
  'settings.resetToast': 'ترتیبات ڈیفالٹ پر ری سیٹ ہو گئیں', // TODO: verify Urdu

  // Mobile Layout
  'mobile.appTitle': 'FleetIoT ڈرائیور',
  'mobile.home': 'ہوم',
  'mobile.route': 'راستہ',
  'mobile.vehicle': 'گاڑی',
  'mobile.alerts': 'اطلاعات',
  'mobile.profile': 'پروفائل',

  // DriverHomePage
  'driver.welcome': 'خوش آمدید، محمد',
  'driver.today': 'آج اتوار، 1 فروری 2026 ہے',
  'driver.activeRoute': 'فعال راستہ',
  'driver.stops': 'پڑاؤ',
  'driver.estCompletion': 'متوقع تکمیل',
  'driver.progress': 'پیش رفت',
  'driver.packages': 'پارسل',
  'driver.estTime': 'متوقع وقت',
  'driver.nextStop': 'اگلا پڑاؤ',
  'driver.startNavigation': 'نیویگیشن شروع کریں',
  'driver.completedToday': 'آج مکمل',
  'driver.greatPerformance': 'شاندار کارکردگی!',
  'driver.aheadSchedule': 'آپ شیڈول سے 15 منٹ آگے ہیں',

  // RouteNavigationPage
  'nav2.title': 'راستہ نیویگیشن',
  'nav2.stopDetails': 'پڑاؤ کی تفصیلات',
  'nav2.packages': 'پارسل',
  'nav2.eta': 'متوقع آمد',
  'nav2.navigate': 'یہاں نیویگیٹ کریں',
  'nav2.markDelivered': 'ڈیلیور کے طور پر نشان لگائیں',
  'nav2.completed': 'مکمل',
  'nav2.current': 'جاری',
  'nav2.upcoming': 'آنے والا',
  'nav2.deliveredToast': 'پڑاؤ ڈیلیور شدہ نشان لگا دیا گیا', // TODO: verify Urdu
  'nav2.delayReportedToast': 'تاخیر ڈسپیچ کو رپورٹ کر دی گئی', // TODO: verify Urdu
  'nav2.delayDialogDesc': 'ڈسپیچ کو بتائیں کہ یہ پڑاؤ کیوں تاخیر سے ہے۔', // TODO: verify Urdu
  'nav2.delayReason': 'وجہ', // TODO: verify Urdu
  'nav2.delayReason.traffic': 'ٹریفک کی بھیڑ', // TODO: verify Urdu
  'nav2.delayReason.weather': 'موسمی حالات', // TODO: verify Urdu
  'nav2.delayReason.vehicle': 'گاڑی کا مسئلہ', // TODO: verify Urdu
  'nav2.delayReason.customer': 'گاہک دستیاب نہیں', // TODO: verify Urdu
  'nav2.delayReason.other': 'دیگر', // TODO: verify Urdu
  'nav2.empty.title': 'کوئی آنے والا پڑاؤ نہیں', // TODO: verify Urdu
  'nav2.empty.desc': 'آپ نے اس راستے کے سب پڑاؤ مکمل کر لیے ہیں۔', // TODO: verify Urdu

  // VehicleStatusPage
  'vehicle.title': 'گاڑی EV-02',
  'vehicle.type': 'برقی گاڑی',
  'vehicle.active': 'فعال',
  'vehicle.onRoute': 'راستے پر',
  'vehicle.batteryLevel': 'بیٹری کی سطح',
  'vehicle.estimatedRange': 'متوقع رینج',
  'vehicle.chargingNotRequired': 'چارجنگ: ضروری نہیں',
  'vehicle.performance': 'کارکردگی کے میٹرکس',
  'vehicle.speed': 'موجودہ رفتار',
  'vehicle.temp': 'موٹر درجہ حرارت',
  'vehicle.iotStatus': 'IoT کنیکٹیویٹی',
  'vehicle.gps': 'GPS',
  'vehicle.telematics': 'ٹیلی میٹکس',
  'vehicle.cellular': 'سیلولر',
  'vehicle.diagnostics': 'گاڑی کی تشخیص',
  'vehicle.allSystems': 'تمام سسٹم نارمل',
  'vehicle.allSystemsDesc': 'کوئی انتباہ یا خرابی نہیں',
  'vehicle.cargoLoad': 'سامان کا بوجھ', // TODO: verify Urdu
  'vehicle.currentLoad': 'موجودہ بوجھ', // TODO: verify Urdu
  'vehicle.capacityUsed': 'صلاحیت استعمال', // TODO: verify Urdu
  'vehicle.reportIssue': 'گاڑی کا مسئلہ رپورٹ کریں', // TODO: verify Urdu
  'vehicle.signalStrong': 'مضبوط', // TODO: verify Urdu
  'vehicle.signalWeak': 'کمزور', // TODO: verify Urdu
  'vehicle.excellent': 'بہترین', // TODO: verify Urdu
  'vehicle.issue.desc': 'بتائیں کہ گاڑی میں کیا خرابی ہے، مرمت کو اطلاع دی جائے گی۔', // TODO: verify Urdu
  'vehicle.issue.label': 'مسئلے کی تفصیل', // TODO: verify Urdu
  'vehicle.issue.placeholder': 'مثال: بوجھ کے تحت بیٹری غیر معمولی تیزی سے گر رہی ہے…', // TODO: verify Urdu
  'vehicle.issue.required': 'براہ کرم مسئلہ بتائیں', // TODO: verify Urdu
  'vehicle.issue.submitted': 'مسئلہ مرمت کو رپورٹ کر دیا گیا', // TODO: verify Urdu

  // NotificationsPage
  'notif.title': 'اطلاعات',
  'notif.unread': 'نہ پڑھی گئی اطلاع',
  'notif.unreadPlural': 'نہ پڑھی گئی اطلاعات',
  'notif.markAllRead': 'سب کو پڑھا ہوا نشان لگائیں',
  'notifications.weeklyPerformance': 'ہفتہ وار کارکردگی کا خلاصہ', // TODO: verify Urdu
  'notifications.weeklyPerformanceBody': 'ہفتے کی کارکردگی کے اعداد و شمار تیار ہیں۔ 42 ڈیلیوریاں، 94% بروقت۔', // TODO: verify Urdu
  'notifications.maintenanceReminder': 'گاڑی کی مرمت کی یاد دہانی', // TODO: verify Urdu
  'notifications.maintenanceReminderBody': 'EV-02 کو 2,400 کلومیٹر بعد روٹین مرمت کی ضرورت ہے۔', // TODO: verify Urdu
  'notifications.systemUpdate': 'سسٹم اپ ڈیٹ دستیاب', // TODO: verify Urdu
  'notifications.systemUpdateBody': 'ڈرائیور ایپ کا نیا ورژن دستیاب ہے۔', // TODO: verify Urdu
  'notifications.markAllRead': 'سب کو پڑھا ہوا نشان لگائیں', // TODO: verify Urdu
  'notifications.allMarkedRead': 'تمام اطلاعات پڑھی ہوئی نشان لگ گئیں', // TODO: verify Urdu
  'notifications.empty.title': 'آپ کے پاس سب کچھ پڑھا ہوا ہے', // TODO: verify Urdu
  'notifications.empty.desc': 'ابھی کوئی نئی اطلاع نہیں ہے۔', // TODO: verify Urdu

  // ProfilePage
  'profile.since': 'جنوری 2025 سے رکن',
  'profile.performanceSummary': 'کارکردگی کا خلاصہ',
  'profile.totalDeliveries': 'کل ڈیلیوریاں',
  'profile.onTimeRate': 'بروقت شرح',
  'profile.efficiency': 'کارکردگی',
  'profile.fuelSavings': 'ایندھن کی بچت',
  'profile.settings': 'ترتیبات',
  'profile.logout': 'لاگ آؤٹ',
  'profile.language': 'زبان',
  'profile.selectLanguage': 'زبان منتخب کریں',
  'profile.statusActive': 'فعال', // TODO: verify Urdu
  'profile.statusOffline': 'آف لائن', // TODO: verify Urdu
  'profile.badge.topPerformer': 'بہترین کارکردگی', // TODO: verify Urdu
  'profile.badge.workloadBalance': 'کام کا توازن', // TODO: verify Urdu
  'profile.achievements': 'کامیابیاں', // TODO: verify Urdu
  'profile.achievement.deliveries': '100 ڈیلیوریاں', // TODO: verify Urdu
  'profile.achievement.zeroDelays': 'صفر تاخیر', // TODO: verify Urdu
  'profile.achievement.efficiencyKing': 'کارکردگی کا بادشاہ', // TODO: verify Urdu
  'profile.achievement.fiveYears': '5 سالہ تجربہ', // TODO: verify Urdu
  'profile.achievement.fuelSaver': 'ایندھن بچانے والا', // TODO: verify Urdu
  'profile.editProfile': 'پروفائل میں ترمیم', // TODO: verify Urdu
  'profile.editProfileDesc': 'اپنا نام اور شفٹ کی حیثیت اپ ڈیٹ کریں۔', // TODO: verify Urdu
  'profile.viewAllAchievements': 'تمام کامیابیاں دیکھیں', // TODO: verify Urdu
  'profile.collapseAchievements': 'کم کامیابیاں دکھائیں', // TODO: verify Urdu
  'profile.nameLabel': 'ڈسپلے نام', // TODO: verify Urdu
  'profile.statusLabel': 'شفٹ کی حیثیت', // TODO: verify Urdu
  'profile.savedToast': 'پروفائل اپ ڈیٹ ہو گئی', // TODO: verify Urdu
  'profile.loggedOutToast': 'آپ لاگ آؤٹ ہو گئے ہیں', // TODO: verify Urdu
  'profile.settingsComingSoon': 'موبائل ترتیبات جلد آرہی ہیں', // TODO: verify Urdu

  // IoT
  'iot.connected': 'IoT آلہ منسلک',
  'iot.offline': 'آلہ آف لائن',
  'iot.lastKnown': 'آخری معلوم ڈیٹا',
  'iot.liveData': 'لائیو IoT فیڈ',
  'iot.temperature': 'درجہ حرارت',
  'iot.humidity': 'نمی',
  'iot.motion': 'حرکت کی حالت',
  'iot.satellites': 'سیٹلائٹ',
  'iot.altitude': 'اونچائی',
  'iot.recalculating': 'راستہ دوبارہ حساب ہو رہا ہے',
  'iot.disruption': 'خلل کا پتہ چلا',
  'iot.reliability': 'قابل اعتماد',
  'iot.resolve': 'حل کریں',
  'iot.noDisruptions': 'کوئی فعال خلل نہیں',
  'iot.deviceConfig': 'آلہ IP',
  'iot.liveIndicator': 'براہ راست',
  'iot.recalcLast': 'آخری دوبارہ حساب',
  'iot.lastKnownShort': 'آخری معلوم', // TODO: verify Urdu
  'iot.connecting': 'ESP32 سے رابطہ ہو رہا ہے…', // TODO: verify Urdu
  'iot.disconnected': 'ESP32 منقطع', // TODO: verify Urdu
  'iot.useMock': 'فرضی ڈیٹا پر جائیں', // TODO: verify Urdu
  'iot.source': 'IoT ڈیٹا کا ذریعہ', // TODO: verify Urdu
  'iot.mock': 'فرضی', // TODO: verify Urdu
  'iot.esp32': 'ESP32',

  // Common
  'common.cancel': 'منسوخ', // TODO: verify Urdu
  'common.submit': 'جمع کریں', // TODO: verify Urdu
  'common.save': 'محفوظ کریں', // TODO: verify Urdu
  'common.close': 'بند کریں', // TODO: verify Urdu

  // Optimization extras
  'optimization.fleetSize': 'فلیٹ کا حجم:', // TODO: verify Urdu
  'optimization.activeRoutes': 'فعال راستے:', // TODO: verify Urdu
  'optimization.algorithm': 'الگورتھم:', // TODO: verify Urdu
  'optimization.geneticAlgorithm': 'جینیاتی الگورتھم', // TODO: verify Urdu
};

export const allTranslations: Record<Language, Record<string, string>> = { en, ar, ur };
