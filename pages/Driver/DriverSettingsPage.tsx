import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
    Bell, 
    Globe, 
    Moon, 
    Volume2, 
    Navigation, 
    DollarSign, 
    Shield, 
    Smartphone,
    MapPin,
    Clock,
    AlertCircle,
    CheckCircle
} from 'lucide-react';
import { useAppStore } from '../../store';
import { API_BASE } from '../../config';

interface DriverSettings {
    autoAcceptRadius: number; // km
    preferredAreas: string[];
    minFareAccept: number; // AFN
    maxDailyTrips: number;
    notifications: {
        newRideRequest: boolean;
        rideAccepted: boolean;
        rideCompleted: boolean;
        paymentReceived: boolean;
        lowCredit: boolean;
        documentExpiry: boolean;
    };
    availability: {
        monday: { enabled: boolean; start: string; end: string };
        tuesday: { enabled: boolean; start: string; end: string };
        wednesday: { enabled: boolean; start: string; end: string };
        thursday: { enabled: boolean; start: string; end: string };
        friday: { enabled: boolean; start: string; end: string };
        saturday: { enabled: boolean; start: string; end: string };
        sunday: { enabled: boolean; start: string; end: string };
    };
}

const DEFAULT_SETTINGS: DriverSettings = {
    autoAcceptRadius: 5,
    preferredAreas: [],
    minFareAccept: 50,
    maxDailyTrips: 20,
    notifications: {
        newRideRequest: true,
        rideAccepted: true,
        rideCompleted: true,
        paymentReceived: true,
        lowCredit: true,
        documentExpiry: true,
    },
    availability: {
        monday: { enabled: true, start: '08:00', end: '20:00' },
        tuesday: { enabled: true, start: '08:00', end: '20:00' },
        wednesday: { enabled: true, start: '08:00', end: '20:00' },
        thursday: { enabled: true, start: '08:00', end: '20:00' },
        friday: { enabled: true, start: '08:00', end: '20:00' },
        saturday: { enabled: true, start: '08:00', end: '20:00' },
        sunday: { enabled: false, start: '08:00', end: '20:00' },
    },
};

