
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { User, Mail, Bell, Moon, Shield, ChevronRight, LogOut, FileText, Upload, Globe, ChevronLeft, Save, Smartphone } from 'lucide-react';
import { useAppStore } from '../../store';
import { translations } from '../../constants/translations';

export const SettingsPage: React.FC = () => {
    const user = useAppStore((state) => state.user);
    const currentRole = useAppStore((state) => state.currentRole);
    const isDarkMode = useAppStore((state) => state.isDarkMode);
    const toggleDarkMode = useAppStore((state) => state.toggleDarkMode);
    const logout = useAppStore((state) => state.logout);
    const addToast = useAppStore((state) => state.addToast);
    const language = useAppStore((state) => state.language);
    const setLanguage = useAppStore((state) => state.setLanguage);
    const updateUserProfile = useAppStore((state) => state.updateUserProfile);
    const t = translations[language];
    const isRTL = language === 'fa';

    // Edit state
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        email: (user as any)?.email || '',
    });

    const handleUpload = () => {
        addToast('info', 'Document uploading...');
        setTimeout(() => addToast('success', 'Document verified successfully'), 2000);
    };

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'fa' : 'en');
    };

    const handleSaveProfile = () => {
        updateUserProfile(formData);
        setEditMode(false);
        addToast('success', 'Profile updated successfully.');
    };

    const sections = [
        {
            title: t.settings.pref_section,
            items: [
                {
                    icon: <Bell size={18} />,
                    label: t.settings.notif_label,
                    toggle: true,
                    defaultChecked: true
                },
                {
                    icon: <Moon size={18} />,
                    label: t.settings.dark_mode,
                    toggle: true,
                    checked: isDarkMode,
                    action: toggleDarkMode
                },
                {
                    icon: <Globe size={18} />,
                    label: t.settings.language,
                    value: language === 'en' ? 'English' : 'فارسی',
                    action: toggleLanguage,
                    isLang: true
                },
            ]
        }
    ];

    const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

    return (
        <div className="p-4 sm:p-6 md:p-8 min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            <h1 style={{ fontSize: 'clamp(1.25rem, 5vw, 1.875rem)' }} className="font-bold text-slate-900 dark:text-white mb-1">{t.settings.title}</h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mb-6 md:mb-8">{t.settings.desc}</p>

            <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
                {/* Sidebar / Profile Card */}
                <div className="w-full lg:w-80 space-y-6">
                    <Card className="flex flex-col items-center p-6 md:p-8">
                        <div className="relative mb-4">
                            <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-4 border-white dark:border-slate-800 shadow-lg">
                                <img src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=2563eb&color=fff`} alt="Profile" className="w-full h-full object-cover" />
                            </div>
                            <button className="absolute bottom-0 right-0 bg-brand-600 text-white p-2 rounded-full border-4 border-white dark:border-slate-900 hover:bg-brand-500 transition-colors">
                                <User size={14} />
                            </button>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{user?.name}</h2>
                        <p className="text-brand-600 dark:text-brand-400 text-sm mb-4 capitalize">{user?.role ? t.roles[user.role] : ''} Account</p>
                        <div className="flex gap-2 w-full">
                            <div className="flex-1 bg-slate-100 dark:bg-dark-900 rounded-lg p-2 text-center border border-slate-200 dark:border-white/5">
                                <div className="text-xs text-slate-500 dark:text-slate-400">Rating</div>
                                <div className="font-bold text-slate-900 dark:text-white">{user?.rating} ★</div>
                            </div>
                            <div className="flex-1 bg-slate-100 dark:bg-dark-900 rounded-lg p-2 text-center border border-slate-200 dark:border-white/5">
                                <div className="text-xs text-slate-500 dark:text-slate-400">Trips</div>
                                <div className="font-bold text-slate-900 dark:text-white">{user?.totalTrips || 0}</div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Main Settings Form */}
                <div className="flex-1 space-y-6">
                    {/* Profile Fields */}
                    <div>
                        <div className="flex justify-between items-center mb-3 ms-2">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t.settings.account_section}</h3>
                            <button
                                onClick={() => editMode ? handleSaveProfile() : setEditMode(true)}
                                className="text-xs font-bold text-brand-600 hover:text-brand-500"
                            >
                                {editMode ? 'Save' : 'Edit'}
                            </button>
                        </div>
                        <Card className="!p-0 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-4">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                    <User size={18} />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs text-slate-500 mb-1">{t.settings.personal_info}</div>
                                    {editMode ? (
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                                        />
                                    ) : (
                                        <div className="text-slate-900 dark:text-white font-medium text-sm">{user?.name}</div>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 flex items-center gap-4">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                    <Smartphone size={18} />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs text-slate-500 mb-1">{t.settings.phone || 'Phone Number'}</div>
                                    {editMode ? (
                                        <input
                                            type="tel"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                                        />
                                    ) : (
                                        <div className="text-slate-900 dark:text-white font-medium text-sm">{user?.phone}</div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-100 dark:border-white/5 flex items-center gap-4">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                    <Mail size={18} />
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs text-slate-500 mb-1">Email (OTP / Receipts)</div>
                                    {editMode ? (
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-dark-900 border border-slate-200 dark:border-white/10 rounded px-2 py-1 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand-500"
                                            placeholder="name@example.com"
                                        />
                                    ) : (
                                        <div className="text-slate-900 dark:text-white font-medium text-sm">{(user as any)?.email || 'Not set'}</div>
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Driver Specific Documents Section */}
                    {currentRole === 'driver' && (
                        <div>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 ms-2">{t.settings.compliance}</h3>
                            <Card className="space-y-4">
                                <div className="flex items-center justify-between p-2">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <div className="text-slate-900 dark:text-white font-medium text-sm">{t.settings.license}</div>
                                            <div className="text-xs text-green-600 dark:text-green-400 font-bold">{t.settings.verified}</div>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="ghost" className="text-slate-400" disabled>{t.settings.view}</Button>
                                </div>
                                <div className="flex items-center justify-between p-2 border-t border-slate-100 dark:border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex items-center justify-center">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <div className="text-slate-900 dark:text-white font-medium text-sm">{t.settings.insurance}</div>
                                            <div className="text-xs text-yellow-600 dark:text-yellow-400 font-bold">{t.settings.expiring}</div>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="secondary" onClick={handleUpload} icon={<Upload size={14} />}>{t.settings.update}</Button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {sections.map((section, idx) => (
                        <div key={idx}>
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 ms-2">{section.title}</h3>
                            <Card className="!p-0 overflow-hidden">
                                {section.items.map((item, i) => (
                                    <div
                                        key={i}
                                        onClick={item.action}
                                        className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                                {item.icon}
                                            </div>
                                            <div>
                                                <div className="text-slate-900 dark:text-white font-medium text-sm">{item.label}</div>
                                                {item.value && <div className="text-xs text-slate-500">{item.value}</div>}
                                            </div>
                                        </div>

                                        {item.toggle ? (
                                            <div className={`w-10 h-5 rounded-full relative transition-colors ${item.checked || item.defaultChecked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${item.checked || item.defaultChecked ? 'start-6' : 'start-1'}`}></div>
                                            </div>
                                        ) : item.isLang ? (
                                            <div className="flex items-center gap-2 text-xs font-bold text-brand-600 bg-brand-50 dark:bg-brand-500/10 px-2 py-1 rounded">
                                                {item.value}
                                            </div>
                                        ) : (
                                            <ChevronIcon size={16} className="text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                                        )}
                                    </div>
                                ))}
                            </Card>
                        </div>
                    ))}

                    <div className="pt-4">
                        <Button variant="danger" className="w-full" onClick={logout} icon={<LogOut size={16} className="rtl:rotate-180" />}>
                            {t.settings.sign_out}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
