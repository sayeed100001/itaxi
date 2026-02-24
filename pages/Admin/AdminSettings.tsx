import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Settings, Map, Save, AlertTriangle, Key, Globe, Crosshair, Zap, CheckCircle, Eye, EyeOff, RefreshCcw, Navigation, DollarSign, List, Activity, Server, Clock, Search, MessageCircle } from 'lucide-react';
import { AdminSettings as AdminSettingsType, ServiceClass } from '../../types';

export const AdminSettings: React.FC = () => {
    const { adminSettings, updateAdminSettings, addToast } = useAppStore();
    const [config, setConfig] = useState<AdminSettingsType>(JSON.parse(JSON.stringify(adminSettings)));
    const [activeTab, setActiveTab] = useState<'general' | 'services' | 'dispatch' | 'keys'>('general');
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({ ors: false, mapbox: false, google: false, whatsapp: false });
    const [whatsappConfig, setWhatsappConfig] = useState<{ phoneNumberId: string; accessToken: string; appSecret: string; verifyToken: string }>({
        phoneNumberId: '',
        accessToken: '',
        appSecret: '',
        verifyToken: '',
    });

    useEffect(() => {
        const loadBackendConfig = async () => {
            try {
                const token = localStorage.getItem('token');
                const [whatsRes, orsRes] = await Promise.all([
                    fetch('/api/admin/config/whatsapp', {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch('/api/admin/config/routing', {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                ]);

                const whatsData = await whatsRes.json();
                const orsData = await orsRes.json();

                if (whatsRes.ok && whatsData?.data) {
                    setWhatsappConfig((prev) => ({
                        ...prev,
                        phoneNumberId: whatsData.data.phoneNumberId || '',
                    }));
                }

                if (orsRes.ok && orsData?.data && orsData.data.apiKeyMasked) {
                    setConfig((prev) => ({
                        ...prev,
                        apiKeys: { ...prev.apiKeys, ors: orsData.data.apiKeyMasked },
                    }));
                }
            } catch {
                // best-effort; keep UI usable even if backend config fetch fails
            }
        };

        loadBackendConfig();
    }, []);

    // --- Actions ---
    const handleSave = async () => {
        try {
            updateAdminSettings(config);
            const token = localStorage.getItem('token');

            if (config.apiKeys.ors && config.apiKeys.ors.length > 5) {
                await fetch('/api/admin/config/routing', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ apiKey: config.apiKeys.ors }),
                });
            }

            if (whatsappConfig.phoneNumberId && whatsappConfig.accessToken) {
                await fetch('/api/admin/config/whatsapp', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        phoneNumberId: whatsappConfig.phoneNumberId,
                        accessToken: whatsappConfig.accessToken,
                        appSecret: whatsappConfig.appSecret || undefined,
                        verifyToken: whatsappConfig.verifyToken || undefined,
                    }),
                });
            }

            addToast('success', 'System configuration saved and synced to server.');
        } catch {
            addToast('error', 'Failed to save configuration to server.');
        }
    };

    const handleReset = () => {
        setConfig(JSON.parse(JSON.stringify(adminSettings)));
        addToast('info', 'Unsaved changes discarded.');
    };

    const updateServiceClass = (index: number, field: keyof ServiceClass, value: any) => {
        const newServices = [...config.services];
        newServices[index] = { ...newServices[index], [field]: value };
        setConfig({ ...config, services: newServices });
    };

    const toggleKeyVisibility = (key: string) => setShowKeys({ ...showKeys, [key]: !showKeys[key] });

    // --- Sub-Components ---
    const ApiKeyInput = ({ label, providerKey, value, link, isActive }: any) => (
        <div className={`p-4 rounded-xl border transition-all ${isActive ? 'bg-brand-50/50 dark:bg-brand-900/10 border-brand-200 dark:border-brand-500/30' : 'bg-transparent border-dark-100 dark:border-white/5'}`}>
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-dark-700 dark:text-dark-300">{label}</label>
                    {isActive && <span className="text-[10px] bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded font-bold uppercase">Active</span>}
                </div>
                <a href={link} target="_blank" className="text-[10px] text-brand-500 hover:underline">Get Key</a>
            </div>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-dark-400"><Key size={16} /></div>
                <input 
                    type={showKeys[providerKey] ? "text" : "password"}
                    className="w-full pl-10 pr-24 p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-mono text-sm"
                    value={value}
                    onChange={(e) => setConfig({ ...config, apiKeys: { ...config.apiKeys, [providerKey]: e.target.value } })}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                     <button onClick={() => toggleKeyVisibility(providerKey)} className="p-2 text-dark-400 hover:text-dark-600 dark:hover:text-white">{showKeys[providerKey] ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                     <Button size="sm" variant="secondary" className="h-8 text-xs px-2">Test</Button>
                </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
                {value.length > 5 ? (
                    <span className="text-[10px] font-bold text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle size={10} /> Valid Format</span>
                ) : (
                    <span className="text-[10px] font-bold text-red-500 dark:text-red-400 flex items-center gap-1"><AlertTriangle size={10} /> Missing/Invalid</span>
                )}
            </div>
        </div>
    );

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 pb-24 relative">
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-dark-900 dark:text-white tracking-tight">System Configuration</h1>
                    <p className="text-dark-500 dark:text-dark-400">Master control panel for routing, services, and dispatch logic.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
                        <RefreshCcw size={16} />
                        Reset
                    </Button>
                    <Button onClick={handleSave} className="flex items-center gap-2">
                        <Save size={16} />
                        Save Changes
                    </Button>
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 border-b border-dark-100 dark:border-white/5">
                {[
                    { id: 'general', label: 'Map & Geo', icon: Globe },
                    { id: 'services', label: 'Service Tiers', icon: List },
                    { id: 'dispatch', label: 'Drivers & Dispatch', icon: Activity },
                    { id: 'keys', label: 'API Keys', icon: Server },
                ].map((tab) => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-5 py-3 font-bold text-sm rounded-t-xl transition-all border-b-2 ${activeTab === tab.id ? 'border-brand-500 text-brand-600 dark:text-white bg-white dark:bg-white/5' : 'border-transparent text-dark-500 hover:text-dark-900 dark:hover:text-white'}`}
                    >
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            <div className="max-w-7xl mx-auto">
                {/* 1. GENERAL MAP SETTINGS */}
                {activeTab === 'general' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2">
                        <Card>
                            <h3 className="font-bold text-lg mb-4 text-dark-900 dark:text-white flex items-center gap-2">
                                <Map className="text-blue-500"/> Map Provider
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-dark-700 dark:text-dark-300 mb-2">Visual Map Tiles</label>
                                    <select 
                                        className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={config.mapProvider}
                                        onChange={(e) => setConfig({ ...config, mapProvider: e.target.value as any })}
                                    >
                                        <option value="osm">OpenStreetMap (Standard)</option>
                                        <option value="mapbox">Mapbox Vector (High Perf)</option>
                                        <option value="google">Google Maps (Satellite/Hybrid)</option>
                                    </select>
                                    <p className="text-[10px] text-dark-500 mt-2">Selects the base layer. Mapbox requires an API key.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-dark-700 dark:text-dark-300 mb-2">Routing Engine</label>
                                    <select 
                                        className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={config.routingProvider}
                                        onChange={(e) => setConfig({ ...config, routingProvider: e.target.value as any })}
                                    >
                                        <option value="ors">OpenRouteService (Free Tier)</option>
                                        <option value="mapbox">Mapbox Traffic (Accurate)</option>
                                    </select>
                                </div>
                            </div>
                        </Card>

                        <Card>
                            <h3 className="font-bold text-lg mb-4 text-dark-900 dark:text-white flex items-center gap-2">
                                <Crosshair className="text-red-500"/> Default Location
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-dark-700 dark:text-dark-300 mb-1.5">Latitude</label>
                                    <input 
                                        type="number" step="0.000001"
                                        className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={config.system.defaultCenter.lat}
                                        onChange={(e) => setConfig({...config, system: {...config.system, defaultCenter: {...config.system.defaultCenter, lat: parseFloat(e.target.value)}}})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-dark-700 dark:text-dark-300 mb-1.5">Longitude</label>
                                    <input 
                                        type="number" step="0.000001"
                                        className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={config.system.defaultCenter.lng}
                                        onChange={(e) => setConfig({...config, system: {...config.system, defaultCenter: {...config.system.defaultCenter, lng: parseFloat(e.target.value)}}})}
                                    />
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* 2. SERVICE TIERS */}
                {activeTab === 'services' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            {config.services.map((service, idx) => (
                                <Card key={service.id} className="border-t-4 border-t-brand-500">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-lg text-dark-900 dark:text-white">{service.name}</h3>
                                        <span className="text-xs font-bold bg-dark-100 dark:bg-white/10 px-2 py-1 rounded uppercase">{service.id}</span>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase text-dark-500">Base Fare</label>
                                                <input type="number" className="w-full p-2 bg-dark-50 dark:bg-dark-900 rounded border border-dark-200 dark:border-white/10 text-sm font-bold"
                                                    value={service.baseFare} onChange={(e) => updateServiceClass(idx, 'baseFare', parseFloat(e.target.value))} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase text-dark-500">Min Fare</label>
                                                <input type="number" className="w-full p-2 bg-dark-50 dark:bg-dark-900 rounded border border-dark-200 dark:border-white/10 text-sm font-bold"
                                                    value={service.minFare} onChange={(e) => updateServiceClass(idx, 'minFare', parseFloat(e.target.value))} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold uppercase text-dark-500">Per Km</label>
                                                <input type="number" className="w-full p-2 bg-dark-50 dark:bg-dark-900 rounded border border-dark-200 dark:border-white/10 text-sm font-bold"
                                                    value={service.perKm} onChange={(e) => updateServiceClass(idx, 'perKm', parseFloat(e.target.value))} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold uppercase text-dark-500">Per Min</label>
                                                <input type="number" className="w-full p-2 bg-dark-50 dark:bg-dark-900 rounded border border-dark-200 dark:border-white/10 text-sm font-bold"
                                                    value={service.perMin} onChange={(e) => updateServiceClass(idx, 'perMin', parseFloat(e.target.value))} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold uppercase text-dark-500">Commission (%)</label>
                                            <input type="number" className="w-full p-2 bg-dark-50 dark:bg-dark-900 rounded border border-dark-200 dark:border-white/10 text-sm font-bold"
                                                value={service.commission} onChange={(e) => updateServiceClass(idx, 'commission', parseFloat(e.target.value))} />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. DISPATCH SETTINGS */}
                {activeTab === 'dispatch' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2">
                        <Card>
                            <h3 className="font-bold text-lg mb-4 text-dark-900 dark:text-white flex items-center gap-2">
                                <Search className="text-purple-500"/> Dispatch Logic
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-dark-700 dark:text-dark-300 mb-2">Search Radius (km)</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={config.system.radiusLimit}
                                        onChange={(e) => setConfig({...config, system: {...config.system, radiusLimit: parseInt(e.target.value)}})}
                                    />
                                    <p className="text-[10px] text-dark-500 mt-1">Maximum distance to search for drivers.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-dark-700 dark:text-dark-300 mb-2">Acceptance Timeout (sec)</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={config.system.dispatchTimeout}
                                        onChange={(e) => setConfig({...config, system: {...config.system, dispatchTimeout: parseInt(e.target.value)}})}
                                    />
                                    <p className="text-[10px] text-dark-500 mt-1">Time given to a driver to accept request.</p>
                                </div>
                            </div>
                        </Card>

                        <Card>
                            <h3 className="font-bold text-lg mb-4 text-dark-900 dark:text-white flex items-center gap-2">
                                <Activity className="text-green-500"/> System Health
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-dark-700 dark:text-dark-300 mb-2">Driver Position Update Interval (ms)</label>
                                    <input 
                                        type="number" step="100"
                                        className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={config.system.driverUpdateInterval}
                                        onChange={(e) => setConfig({...config, system: {...config.system, driverUpdateInterval: parseInt(e.target.value)}})}
                                    />
                                    <p className="text-[10px] text-dark-500 mt-1">Lower values = smoother map animations but higher load.</p>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-900 rounded-xl border border-dark-200 dark:border-white/5">
                                    <div className="font-bold text-sm">Manual Fare Negotiation</div>
                                    <button 
                                        onClick={() => setConfig({...config, system: {...config.system, enableManualFare: !config.system.enableManualFare}})}
                                        className={`w-10 h-5 rounded-full relative transition-colors ${config.system.enableManualFare ? 'bg-brand-600' : 'bg-dark-300'}`}
                                    >
                                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${config.system.enableManualFare ? 'left-6' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* 4. API KEYS */}
                {activeTab === 'keys' && (
                    <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2">
                        <Card className="border-l-4 border-l-orange-500">
                             <h3 className="font-bold text-lg mb-6 text-dark-900 dark:text-white flex items-center gap-2">
                                <Server className="text-orange-500"/> Provider Credentials
                            </h3>
                            <div className="space-y-4">
                                <ApiKeyInput 
                                    label="OpenRouteService (ORS)" 
                                    providerKey="ors" 
                                    value={config.apiKeys.ors} 
                                    link="https://openrouteservice.org"
                                    isActive={config.routingProvider === 'ors'}
                                />
                                <ApiKeyInput 
                                    label="Mapbox Public Token" 
                                    providerKey="mapbox" 
                                    value={config.apiKeys.mapbox} 
                                    link="https://mapbox.com"
                                    isActive={config.mapProvider === 'mapbox' || config.routingProvider === 'mapbox'}
                                />
                                <ApiKeyInput 
                                    label="Google Maps API Key" 
                                    providerKey="google" 
                                    value={config.apiKeys.google} 
                                    link="https://cloud.google.com/maps-platform"
                                    isActive={config.mapProvider === 'google'}
                                />
                                <div className="mt-6 pt-4 border-t border-dark-100 dark:border-white/5">
                                    <h4 className="font-bold text-md mb-3 flex items-center gap-2 text-dark-900 dark:text-white">
                                        <MessageCircle className="text-green-500" /> WhatsApp OTP (Cloud API)
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-dark-700 dark:text-dark-300 mb-1.5">Phone Number ID</label>
                                            <input
                                                type="text"
                                                className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                                                value={whatsappConfig.phoneNumberId}
                                                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, phoneNumberId: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-dark-700 dark:text-dark-300 mb-1.5">Verify Token</label>
                                            <input
                                                type={showKeys.whatsapp ? 'text' : 'password'}
                                                className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                                                value={whatsappConfig.verifyToken}
                                                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, verifyToken: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-dark-700 dark:text-dark-300 mb-1.5">Access Token</label>
                                            <input
                                                type={showKeys.whatsapp ? 'text' : 'password'}
                                                className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                                                value={whatsappConfig.accessToken}
                                                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, accessToken: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-dark-700 dark:text-dark-300 mb-1.5">App Secret (optional)</label>
                                            <input
                                                type={showKeys.whatsapp ? 'text' : 'password'}
                                                className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm"
                                                value={whatsappConfig.appSecret}
                                                onChange={(e) => setWhatsappConfig({ ...whatsappConfig, appSecret: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <p className="mt-2 text-[10px] text-dark-500 dark:text-dark-400">
                                        After saving, OTP and ride notifications will use these WhatsApp Cloud API credentials instead of `.env`.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};
