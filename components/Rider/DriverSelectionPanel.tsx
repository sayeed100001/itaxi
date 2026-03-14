import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Car, Star, Check, Search, X } from 'lucide-react';
import { useAppStore } from '../../store';
import { Location, ServiceType, Ride } from '../../types';
import { useI18n } from '../../services/useI18n';

interface DriverSelectionPanelProps {
    currentRoute: any;
    destCoords: Location | null;
    pickupCoords: Location | null;
    userLocation: Location;
    filteredDrivers: any[];
    selectedService: ServiceType;
    destination: string;
    scheduledTime?: string;
    proposedFare?: string;
    setViewState: (state: any) => void;
    addToast: (type: string, msg: string) => void;
}

export const DriverSelectionPanel: React.FC<DriverSelectionPanelProps> = ({
    currentRoute, destCoords, pickupCoords, userLocation, filteredDrivers,
    selectedService, destination, scheduledTime, proposedFare, setViewState, addToast
}) => {
    const { t, tx } = useI18n();
    const user = useAppStore(state => state.user);
    const createRide = useAppStore(state => state.createRide);
    const selectedTaxiType = useAppStore(state => state.selectedTaxiType);
    const radiusKm = Math.max(1, Number(useAppStore(state => state.adminSettings?.system?.radiusLimit)) || 15);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDriverId, setSelectedDriverId] = useState<string>('');

    if (!currentRoute || !destCoords) return null;

    const distKm = currentRoute.distance / 1000;
    const durMin = currentRoute.duration / 60;
    const parsedFare = typeof proposedFare === 'string' && proposedFare.trim() ? Number(proposedFare) : NaN;
    const fareOffer = (Number.isFinite(parsedFare) && parsedFare > 0)
        ? Math.round(parsedFare)
        : Math.max(50, Math.round(distKm * 20 + 40));

    // Filter and sort drivers by distance
    const availableDrivers = filteredDrivers
        .filter(d => d.status === 'available')
        .map(driver => {
            const pickup = pickupCoords || userLocation;
            const distance = Math.sqrt(
                Math.pow(pickup.lat - driver.location.lat, 2) +
                Math.pow(pickup.lng - driver.location.lng, 2)
            ) * 111; // Convert to km

            return { ...driver, distanceKm: distance };
        })
        .filter(d => d.distanceKm <= radiusKm) // Within configured radius
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .filter(driver =>
            searchTerm === '' ||
            driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            driver.vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
            driver.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
        );

    const handleDriverSelect = (driverId: string) => {
        setSelectedDriverId(driverId);
    };

    const handleRequestWithDriver = async () => {
        if (!selectedDriverId) {
            addToast('error', t.rider.driver_selection.toast_select_driver_first);
            return;
        }

        if (!user?.id) {
            addToast('error', t.rider.driver_selection.toast_not_authenticated);
            return;
        }

        const finalPickup = pickupCoords || userLocation;

        const rideData = {
            riderId: user.id,
            pickup: 'Current Location',
            destination: destination || "Selected Location",
            pickupLoc: { lat: finalPickup.lat, lng: finalPickup.lng },
            destLoc: { lat: destCoords.lat, lng: destCoords.lng },
            serviceType: selectedService,
            taxiTypeId: selectedTaxiType?.id || undefined,
            route: currentRoute,
            proposedFare: fareOffer,
            preferredDriverId: selectedDriverId,
            scheduledTime: scheduledTime || undefined,
            notes: `Requested driver: ${availableDrivers.find(d => d.id === selectedDriverId)?.name}`
        };

        try {
            await createRide(rideData);
            setViewState('tracking');
            addToast('success', t.rider.driver_selection.toast_requested_success);
        } catch (error) {
            addToast('error', t.rider.driver_selection.toast_requested_failed);
        }
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white/98 dark:bg-zinc-950/98 backdrop-blur-2xl rounded-t-[40px] shadow-[0_-12px_40px_rgba(0,0,0,0.15)] z-[60] animate-slide-up flex flex-col max-h-[90vh] ring-1 ring-black/5">
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="font-display font-black text-2xl text-zinc-900 dark:text-white">{t.rider.driver_selection.title}</h3>
                        <p className="text-sm text-zinc-500">{t.rider.driver_selection.subtitle}</p>
                    </div>
                    <button onClick={() => setViewState('compare')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                        <X size={24} className="text-zinc-500" />
                    </button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                    <input
                        type="text"
                        placeholder={t.rider.driver_selection.search_placeholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Driver List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {availableDrivers.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                            <Car size={32} className="text-zinc-400" />
                        </div>
                        <p className="text-zinc-500 font-medium">{t.rider.driver_selection.empty}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {availableDrivers.map((driver) => (
                            <div
                                key={driver.id}
                                onClick={() => handleDriverSelect(driver.id)}
                                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedDriverId === driver.id
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                                        <img
                                            src={`https://ui-avatars.com/api/?name=${driver.name}&background=random`}
                                            alt={driver.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-zinc-900 dark:text-white">{driver.name}</h4>
                                            <div className="flex items-center gap-1">
                                                <Star size={14} className="text-yellow-400 fill-yellow-400" />
                                                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                                    {(() => {
                                                        const r = Number(driver.rating);
                                                        const safe = Number.isFinite(r) ? r : 4.8;
                                                        return safe.toFixed(1);
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-zinc-500">
                                            <span>{driver.vehicle}</span>
                                            <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{driver.licensePlate}</span>
                                            <span>{tx('rider.driver_selection.km_away', { km: driver.distanceKm.toFixed(1) })}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-zinc-900 dark:text-white">
                                            ؋{fareOffer}
                                        </div>
                                        <div className="text-xs text-zinc-500">
                                            {tx('rider.driver_selection.min', { min: Math.max(2, Math.round(driver.distanceKm * 2)) })}
                                        </div>
                                    </div>
                                    {selectedDriverId === driver.id && (
                                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                                            <Check size={16} className="text-white" strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom Action */}
            {selectedDriverId && (
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
                    <Button
                        size="lg"
                        className="w-full h-14 text-lg font-bold rounded-2xl"
                        onClick={handleRequestWithDriver}
                    >
                        {tx('rider.driver_selection.request_with', { name: availableDrivers.find(d => d.id === selectedDriverId)?.name || '' })}
                    </Button>
                </div>
            )}
        </div>
    );
};
