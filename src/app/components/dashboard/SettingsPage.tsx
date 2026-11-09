import React from 'react';
import { toast } from 'sonner';
import { Settings, Truck, Sliders, Globe, Save } from 'lucide-react';
import { useLanguage, type Language } from '@/app/i18n/LanguageContext';
import { Button } from '@/app/components/ui/button';
import { WEIGHTS_STORAGE_KEY as STORAGE_KEY } from '@/app/config/optimizationWeights';

const DEFAULTS = { cost: 40, co2: 30, workload: 30 };

export function SettingsPage() {
  const { t, language, setLanguage, isRTL } = useLanguage();
  const [costWeight, setCostWeight] = React.useState(DEFAULTS.cost);
  const [co2Weight, setCo2Weight] = React.useState(DEFAULTS.co2);
  const [workloadWeight, setWorkloadWeight] = React.useState(DEFAULTS.workload);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<typeof DEFAULTS>;
      if (typeof parsed.cost === 'number') setCostWeight(parsed.cost);
      if (typeof parsed.co2 === 'number') setCo2Weight(parsed.co2);
      if (typeof parsed.workload === 'number') setWorkloadWeight(parsed.workload);
    } catch {
      // ignore corrupted storage
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ cost: costWeight, co2: co2Weight, workload: workloadWeight }),
      );
      toast.success(t('settings.savedToast'));
    } catch {
      toast.error(t('settings.saveErrorToast'));
    }
  };

  const handleReset = () => {
    setCostWeight(DEFAULTS.cost);
    setCo2Weight(DEFAULTS.co2);
    setWorkloadWeight(DEFAULTS.workload);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    toast.success(t('settings.resetToast'));
  };

  return (
    <div className={`p-8 ${isRTL ? 'text-right' : ''}`}>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-2">{t('settings.title')}</h1>
        <p className="text-gray-600">{t('settings.subtitle')}</p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Fleet Configuration */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-blue-700" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('settings.fleetConfig')}</h2>
                <p className="text-sm text-gray-600">{t('settings.fleetConfigDesc')}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="ice-trucks-count" className="block text-sm font-medium text-gray-700 mb-2">{t('settings.iceTrucksCount')}</label>
                <input id="ice-trucks-count" type="number" defaultValue={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
              </div>
              <div>
                <label htmlFor="ice-truck-capacity" className="block text-sm font-medium text-gray-700 mb-2">{t('settings.iceTruckCapacity')}</label>
                <input id="ice-truck-capacity" type="number" defaultValue={1000} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="ev-count" className="block text-sm font-medium text-gray-700 mb-2">{t('settings.evCount')}</label>
                <input id="ev-count" type="number" defaultValue={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
              </div>
              <div>
                <label htmlFor="ev-capacity" className="block text-sm font-medium text-gray-700 mb-2">{t('settings.evCapacity')}</label>
                <input id="ev-capacity" type="number" defaultValue={800} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="start-time" className="block text-sm font-medium text-gray-700 mb-2">{t('settings.startTime')}</label>
                <input id="start-time" type="time" defaultValue="08:00" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
              </div>
              <div>
                <label htmlFor="end-time" className="block text-sm font-medium text-gray-700 mb-2">{t('settings.endTime')}</label>
                <input id="end-time" type="time" defaultValue="18:00" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" />
              </div>
            </div>
          </div>
        </div>

        {/* Optimization Weights */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Sliders className="w-5 h-5 text-purple-700" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('settings.optimization')}</h2>
                <p className="text-sm text-gray-600">{t('settings.optimizationDesc')}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {[
              { id: 'cost-weight', label: t('settings.costWeight'), value: costWeight, setter: setCostWeight, accent: 'accent-blue-600' },
              { id: 'co2-weight', label: t('settings.co2Weight'), value: co2Weight, setter: setCo2Weight, accent: 'accent-green-600' },
              { id: 'workload-weight', label: t('settings.workloadWeight'), value: workloadWeight, setter: setWorkloadWeight, accent: 'accent-purple-600' },
            ].map((w) => (
              <div key={w.label}>
                <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <label htmlFor={w.id} className="text-sm font-medium text-gray-700">{w.label}</label>
                  <span className="text-sm font-semibold text-gray-900">{w.value}%</span>
                </div>
                <input id={w.id} type="range" min="0" max="100" value={w.value}
                  onChange={(e) => w.setter(parseInt(e.target.value))}
                  className={`w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer ${w.accent}`} />
              </div>
            ))}

            <div className={`p-4 rounded-lg ${
              costWeight + co2Weight + workloadWeight === 100
                ? 'bg-green-50 border border-green-200'
                : 'bg-amber-50 border border-amber-200'
            }`}>
              <p className="text-sm">
                {costWeight + co2Weight + workloadWeight === 100 ? (
                  <span className="text-green-700">✓ {t('settings.weightsOk')}</span>
                ) : (
                  <span className="text-amber-700">
                    {t('settings.weightsWarning')} {costWeight + co2Weight + workloadWeight}%)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Language & Regional Settings */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Globe className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{t('settings.language')}</h2>
                <p className="text-sm text-gray-600">{t('settings.languageDesc')}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-3">{t('settings.interfaceLang')}</span>
              <div className="grid grid-cols-2 gap-4">
                {(['en', 'ar'] as Language[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    aria-label={lang === 'en' ? 'English' : 'العربية'}
                    aria-pressed={language === lang}
                    className={`p-4 rounded-lg border-2 transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${isRTL ? 'text-right' : 'text-left'} ${
                      language === lang ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{lang === 'en' ? 'English' : 'العربية'}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {lang === 'en' ? `International (${t('settings.ltr')})` : `Arabic (${t('settings.rtl')})`}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="currency-select" className="block text-sm font-medium text-gray-700 mb-2">{t('settings.currency')}</label>
              <select
                id="currency-select"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="sar">Saudi Riyal (SAR)</option>
                <option value="usd">US Dollar (USD)</option>
                <option value="eur">Euro (EUR)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save/Reset */}
        <div className={`flex gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button
            variant="default"
            size="lg"
            onClick={handleSave}
            className="flex-1 transition-colors duration-150"
          >
            <Save className="w-5 h-5" />
            {t('settings.save')}
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={handleReset}
            className="transition-colors duration-150"
          >
            {t('settings.reset')}
          </Button>
        </div>

        {/* System Info */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">{t('settings.system')}</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">{t('settings.version')}</p>
              <p className="font-medium text-gray-900">v2.1.0</p>
            </div>
            <div>
              <p className="text-gray-600">{t('settings.apiStatus')}</p>
              <p className="font-medium text-green-700">{t('settings.connected')}</p>
            </div>
            <div>
              <p className="text-gray-600">{t('settings.dataRefresh')}</p>
              <p className="font-medium text-gray-900">{t('settings.refreshRate')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
