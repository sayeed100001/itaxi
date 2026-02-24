import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { User, Car, FileText, Upload, CheckCircle, XCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { API_BASE } from '../../config';
import { useAppStore } from '../../store';

interface DriverProfile {
    id: string;
    userId: string;
    vehicleType: string;
    plateNumber: string;
    city: string;
    province: string;
    whatsappNumber?: string;
    status: string;
    verified: boolean;
    user: {
        id: string;
        name: string;
        phone: string;
        email?: string;
        city: string;
        province: string;
    };
    documents: DriverDocument[];
}

interface DriverDocument {
    id: string;
    type: string;
    fileName: string;
    fileUrl: string;
    status: string;
    expiryDate?: string;
    notes?: string;
    reviewNotes?: string;
    createdAt: string;
}

const DOCUMENT_TYPES = [
    { value: 'DRIVERS_LICENSE', label: 'Driver\'s License' },
    { value: 'VEHICLE_REGISTRATION', label: 'Vehicle Registration' },
    { value: 'INSURANCE', label: 'Insurance Certificate' },
    { value: 'VEHICLE_INSPECTION', label: 'Vehicle Inspection' },
    { value: 'PROFILE_PHOTO', label: 'Profile Photo' },
    { value: 'VEHICLE_PHOTO', label: 'Vehicle Photo' },
    { value: 'OTHER', label: 'Other Document' },
];

export const DriverProfilePage: React.FC = () => {
    const { addToast, user } = useAppStore();
    const [profile, setProfile] = useState<DriverProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'profile' | 'vehicle' | 'documents'>('profile');
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [uploadModal, setUploadModal] = useState(false);
    const [uploadForm, setUploadForm] = useState({
        type: 'DRIVERS_LICENSE',
        fileName: '',
        fileUrl: '',
        expiryDate: '',
        notes: '',
    });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/drivers/profile`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });

            const data = await response.json();
            if (data.success) {
                setProfile(data.data);
                setEditForm({
                    name: data.data.user.name,
                    email: data.data.user.email || '',
                    city: data.data.city || '',
                    province: data.data.province || '',
                    vehicleType: data.data.vehicleType,
                    plateNumber: data.data.plateNumber,
                    whatsappNumber: data.data.whatsappNumber || '',
                });
            } else {
                addToast('error', data.message || 'Failed to load profile');
            }
        } catch (error) {
            addToast('error', 'Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/drivers/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(editForm),
            });

            const data = await response.json();
            if (data.success) {
                setProfile(data.data);
                setIsEditing(false);
                addToast('success', 'Profile updated successfully');
            } else {
                addToast('error', data.message || 'Failed to update profile');
            }
        } catch (error) {
            addToast('error', 'Failed to update profile');
        }
    };

    const handleUploadDocument = async () => {
        if (!uploadForm.fileName || !uploadForm.fileUrl) {
            addToast('error', 'Please provide file name and URL');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/drivers/documents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(uploadForm),
            });

            const data = await response.json();
            if (data.success) {
                addToast('success', 'Document uploaded successfully');
                setUploadModal(false);
                setUploadForm({
                    type: 'DRIVERS_LICENSE',
                    fileName: '',
                    fileUrl: '',
                    expiryDate: '',
                    notes: '',
                });
                fetchProfile();
            } else {
                addToast('error', data.message || 'Failed to upload document');
            }
        } catch (error) {
            addToast('error', 'Failed to upload document');
        }
    };

    const handleDeleteDocument = async (documentId: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE}/drivers/documents/${documentId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });

            const data = await response.json();
            if (data.success) {
                addToast('success', 'Document deleted successfully');
                fetchProfile();
            } else {
                addToast('error', data.message || 'Failed to delete document');
            }
        } catch (error) {
            addToast('error', 'Failed to delete document');
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
            APPROVED: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
            REJECTED: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
        };
        const icons = {
            PENDING: <Clock size={14} />,
            APPROVED: <CheckCircle size={14} />,
            REJECTED: <XCircle size={14} />,
        };
        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${styles[status as keyof typeof styles]}`}>
                {icons[status as keyof typeof icons]}
                {status}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="p-6 h-full flex items-center justify-center">
                <div className="text-dark-500">Loading profile...</div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="p-6 h-full flex flex-col items-center justify-center">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">🚗</div>
                    <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">Driver Profile Not Found</h2>
                    <p className="text-dark-500 dark:text-dark-400 mb-4">
                        {user?.role === 'ADMIN' 
                            ? 'You are viewing as admin. Driver profiles are only available for registered drivers.'
                            : 'No driver profile found. Please contact support to register as a driver.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 pb-24">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-dark-900 dark:text-white">My Profile</h1>
                <p className="text-dark-500 dark:text-dark-400">Manage your profile, vehicle, and documents</p>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-dark-200 dark:border-white/10">
                {[
                    { id: 'profile', label: 'Personal Info', icon: <User size={18} /> },
                    { id: 'vehicle', label: 'Vehicle & Docs', icon: <Car size={18} /> },
                    { id: 'documents', label: 'Documents', icon: <FileText size={18} /> },
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

            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <Card className="p-6 bg-white dark:bg-dark-900">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-dark-900 dark:text-white">Personal Information</h2>
                        {!isEditing ? (
                            <Button size="sm" onClick={() => setIsEditing(true)}>Edit Profile</Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleSaveProfile}>Save Changes</Button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Full Name</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            ) : (
                                <div className="text-dark-900 dark:text-white font-medium">{profile.user.name}</div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Phone Number</label>
                            <div className="text-dark-900 dark:text-white font-medium">{profile.user.phone}</div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Email</label>
                            {isEditing ? (
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            ) : (
                                <div className="text-dark-900 dark:text-white font-medium">{profile.user.email || 'Not provided'}</div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">WhatsApp Number</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editForm.whatsappNumber}
                                    onChange={(e) => setEditForm({ ...editForm, whatsappNumber: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            ) : (
                                <div className="text-dark-900 dark:text-white font-medium">{profile.whatsappNumber || 'Not provided'}</div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">City</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editForm.city}
                                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            ) : (
                                <div className="text-dark-900 dark:text-white font-medium">{profile.city || 'Not provided'}</div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Province</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editForm.province}
                                    onChange={(e) => setEditForm({ ...editForm, province: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            ) : (
                                <div className="text-dark-900 dark:text-white font-medium">{profile.province || 'Not provided'}</div>
                            )}
                        </div>
                    </div>
                </Card>
            )}

            {/* Vehicle Tab */}
            {activeTab === 'vehicle' && (
                <Card className="p-6 bg-white dark:bg-dark-900">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-dark-900 dark:text-white">Vehicle Information</h2>
                        {!isEditing ? (
                            <Button size="sm" onClick={() => setIsEditing(true)}>Edit Vehicle</Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleSaveProfile}>Save Changes</Button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Vehicle Type</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editForm.vehicleType}
                                    onChange={(e) => setEditForm({ ...editForm, vehicleType: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                    placeholder="e.g., Toyota Corolla"
                                />
                            ) : (
                                <div className="text-dark-900 dark:text-white font-medium">{profile.vehicleType}</div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Plate Number</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editForm.plateNumber}
                                    onChange={(e) => setEditForm({ ...editForm, plateNumber: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm font-mono"
                                    placeholder="e.g., KBL-1234"
                                />
                            ) : (
                                <div className="text-dark-900 dark:text-white font-medium font-mono">{profile.plateNumber}</div>
                            )}
                        </div>

                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Verification Status</label>
                            <div>
                                {profile.verified ? (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400">
                                        <CheckCircle size={14} />
                                        Verified
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400">
                                        <AlertCircle size={14} />
                                        Pending Verification
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Account Status</label>
                            <div className="text-dark-900 dark:text-white font-medium capitalize">{profile.status}</div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
                <div className="space-y-6">
                    <Card className="p-6 bg-white dark:bg-dark-900">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-dark-900 dark:text-white">My Documents</h2>
                            <Button size="sm" icon={<Upload size={16} />} onClick={() => setUploadModal(true)}>
                                Upload Document
                            </Button>
                        </div>

                        {profile.documents.length === 0 ? (
                            <div className="text-center py-12 text-dark-500">
                                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                                <p>No documents uploaded yet</p>
                                <Button size="sm" className="mt-4" onClick={() => setUploadModal(true)}>
                                    Upload Your First Document
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {profile.documents.map((doc) => (
                                    <Card key={doc.id} className="p-4 bg-dark-50 dark:bg-white/5 border-dark-200 dark:border-white/10">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                                                    <FileText size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-dark-900 dark:text-white text-sm">{doc.fileName}</div>
                                                    <div className="text-xs text-dark-500">{DOCUMENT_TYPES.find(t => t.value === doc.type)?.label}</div>
                                                </div>
                                            </div>
                                            {getStatusBadge(doc.status)}
                                        </div>

                                        {doc.expiryDate && (
                                            <div className="text-xs text-dark-500 mb-2">
                                                Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                                            </div>
                                        )}

                                        {doc.reviewNotes && (
                                            <div className="text-xs bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 p-2 rounded-lg mb-2">
                                                <strong>Admin Note:</strong> {doc.reviewNotes}
                                            </div>
                                        )}

                                        <div className="flex gap-2 mt-3">
                                            <Button size="sm" variant="secondary" className="flex-1" onClick={() => window.open(doc.fileUrl, '_blank')}>
                                                View
                                            </Button>
                                            <Button size="sm" variant="secondary" className="text-red-600" onClick={() => handleDeleteDocument(doc.id)}>
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* Upload Modal */}
            {uploadModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <Card className="w-full max-w-md bg-white dark:bg-dark-900">
                        <div className="p-6 border-b border-dark-100 dark:border-white/5">
                            <h3 className="text-xl font-bold text-dark-900 dark:text-white">Upload Document</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Document Type</label>
                                <select
                                    value={uploadForm.type}
                                    onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                >
                                    {DOCUMENT_TYPES.map((type) => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">File Name</label>
                                <input
                                    type="text"
                                    value={uploadForm.fileName}
                                    onChange={(e) => setUploadForm({ ...uploadForm, fileName: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                    placeholder="e.g., License_Front.jpg"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">File URL</label>
                                <input
                                    type="text"
                                    value={uploadForm.fileUrl}
                                    onChange={(e) => setUploadForm({ ...uploadForm, fileUrl: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                    placeholder="https://..."
                                />
                                <p className="text-xs text-dark-500 mt-1">Upload file to cloud storage and paste URL here</p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Expiry Date (Optional)</label>
                                <input
                                    type="date"
                                    value={uploadForm.expiryDate}
                                    onChange={(e) => setUploadForm({ ...uploadForm, expiryDate: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2 block">Notes (Optional)</label>
                                <textarea
                                    value={uploadForm.notes}
                                    onChange={(e) => setUploadForm({ ...uploadForm, notes: e.target.value })}
                                    className="w-full p-3 bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl text-sm"
                                    rows={3}
                                    placeholder="Additional information..."
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-dark-100 dark:border-white/5 flex gap-3">
                            <Button variant="ghost" className="flex-1" onClick={() => setUploadModal(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleUploadDocument}>Upload</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
