import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { User, Mail, Bell, Moon, Shield, LogOut, Phone, Lock, Globe, MapPin, X } from 'lucide-react';
import { useAppStore } from '../../store';
import { API_BASE } from '../../config';

export const SettingsPage: React.FC = () => {
    const { user, isDarkMode, toggleDarkMode, logout, addToast, language, setLanguage, setUser } = useAppStore();
    
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        city: user?.city || '',
        province: user?.province || '',
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showPhoneModal, setShowPhoneModal] = useState(false);
    const [newPhone, setNewPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [notifications, setNotifications] = useState(true);

    const handleSaveProfile = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/auth/update-profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();
            if (data.success) {
                setUser({ ...user!, ...formData });
                setEditMode(false);
                addToast('success', 'Profile updated successfully');
            } else {
                addToast('error', data.message || 'Failed to update profile');
            }
        } catch (error) {
            addToast('error', 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            addToast('error', 'Passwords do not match');
            return;
        }
        if (passwordData.newPassword.length < 6) {
            addToast('error', 'Password must be at least 6 characters');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/auth/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setShowPasswordModal(false);
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                addToast('success', 'Password changed successfully');
            } else {
                addToast('error', data.message || 'Failed to change password');
            }
        } catch (error) {
            addToast('error', 'Failed to change password');
        }
    };

    const handleSendOTP = async () => {
        if (!newPhone || newPhone.length < 10) {
            addToast('error', 'Please enter a valid phone number');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: newPhone }),
            });

            const data = await response.json();
            if (data.success) {
                setOtpSent(true);
                addToast('success', 'OTP sent to your phone');
            } else {
                addToast('error', data.message || 'Failed to send OTP');
            }
        } catch (error) {
            addToast('error', 'Failed to send OTP');
        }
    };

    const handleVerifyAndChangePhone = async () => {
        if (!otp || otp.length !== 6) {
            addToast('error', 'Please enter valid 6-digit OTP');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/auth/change-phone`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ newPhone, otp }),
            });

            const data = await response.json();
            if (data.success) {
                setUser({ ...user!, phone: newPhone });
                setShowPhoneModal(false);
                setNewPhone('');
                setOtp('');
                setOtpSent(false);
                addToast('success', 'Phone number changed successfully');
            } else {
                addToast('error', data.message || 'Failed to change phone');
            }
        } catch (error) {
            addToast('error', 'Failed to change phone');
        }
    };

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 pb-24">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-dark-900 dark:text-white">Settings</h1>
                <p className="text-dark-500 dark:text-dark-400">Manage your account and preferences</p>
            </header>

            <div className="max-w-4xl space-y-6">
                {/* Profile Section */}
                <Card className="p-6 bg-white dark:bg-dark-900">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-dark-900 dark:text-white">Profile Information</h2>
                        {!editMode ? (
                            <Button size="sm" onClick={() => setEditMode(true)}>Edit Profile</Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <User size={14} />
                                Full Name
                            </label>
                            {editMode ? (
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            ) : (
                                <div className="text-dark-900 dark:text-white font-medium">{user?.name}</div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Mail size={14} />
                                Email Address
                            </label>
                            {editMode ? (
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            ) : (
                                <div className="text-dark-900 dark:text-white font-medium">{user?.email || 'Not set'}</div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Phone size={14} />
                                Phone Number
                            </label>
                            <div className="flex items-center justify-between">
                                <div className="text-dark-900 dark:text-white font-medium">{user?.phone}</div>
                                <Button size="sm" variant="secondary" onClick={() => setShowPhoneModal(true)}>Change</Button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <MapPin size={14} />
                                City
                            </label>
                            {editMode ? (
                                <input
                                    type="text"
                                    value={formData.city}
                                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            ) : (
                                <div className="text-dark-900 dark:text-white font-medium">{user?.city || 'Not set'}</div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <MapPin size={14} />
                                Province
                            </label>
                            {editMode ? (
                                <input
                                    type="text"
                                    value={formData.province}
                                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            ) : (
                                <div className="text-dark-900 dark:text-white font-medium">{user?.province || 'Not set'}</div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Security Section */}
                <Card className="p-6 bg-white dark:bg-dark-900">
                    <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-6">Security</h2>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-dark-50 dark:bg-white/5 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Lock size={20} className="text-dark-500" />
                                <div>
                                    <div className="font-bold text-dark-900 dark:text-white">Password</div>
                                    <div className="text-xs text-dark-500">••••••••</div>
                                </div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => setShowPasswordModal(true)}>Change</Button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-dark-50 dark:bg-white/5 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Shield size={20} className="text-dark-500" />
                                <div>
                                    <div className="font-bold text-dark-900 dark:text-white">Two-Factor Authentication</div>
                                    <div className="text-xs text-dark-500">Add extra security layer</div>
                                </div>
                            </div>
                            <Button size="sm" variant="secondary" disabled>Enable</Button>
                        </div>
                    </div>
                </Card>

                {/* Preferences Section */}
                <Card className="p-6 bg-white dark:bg-dark-900">
                    <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-6">Preferences</h2>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-dark-50 dark:bg-white/5 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Bell size={20} className="text-dark-500" />
                                <div>
                                    <div className="font-bold text-dark-900 dark:text-white">Push Notifications</div>
                                    <div className="text-xs text-dark-500">Receive updates and alerts</div>
                                </div>
                            </div>
                            <button
                                onClick={() => setNotifications(!notifications)}
                                className={`w-12 h-6 rounded-full transition-colors ${
                                    notifications ? 'bg-brand-500' : 'bg-dark-300'
                                }`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                                    notifications ? 'translate-x-6' : 'translate-x-0.5'
                                }`} />
                            </button>
                        </div>

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

                        <div className="flex items-center justify-between p-4 bg-dark-50 dark:bg-white/5 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Globe size={20} className="text-dark-500" />
                                <div>
                                    <div className="font-bold text-dark-900 dark:text-white">Language</div>
                                    <div className="text-xs text-dark-500">{language === 'en' ? 'English' : 'فارسی'}</div>
                                </div>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')}>
                                Change
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Logout */}
                <Button variant="danger" className="w-full" onClick={logout} icon={<LogOut size={16} />}>
                    Sign Out
                </Button>
            </div>

            {/* Password Change Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <Card className="w-full max-w-md bg-white dark:bg-dark-900">
                        <div className="p-6 border-b border-dark-100 dark:border-white/5 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-dark-900 dark:text-white">Change Password</h3>
                            <button onClick={() => setShowPasswordModal(false)} className="text-dark-400 hover:text-dark-900 dark:hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Current Password</label>
                                <input
                                    type="password"
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-dark-100 dark:border-white/5 flex gap-3">
                            <Button variant="ghost" className="flex-1" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleChangePassword}>Change Password</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Phone Change Modal */}
            {showPhoneModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <Card className="w-full max-w-md bg-white dark:bg-dark-900">
                        <div className="p-6 border-b border-dark-100 dark:border-white/5 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-dark-900 dark:text-white">Change Phone Number</h3>
                            <button onClick={() => { setShowPhoneModal(false); setOtpSent(false); }} className="text-dark-400 hover:text-dark-900 dark:hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">New Phone Number</label>
                                <input
                                    type="tel"
                                    value={newPhone}
                                    onChange={(e) => setNewPhone(e.target.value)}
                                    placeholder="+93700000000"
                                    disabled={otpSent}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            </div>
                            {otpSent && (
                                <div>
                                    <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Enter OTP</label>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        placeholder="123456"
                                        maxLength={6}
                                        className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-dark-100 dark:border-white/5 flex gap-3">
                            <Button variant="ghost" className="flex-1" onClick={() => { setShowPhoneModal(false); setOtpSent(false); }}>Cancel</Button>
                            {!otpSent ? (
                                <Button className="flex-1" onClick={handleSendOTP}>Send OTP</Button>
                            ) : (
                                <Button className="flex-1" onClick={handleVerifyAndChangePhone}>Verify & Change</Button>
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