export const DriverSettingsPage: React.FC = () => {
    const { addToast, isDarkMode, toggleDarkMode } = useAppStore();
    const [settings, setSettings] = useState<DriverSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'preferences' | 'notifications' | 'availability'>('preferences');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/drivers/settings`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            const data = await response.json();
            if (data.success && data.data) {
                setSettings({ ...DEFAULT_SETTINGS, ...data.data });
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/drivers/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(settings),
            });

            const data = await response.json();
            if (data.success) {
                addToast('success', 'Settings saved successfully');
            } else {
                addToast('error', data.message || 'Failed to save settings');
            }
        } catch (error) {
            addToast('error', 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="text-dark-500">Loading settings...</div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 pb-24">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-dark-900 dark:text-white">Driver Settings</h1>
                <p className="text-dark-500 dark:text-dark-400">Customize your driving experience</p>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-dark-200 dark:border-white/10">
                {[
                    { id: 'preferences', label: 'Preferences', icon: <Navigation size={18} /> },
                    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> },
                    { id: 'availability', label: 'Availability', icon: <Clock size={18} /> },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-3 font-bold text-sm border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                                : 'border-transparent text-dark-500 hover:text-dark-900 dark:hover:text-white'
                        }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
                <div className="space-y-6">
                    <Card className="p-6 bg-white dark:bg-dark-900">
                        <h3 className="text-lg font-bold text-dark-900 dark:text-white mb-4">Ride Preferences</h3>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="text-sm font-bold text-dark-700 dark:text-dark-300 mb-2 flex items-center gap-2">
                                    <MapPin size={16} />
                                    Auto-Accept Radius (km)
                                </label>
                                <input
                                    type="number"
                                    value={settings.autoAcceptRadius}
                                    onChange={(e) => setSettings({ ...settings, autoAcceptRadius: parseInt(e.target.value) || 0 })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                    min="1"
                                    max="50"
                                />
                                <p className="text-xs text-dark-500 mt-1">Only show ride requests within this radius</p>
                            </div>

                            <div>
                                <label className="text-sm font-bold text-dark-700 dark:text-dark-300 mb-2 flex items-center gap-2">
                                    <DollarSign size={16} />
                                    Minimum Fare to Accept (AFN)
                                </label>
                                <input
                                    type="number"
                                    value={settings.minFareAccept}
                                    onChange={(e) => setSettings({ ...settings, minFareAccept: parseInt(e.target.value) || 0 })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                    min="0"
                                />
                                <p className="text-xs text-dark-500 mt-1">Automatically filter out low-fare rides</p>
                            </div>

                            <div>
                                <label className="text-sm font-bold text-dark-700 dark:text-dark-300 mb-2 flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    Maximum Daily Trips
                                </label>
                                <input
                                    type="number"
                                    value={settings.maxDailyTrips}
                                    onChange={(e) => setSettings({ ...settings, maxDailyTrips: parseInt(e.target.value) || 0 })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                    min="1"
                                    max="100"
                                />
                                <p className="text-xs text-dark-500 mt-1">Stop receiving requests after reaching this limit</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-white dark:bg-dark-900">
                        <h3 className="text-lg font-bold text-dark-900 dark:text-white mb-4">App Preferences</h3>
                        
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-dark-50 dark:bg-white/5 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <Moon size={20} className="text-dark-500" />
                                    <div>
                                        <div className="font-bold text-dark-900 dark:text-white">Dark Mode</div>
                                        <div className="text-xs text-dark-500">Use dark theme</div>
                                    </div>
                                </div>
                                <button
                                    onClick={toggleDarkMode}
                                    className={`w-12 h-6 rounded-full transition-colors ${
                                        isDarkMode ? 'bg-brand-500' : 'bg-dark-300'
                                    }`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                                        isDarkMode ? 'translate-x-6' : 'translate-x-0.5'
                                    }`} />
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <Card className="p-6 bg-white dark:bg-dark-900">
                    <h3 className="text-lg font-bold text-dark-900 dark:text-white mb-4">Notification Preferences</h3>
                    
                    <div className="space-y-4">
                        {Object.entries(settings.notifications).map(([key, value]) => (
                            <div key={key} className="flex items-center justify-between p-4 bg-dark-50 dark:bg-white/5 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <Bell size={20} className="text-dark-500" />
                                    <div>
                                        <div className="font-bold text-dark-900 dark:text-white capitalize">
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </div>
                                        <div className="text-xs text-dark-500">
                                            {key === 'newRideRequest' && 'Get notified when new rides are available'}
                                            {key === 'rideAccepted' && 'Confirmation when you accept a ride'}
                                            {key === 'rideCompleted' && 'Notification when trip is completed'}
                                            {key === 'paymentReceived' && 'Alert when payment is received'}
                                            {key === 'lowCredit' && 'Warning when credit balance is low'}
                                            {key === 'documentExpiry' && 'Reminder for expiring documents'}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSettings({
                                        ...settings,
                                        notifications: {
                                            ...settings.notifications,
                                            [key]: !value
                                        }
                                    })}
                                    className={`w-12 h-6 rounded-full transition-colors ${
                                        value ? 'bg-brand-500' : 'bg-dark-300'
                                    }`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                                        value ? 'translate-x-6' : 'translate-x-0.5'
                                    }`} />
                                </button>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Availability Tab */}
            {activeTab === 'availability' && (
                <Card className="p-6 bg-white dark:bg-dark-900">
                    <h3 className="text-lg font-bold text-dark-900 dark:text-white mb-4">Weekly Availability</h3>
                    <p className="text-sm text-dark-500 mb-6">Set your preferred working hours for each day</p>
                    
                    <div className="space-y-4">
                        {Object.entries(settings.availability).map(([day, schedule]) => (
                            <div key={day} className="p-4 bg-dark-50 dark:bg-white/5 rounded-xl">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <Clock size={18} className="text-dark-500" />
                                        <span className="font-bold text-dark-900 dark:text-white capitalize">{day}</span>
                                    </div>
                                    <button
                                        onClick={() => setSettings({
                                            ...settings,
                                            availability: {
                                                ...settings.availability,
                                                [day]: { ...schedule, enabled: !schedule.enabled }
                                            }
                                        })}
                                        className={`w-12 h-6 rounded-full transition-colors ${
                                            schedule.enabled ? 'bg-brand-500' : 'bg-dark-300'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                                            schedule.enabled ? 'translate-x-6' : 'translate-x-0.5'
                                        }`} />
                                    </button>
                                </div>
                                
                                {schedule.enabled && (
                                    <div className="flex items-center gap-4 ml-9">
                                        <div className="flex-1">
                                            <label className="text-xs text-dark-500 mb-1 block">Start Time</label>
                                            <input
                                                type="time"
                                                value={schedule.start}
                                                onChange={(e) => setSettings({
                                                    ...settings,
                                                    availability: {
                                                        ...settings.availability,
                                                        [day]: { ...schedule, start: e.target.value }
                                                    }
                                                })}
                                                className="w-full p-2 bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 rounded-lg text-sm"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs text-dark-500 mb-1 block">End Time</label>
                                            <input
                                                type="time"
                                                value={schedule.end}
                                                onChange={(e) => setSettings({
                                                    ...settings,
                                                    availability: {
                                                        ...settings.availability,
                                                        [day]: { ...schedule, end: e.target.value }
                                                    }
                                                })}
                                                className="w-full p-2 bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 rounded-lg text-sm"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Save Button */}
            <div className="fixed bottom-20 left-0 right-0 p-6 bg-gradient-to-t from-dark-50 dark:from-dark-950 to-transparent pointer-events-none">
                <div className="max-w-4xl mx-auto pointer-events-auto">
                    <Button 
                        onClick={handleSaveSettings} 
                        disabled={saving}
                        className="w-full"
                        size="lg"
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
