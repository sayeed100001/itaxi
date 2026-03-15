
import React, { useState } from 'react';
import { useAppStore, DEFAULT_ADMIN_SETTINGS } from '../../store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Settings, Map, Save, AlertTriangle, Key, Globe, Crosshair, Zap, CheckCircle, Eye, EyeOff, RefreshCcw, Navigation, DollarSign, List, Activity, Server, Clock, Search, Shield } from 'lucide-react';
import { AdminSettings as AdminSettingsType, ServiceClass } from '../../types';
import { apiFetch } from '../../services/api';

export const AdminSettings: React.FC = () => {
    const adminSettings = useAppStore((state) => state.adminSettings);
    const updateAdminSettings = useAppStore((state) => state.updateAdminSettings);
    const addToast = useAppStore((state) => state.addToast);
    const [config, setConfig] = useState<AdminSettingsType>(adminSettings ? JSON.parse(JSON.stringify(adminSettings)) : DEFAULT_ADMIN_SETTINGS);

    // Keep local config in sync when adminSettings changes from outside (e.g. portal/features toggles)
    React.useEffect(() => {
        if (adminSettings) setConfig(JSON.parse(JSON.stringify(adminSettings)));
    }, [adminSettings]);
    const [activeTab, setActiveTab] = useState<'general' | 'services' | 'pricing' | 'dispatch' | 'keys' | 'security'>('general');
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({ ors: false, mapbox: false, google: false });

    // --- Actions ---
    const handleSave = () => {
        updateAdminSettings(config);
        addToast('success', 'System configuration saved successfully.');
    };

    const handleReset = () => {
        setConfig(adminSettings ? JSON.parse(JSON.stringify(adminSettings)) : DEFAULT_ADMIN_SETTINGS);
        addToast('info', 'Unsaved changes discarded.');
    };

    const updateServiceClass = (index: number, field: keyof ServiceClass, value: any) => {
        const newServices = [...config.services];
        newServices[index] = { ...newServices[index], [field]: value };
        setConfig({ ...config, services: newServices });
    };

    const toggleKeyVisibility = (key: string) => setShowKeys({ ...showKeys, [key]: !showKeys[key] });

    const clearApiKey = (providerKey: string) => {
        setConfig({ ...config, apiKeys: { ...(config.apiKeys || {}), [providerKey]: '' } as any });
        addToast('info', `${providerKey.toUpperCase()} key cleared.`);
    };

    const testRoutingProvider = async (providerKey: 'ors' | 'mapbox' | 'osrm' | 'mock') => {
        addToast('info', `Testing ${providerKey.toUpperCase()} routing...`);
        try {
            const res = await apiFetch('/api/admin/routing/test', {
                method: 'POST',
                body: JSON.stringify({ provider: providerKey })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.ok) {
                throw new Error(data?.error || `HTTP ${res.status}`);
            }

            const km = Number(data.distance) / 1000;
            const min = Number(data.duration) / 60;
            addToast('success', `${String(data.provider || providerKey).toUpperCase()} OK: ${Number.isFinite(km) ? km.toFixed(2) : '?'} km • ${Number.isFinite(min) ? Math.round(min) : '?'} min`);
        } catch (e: any) {
            addToast('error', `${providerKey.toUpperCase()} test failed: ${e?.message || 'Unknown error'}`);
        }
    };

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
                    className="w-full pl-10 pr-44 p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-mono text-sm"
                    value={value}
                    onChange={(e) => setConfig({ ...config, apiKeys: { ...(config.apiKeys || {}), [providerKey]: e.target.value } as any })}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
                     <button onClick={() => toggleKeyVisibility(providerKey)} className="p-2 text-dark-400 hover:text-dark-600 dark:hover:text-white">{showKeys[providerKey] ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                     <Button size="sm" variant="secondary" className="h-8 text-xs px-2" onClick={() => clearApiKey(providerKey)}>Clear</Button>
                     {(providerKey === 'ors' || providerKey === 'mapbox') ? (
                        <Button size="sm" variant="secondary" className="h-8 text-xs px-2" onClick={() => testRoutingProvider(providerKey)}>
                            Test
                        </Button>
                     ) : (
                        <Button size="sm" variant="secondary" className="h-8 text-xs px-2" onClick={() => addToast('info', 'No automated test for this provider yet.')}>Test</Button>
                     )}
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
        <div className="p-4 sm:p-6 md:p-8 bg-dark-50 dark:bg-dark-950 relative">
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-dark-900 dark:text-white tracking-tight">System Configuration</h1>
                    <p className="text-dark-500 dark:text-dark-400">Master control panel for routing, services, and dispatch logic.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Button variant="ghost" onClick={handleReset} icon={<RefreshCcw size={16}/>}>Reset</Button>
                    <Button onClick={handleSave} icon={<Save size={16}/>}>Save Changes</Button>
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 border-b border-dark-100 dark:border-white/5 hide-scrollbar">
                {[
                    { id: 'general', label: 'Map & Geo', icon: Globe },
                    { id: 'services', label: 'Service Tiers', icon: List },
                    { id: 'pricing', label: 'Pricing & Loyalty', icon: DollarSign },
                    { id: 'dispatch', label: 'Drivers & Dispatch', icon: Activity },
                    { id: 'security', label: 'Security', icon: Shield },
                    { id: 'keys', label: 'API Keys', icon: Server },
                ].map((tab) => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-3.5 sm:px-5 py-2.5 sm:py-3 font-bold text-xs sm:text-sm rounded-xl transition-all border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-brand-500 text-brand-600 dark:text-white bg-white dark:bg-white/5' : 'border-transparent text-dark-500 hover:text-dark-900 dark:hover:text-white'}`}
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
                                        <option value="mock">Simulation Mode (Dev)</option>
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

                {/* 3. PRICING & LOYALTY */}
                {activeTab === 'pricing' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-2">
                        <Card>
                            <h3 className="font-bold text-lg mb-4 text-dark-900 dark:text-white flex items-center gap-2">
                                <DollarSign className="text-green-500"/> Commission & Fees
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-dark-700 dark:text-dark-300 mb-2">Commission Rate (%)</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={config.pricing.commissionRate}
                                        onChange={(e) => setConfig({...config, pricing: {...config.pricing, commissionRate: parseFloat(e.target.value)}})}
                                    />
                                    <p className="text-[10px] text-dark-500 mt-1">Percentage deducted from driver earnings per ride.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-dark-700 dark:text-dark-300 mb-2">Minimum Fare (AFN)</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={config.pricing.minFare}
                                        onChange={(e) => setConfig({...config, pricing: {...config.pricing, minFare: parseFloat(e.target.value)}})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-dark-700 dark:text-dark-300 mb-2">Cancellation Fee (AFN)</label>
                                    <input 
                                        type="number" 
                                        className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={config.pricing.cancellationFee}
                                        onChange={(e) => setConfig({...config, pricing: {...config.pricing, cancellationFee: parseFloat(e.target.value)}})}
                                    />
                                </div>
                            </div>
                        </Card>

                        <Card>
                            <h3 className="font-bold text-lg mb-4 text-dark-900 dark:text-white flex items-center gap-2">
                                <Zap className="text-yellow-500"/> Loyalty Program
                            </h3>
                            <div className="space-y-4">
                                <div className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-500/10 dark:to-orange-500/10 rounded-xl border border-yellow-200 dark:border-yellow-500/20">
                                    <div className="text-sm font-bold text-dark-900 dark:text-white mb-3">Tier Discounts</div>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-white/5 rounded-lg">
                                            <span className="font-bold inline-flex items-center gap-2">
                                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path d="M7 2h4l1 7-3 2-4-9z" fill="#B45309" fill-opacity="0.9" />
                                                    <path d="M17 2h-4l-1 7 3 2 4-9z" fill="#92400E" fill-opacity="0.9" />
                                                    <circle cx="12" cy="15" r="6" fill="#D97706" fill-opacity="0.95" />
                                                    <circle cx="12" cy="15" r="2.6" fill="#FFEDD5" fill-opacity="0.85" />
                                                </svg>
                                                Bronze (0-9 rides)
                                            </span>
                                            <span className="font-mono font-bold">0% OFF</span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-white/5 rounded-lg">
                                            <span className="font-bold inline-flex items-center gap-2">
                                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path d="M7 2h4l1 7-3 2-4-9z" fill="#64748B" fill-opacity="0.9" />
                                                    <path d="M17 2h-4l-1 7 3 2 4-9z" fill="#475569" fill-opacity="0.9" />
                                                    <circle cx="12" cy="15" r="6" fill="#94A3B8" fill-opacity="0.95" />
                                                    <circle cx="12" cy="15" r="2.6" fill="#F1F5F9" fill-opacity="0.85" />
                                                </svg>
                                                Silver (10-29 rides)
                                            </span>
                                            <span className="font-mono font-bold text-green-600">5% OFF</span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-white/5 rounded-lg">
                                            <span className="font-bold inline-flex items-center gap-2">
                                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path d="M7 2h4l1 7-3 2-4-9z" fill="#B45309" fill-opacity="0.75" />
                                                    <path d="M17 2h-4l-1 7 3 2 4-9z" fill="#92400E" fill-opacity="0.75" />
                                                    <circle cx="12" cy="15" r="6" fill="#F59E0B" fill-opacity="0.95" />
                                                    <circle cx="12" cy="15" r="2.6" fill="#FEF3C7" fill-opacity="0.9" />
                                                </svg>
                                                Gold (30-49 rides)
                                            </span>
                                            <span className="font-mono font-bold text-green-600">10% OFF</span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-white/50 dark:bg-white/5 rounded-lg">
                                            <span className="font-bold inline-flex items-center gap-2">
                                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path d="M7 6l5-4 5 4 4 5-9 11-9-11 4-5z" fill="#06B6D4" fill-opacity="0.95" />
                                                    <path d="M12 2l5 4-5 16-5-16 5-4z" fill="#67E8F9" fill-opacity="0.7" />
                                                </svg>
                                                Platinum (50+ rides)
                                            </span>
                                            <span className="font-mono font-bold text-green-600">15% OFF</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-dark-500 p-3 bg-dark-50 dark:bg-dark-900 rounded-xl">
                                    <strong>Note:</strong> Loyalty discounts are applied automatically at checkout. Riders earn 1 point per completed ride.
                                </div>
                            </div>
                        </Card>
                    </div>
                )}

                {/* 4. DISPATCH SETTINGS */}
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

                {/* 5. SECURITY */}
                {activeTab === 'security' && (
                    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-2">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="border-l-4 border-l-emerald-500">
                                <h3 className="font-bold text-lg mb-1 text-dark-900 dark:text-white flex items-center gap-2">
                                    <Shield className="text-emerald-500" /> Login OTP (WhatsApp / Email)
                                </h3>
                                <p className="text-[11px] text-dark-500 dark:text-dark-400 mb-4">
                                    Enable a one-time code after password verification. Recommended for Rider and Driver accounts.
                                </p>

                                {(() => {
                                    const currentOtp = (config.auth?.loginOtp || DEFAULT_ADMIN_SETTINGS.auth?.loginOtp)!;
                                    const updateOtp = (patch: any) => {
                                        setConfig({
                                            ...config,
                                            auth: {
                                                ...(config.auth || {}),
                                                loginOtp: { ...currentOtp, ...patch }
                                            }
                                        });
                                    };

                                    const roles = ['rider', 'driver', 'admin'] as const;
                                    const channels = ['whatsapp', 'email'] as const;

                                    return (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-900 rounded-xl border border-dark-200 dark:border-white/10">
                                                <div>
                                                    <div className="font-bold text-sm text-dark-900 dark:text-white">Enable OTP</div>
                                                    <div className="text-[10px] text-dark-500 dark:text-dark-400">Requires a code on login for selected roles.</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => updateOtp({ enabled: !currentOtp.enabled })}
                                                    className={`w-10 h-5 rounded-full relative transition-colors ${currentOtp.enabled ? 'bg-brand-600' : 'bg-dark-300 dark:bg-white/20'}`}
                                                >
                                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${currentOtp.enabled ? 'left-6' : 'left-1'}`}></div>
                                                </button>
                                            </div>

                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-dark-500 dark:text-dark-400 mb-2">Roles</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {roles.map((r) => {
                                                        const active = Array.isArray(currentOtp.roles) ? currentOtp.roles.includes(r as any) : false;
                                                        return (
                                                            <button
                                                                key={r}
                                                                type="button"
                                                                onClick={() => {
                                                                    const next = new Set((Array.isArray(currentOtp.roles) ? currentOtp.roles : []) as any[]);
                                                                    if (active) next.delete(r as any);
                                                                    else next.add(r as any);
                                                                    updateOtp({ roles: Array.from(next) });
                                                                }}
                                                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${active
                                                                    ? 'bg-brand-600 text-white border-brand-600'
                                                                    : 'bg-white/80 dark:bg-dark-950 border-dark-200 dark:border-white/10 text-dark-700 dark:text-dark-200'
                                                                    }`}
                                                            >
                                                                {r.toUpperCase()}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-dark-500 dark:text-dark-400 mb-2">Channels</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {channels.map((c) => {
                                                        const active = Array.isArray(currentOtp.channels) ? currentOtp.channels.includes(c as any) : false;
                                                        return (
                                                            <button
                                                                key={c}
                                                                type="button"
                                                                onClick={() => {
                                                                    const next = new Set((Array.isArray(currentOtp.channels) ? currentOtp.channels : []) as any[]);
                                                                    if (active) next.delete(c as any);
                                                                    else next.add(c as any);
                                                                    const nextArr = Array.from(next);
                                                                    const nextDefault = nextArr.includes(currentOtp.defaultChannel) ? currentOtp.defaultChannel : (nextArr[0] || 'whatsapp');
                                                                    updateOtp({ channels: nextArr, defaultChannel: nextDefault });
                                                                }}
                                                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${active
                                                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                                                    : 'bg-white/80 dark:bg-dark-950 border-dark-200 dark:border-white/10 text-dark-700 dark:text-dark-200'
                                                                    }`}
                                                            >
                                                                {c === 'whatsapp' ? 'WhatsApp' : 'Email'}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-bold text-dark-700 dark:text-dark-300 mb-1.5">Default Channel</label>
                                                    <select
                                                        className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                                        value={currentOtp.defaultChannel}
                                                        onChange={(e) => updateOtp({ defaultChannel: e.target.value })}
                                                    >
                                                        <option value="whatsapp">WhatsApp</option>
                                                        <option value="email">Email</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-dark-700 dark:text-dark-300 mb-1.5">TTL (seconds)</label>
                                                    <input
                                                        type="number"
                                                        min={60}
                                                        step={10}
                                                        className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                                        value={currentOtp.ttlSeconds}
                                                        onChange={(e) => updateOtp({ ttlSeconds: Math.max(60, parseInt(e.target.value || '0', 10) || 300) })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 items-end">
                                                <div>
                                                    <label className="block text-xs font-bold text-dark-700 dark:text-dark-300 mb-1.5">Max Attempts</label>
                                                    <input
                                                        type="number"
                                                        min={3}
                                                        max={10}
                                                        className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                                        value={currentOtp.maxAttempts}
                                                        onChange={(e) => updateOtp({ maxAttempts: Math.min(10, Math.max(3, parseInt(e.target.value || '0', 10) || 5)) })}
                                                    />
                                                </div>
                                                <div className="text-[10px] text-dark-500 dark:text-dark-400">
                                                    WhatsApp needs: <span className="font-mono">TWILIO_* + TWILIO_WHATSAPP_FROM</span>.<br />
                                                    Email needs: <span className="font-mono">SMTP_HOST/USER/PASS</span>.
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-900 rounded-xl border border-dark-200 dark:border-white/10">
                                                <div>
                                                    <div className="font-bold text-sm text-dark-900 dark:text-white">Also require OTP on Sign Up</div>
                                                    <div className="text-[10px] text-dark-500 dark:text-dark-400">New users must verify phone/email after registration.</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => updateOtp({ enableOnRegister: !(currentOtp as any).enableOnRegister })}
                                                    className={`w-10 h-5 rounded-full relative transition-colors ${ (currentOtp as any).enableOnRegister ? 'bg-brand-600' : 'bg-dark-300 dark:bg-white/20'}`}
                                                >
                                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${ (currentOtp as any).enableOnRegister ? 'left-6' : 'left-1'}`}></div>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </Card>

                            <Card className="border-l-4 border-l-blue-500">
                                <h3 className="font-bold text-lg mb-4 text-dark-900 dark:text-white flex items-center gap-2">
                                    <Shield className="text-blue-500" /> Google reCAPTCHA
                                </h3>
                                <p className="text-[11px] text-dark-500 dark:text-dark-400 mb-4">
                                    Protect login and registration from bots. Requires a Google reCAPTCHA v2 site key.
                                </p>
                                {(() => {
                                    const currentCaptcha = (config.auth as any)?.recaptcha || { enabled: false, siteKey: '', applyTo: ['login', 'register'] };
                                    const updateCaptcha = (patch: any) => setConfig({
                                        ...config,
                                        auth: { ...(config.auth || {}), recaptcha: { ...currentCaptcha, ...patch } }
                                    });
                                    const pages = ['login', 'register'] as const;
                                    return (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-900 rounded-xl border border-dark-200 dark:border-white/10">
                                                <div>
                                                    <div className="font-bold text-sm text-dark-900 dark:text-white">Enable reCAPTCHA</div>
                                                    <div className="text-[10px] text-dark-500 dark:text-dark-400">Blocks automated bots on selected pages.</div>
                                                </div>
                                                <button type="button" onClick={() => updateCaptcha({ enabled: !currentCaptcha.enabled })}
                                                    className={`w-10 h-5 rounded-full relative transition-colors ${currentCaptcha.enabled ? 'bg-blue-600' : 'bg-dark-300 dark:bg-white/20'}`}>
                                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${currentCaptcha.enabled ? 'left-6' : 'left-1'}`}></div>
                                                </button>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-dark-700 dark:text-dark-300 mb-1.5">Site Key (v2 Checkbox)</label>
                                                <input
                                                    type="text"
                                                    placeholder="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
                                                    className="w-full p-3 rounded-xl bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-white/10 text-dark-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-mono text-xs"
                                                    value={currentCaptcha.siteKey || ''}
                                                    onChange={(e) => updateCaptcha({ siteKey: e.target.value.trim() })}
                                                />
                                                <p className="text-[10px] text-dark-500 mt-1">Secret key must be set as <span className="font-mono">RECAPTCHA_SECRET_KEY</span> env var on server.</p>
                                            </div>

                                            <div>
                                                <div className="text-[10px] font-bold uppercase tracking-wider text-dark-500 dark:text-dark-400 mb-2">Apply To</div>
                                                <div className="flex gap-2">
                                                    {pages.map((p) => {
                                                        const active = Array.isArray(currentCaptcha.applyTo) && currentCaptcha.applyTo.includes(p);
                                                        return (
                                                            <button key={p} type="button"
                                                                onClick={() => {
                                                                    const next = new Set(Array.isArray(currentCaptcha.applyTo) ? currentCaptcha.applyTo : []);
                                                                    if (active) next.delete(p); else next.add(p);
                                                                    updateCaptcha({ applyTo: Array.from(next) });
                                                                }}
                                                                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/80 dark:bg-dark-950 border-dark-200 dark:border-white/10 text-dark-700 dark:text-dark-200'}`}>
                                                                {p.charAt(0).toUpperCase() + p.slice(1)}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-200 text-[12px] leading-relaxed">
                                                Get your keys at <span className="font-mono font-bold">google.com/recaptcha</span>. Use <strong>v2 "I'm not a robot"</strong> type.
                                            </div>
                                        </div>
                                    );
                                })()}
                            </Card>
                        </div>
                    </div>
                )}

                {/* 6. API KEYS */}
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
                                    value={config?.apiKeys?.ors || ''} 
                                    link="https://openrouteservice.org"
                                    isActive={config.routingProvider === 'ors'}
                                />
                                <ApiKeyInput 
                                    label="Mapbox Public Token" 
                                    providerKey="mapbox" 
                                    value={config?.apiKeys?.mapbox || ''} 
                                    link="https://mapbox.com"
                                    isActive={config.mapProvider === 'mapbox' || config.routingProvider === 'mapbox'}
                                />
                                <ApiKeyInput 
                                    label="Google Maps API Key" 
                                    providerKey="google" 
                                    value={config?.apiKeys?.google || ''} 
                                    link="https://cloud.google.com/maps-platform"
                                    isActive={config.mapProvider === 'google'}
                                />
                            </div>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};
