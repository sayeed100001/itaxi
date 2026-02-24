
import React, { useState, useEffect } from 'react';
import { MapBackground } from '../../components/Map/MapBackground';
import { Button } from '../../components/ui/Button';
import { useAppStore } from '../../store';
import { Power, Settings, Navigation, CheckCircle, XCircle, MapPin, Clock, ArrowRight, Flag, MessageCircle, Phone } from 'lucide-react';
import { socketService } from '../../services/socket';
import { Ride, RouteData } from '../../types';
import { RoutingManager } from '../../services/routing/RoutingManager';

export const DriverHome: React.FC = () => {
    const { activeRide, startRide, updateRideStatus, completeRide, registerDriver, userLocation, openChat, transactions, adminSettings, user, addToast, setView } = useAppStore();
    const [isOnline, setIsOnline] = useState(false);
    const [pricing, setPricing] = useState({ base: 50, perKm: 20 });
    const [showSettings, setShowSettings] = useState(false);
    const [incomingRequest, setIncomingRequest] = useState<Ride | null>(null);
    const [pickupRoute, setPickupRoute] = useState<RouteData | null>(null);
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [riderPhone, setRiderPhone] = useState<string>('');
    const [showPhoneFallback, setShowPhoneFallback] = useState(false);
    const [incomingIsOffer, setIncomingIsOffer] = useState(false);
    const [creditStatus, setCreditStatus] = useState<{
        creditBalance: number;
        creditExpiresAt: string | null;
        monthlyPackage?: string | null;
        active: boolean;
    } | null>(null);

    // Calculate today's earnings
    const todayEarnings = transactions
        .filter(t => t.type === 'credit' && t.status === 'completed' && new Date(t.date).toDateString() === new Date().toDateString())
        .reduce((acc, curr) => acc + curr.amount, 0);

    // Toggle Online/Offline State
    useEffect(() => {
        if (isOnline) {
            registerDriver({
                id: user?.id || 'driver',
                name: user?.name || 'Driver',
                vehicle: 'Toyota Prius',
                rating: 4.9,
                location: userLocation,
                status: 'available',
                type: 'plus',
                baseFare: pricing.base,
                perKmRate: pricing.perKm,
                eta: 1
            });

            // Listen for trip requests
            const handleIncomingTrip = (trip: any) => {
                if (!activeRide) {
                    const tripId = trip?.id || trip?.tripId;
                    const pickupLat = trip?.pickupLat ?? trip?.pickup?.lat;
                    const pickupLng = trip?.pickupLng ?? trip?.pickup?.lng;
                    const dropLat = trip?.dropLat ?? trip?.drop?.lat;
                    const dropLng = trip?.dropLng ?? trip?.drop?.lng;
                    if (!tripId || pickupLat == null || pickupLng == null || dropLat == null || dropLng == null) {
                        return;
                    }

                    const mapped: Ride = {
                        id: tripId,
                        pickup: 'Pickup',
                        destination: trip.destination || 'Destination',
                        pickupLocation: { lat: pickupLat, lng: pickupLng },
                        destinationLocation: { lat: dropLat, lng: dropLng },
                        fare: trip.fare || 0,
                        proposedFare: trip.fare || 0,
                        status: 'requested',
                        driverId: trip.driverId,
                        riderId: trip.riderId,
                        serviceType: (trip.serviceType || 'city') as any,
                        timestamp: Date.now(),
                        distance: trip.distance || 0,
                        duration: trip.duration || 0,
                        route: undefined,
                    };
                    setIncomingRequest(mapped);
                    setIncomingIsOffer(Boolean(trip?.tripId));
                }
            };
            socketService.on('trip:offer', handleIncomingTrip);
            socketService.on('trip:requested', handleIncomingTrip);

            // Start location updates every 3 seconds
            const stopLocationUpdates = socketService.startLocationUpdates(() => ({
                lat: userLocation.lat,
                lng: userLocation.lng,
                bearing: 0,
            }));

            return () => {
                stopLocationUpdates();
                socketService.off('trip:offer');
                socketService.off('trip:requested');
            };
        }
    }, [isOnline, activeRide, userLocation, pricing, registerDriver, user]);

    useEffect(() => {
        const loadCreditStatus = async () => {
            if (user?.role !== 'DRIVER') return;
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const response = await fetch('/api/drivers/credit-status', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await response.json();
                if (!response.ok || !data.success) return;
                setCreditStatus(data.data);
            } catch {
                // keep silent, status badge will stay hidden
            }
        };

        loadCreditStatus();
        const interval = setInterval(loadCreditStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    // Calculate route to pickup when accepted
    useEffect(() => {
        const calculatePickupRoute = async () => {
            if (activeRide?.status === 'accepted') {
                try {
                    // Route from Driver Current Loc to Pickup
                    const route = await RoutingManager.getRoute(userLocation, activeRide.pickupLocation, adminSettings);
                    setPickupRoute(route);
                } catch (e) {
                    console.error("Failed to calc pickup route", e);
                }
            } else {
                setPickupRoute(null);
            }
        };
        calculatePickupRoute();
    }, [activeRide?.status]);

    const handleAccept = () => {
        if (incomingRequest) {
            if (incomingIsOffer) {
                socketService.acceptOffer(incomingRequest.id);
            } else {
                socketService.acceptTrip(incomingRequest.id);
            }
            startRide({ ...incomingRequest, status: 'accepted' });
            setIncomingRequest(null);
            setIncomingIsOffer(false);
        }
    };

    const handleReject = () => {
        setIncomingRequest(null);
        setIncomingIsOffer(false);
    };

    const handleStatusUpdate = (newStatus: Ride['status']) => {
        if (!activeRide) return;

        if (newStatus === 'arrived') {
            socketService.arrivedAtPickup(activeRide.id);
        } else if (newStatus === 'in_progress') {
            socketService.startTrip(activeRide.id);
        } else if (newStatus === 'completed') {
            socketService.completeTrip(activeRide.id);
            // Settle trip on backend (cash by default)
            fetch(`/api/trips/${activeRide.id}/settle`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            }).catch(() => {
                // Backend will still have trip completed; wallet/cash status may need manual reconciliation
            });
            completeRide();
            return;
        }

        updateRideStatus(newStatus);
    };

    const handleContactRider = () => {
        if (activeRide) {
            openChat(activeRide.riderId, 'Rider', 'Rider', activeRide.id);
        }
    };

    const handleWhatsAppChat = () => {
        if (activeRide) {
            openChat(activeRide.riderId, 'Rider', 'Rider', activeRide.id);
            setShowWhatsAppModal(false);
        }
    };

    const handleWhatsAppCall = async () => {
        if (riderPhone && activeRide) {
            try {
                await fetch('/api/trips/log-communication', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: JSON.stringify({ tripId: activeRide.id, type: 'CALL' }),
                });
            } catch (error) {
                console.error('Failed to log call', error);
            }

            const link = `https://wa.me/${riderPhone.replace(/[^0-9]/g, '')}`;
            const newWindow = window.open(link, '_blank');

            if (!newWindow) {
                setShowPhoneFallback(true);
            }
        }
    };

    const handlePhoneCall = () => {
        if (riderPhone) {
            window.location.href = `tel:${riderPhone}`;
            setShowPhoneFallback(false);
        }
    };

    // Fetch rider phone when trip is active
    useEffect(() => {
        const fetchRiderPhone = async () => {
            if (activeRide?.riderId) {
                try {
                    const response = await fetch(`/api/trips/${activeRide.id}`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                    });
                    const data = await response.json();
                    if (data.success && data.data.rider?.phone) {
                        setRiderPhone(data.data.rider.phone);
                    }
                } catch (error) {
                    console.error('Failed to fetch rider phone', error);
                }
            }
        };
        fetchRiderPhone();
    }, [activeRide?.riderId]);

    // Determine which route to show
    // If Accepted/Arrived -> Show route to Pickup (Calculated locally)
    // If In_Progress -> Show activeRide.route (Which is Pickup to Destination)
    const displayedRoute = activeRide?.status === 'in_progress' ? activeRide.route : pickupRoute;

    const toggleOnline = async () => {
        const nextOnline = !isOnline;
        if (nextOnline) {
            if (!creditStatus?.active) {
                addToast('error', 'Monthly credits are required. Please recharge credits to go online.');
                setView('wallet');
                return;
            }
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication required');
            }

            const statusResponse = await fetch('/api/drivers/status', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: nextOnline ? 'ONLINE' : 'OFFLINE' }),
            });
            const statusData = await statusResponse.json();
            if (!statusResponse.ok || !statusData.success) {
                throw new Error(statusData?.message || 'Failed to update driver status');
            }

            if (nextOnline) {
                await fetch('/api/drivers/location', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        lat: userLocation.lat,
                        lng: userLocation.lng,
                        bearing: 0,
                    }),
                }).catch(() => {
                    // Socket updates will keep location fresh even if this initial sync fails.
                });
            }

            setIsOnline(nextOnline);
        } catch (error: any) {
            addToast('error', error?.message || 'Failed to change online status');
        }
    };

    return (
        <div className="relative h-full w-full">
            {/* WhatsApp Confirmation Modal */}
            {showWhatsAppModal && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-white dark:bg-dark-900 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
                        <h3 className="text-xl font-bold text-dark-900 dark:text-white mb-2">Open WhatsApp?</h3>
                        <p className="text-dark-600 dark:text-dark-400 mb-6">This will open WhatsApp to chat with the rider about this trip.</p>
                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowWhatsAppModal(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handleWhatsAppChat}>Open WhatsApp</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Phone Fallback Modal */}
            {showPhoneFallback && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-white dark:bg-dark-900 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
                        <h3 className="text-xl font-bold text-dark-900 dark:text-white mb-2">WhatsApp Not Available</h3>
                        <p className="text-dark-600 dark:text-dark-400 mb-6">Call using phone instead?</p>
                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowPhoneFallback(false)}>Cancel</Button>
                            <Button className="flex-1" onClick={handlePhoneCall}>Call Now</Button>
                        </div>
                    </div>
                </div>
            )}

            <MapBackground
                isDriverView={true}
                pickup={activeRide?.pickupLocation}
                destination={activeRide?.destinationLocation}
                route={displayedRoute}
                center={userLocation} // Follow driver
            />

            {/* Header: Status + Earnings */}
            <div className="absolute top-4 left-4 right-4 z-20 flex justify-between">
                <div className="flex gap-2">
                    <button
                        onClick={toggleOnline}
                        className={`px-4 py-2 rounded-full font-bold shadow-lg backdrop-blur-md flex items-center gap-2 transition-all ${isOnline ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                        <Power size={18} />
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </button>
                    {isOnline && (
                        <div className="px-4 py-2 rounded-full bg-white dark:bg-dark-900 shadow-lg font-bold text-dark-900 dark:text-white flex items-center gap-1">
                            <span className="text-xs text-dark-500 uppercase mr-1">Today:</span>
                            ؋{todayEarnings}
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-10 h-10 bg-white dark:bg-dark-900 rounded-full shadow-lg flex items-center justify-center text-dark-900 dark:text-white"
                >
                    <Settings size={20} />
                </button>
            </div>

            {creditStatus && (
                <div className="absolute top-20 left-4 right-4 z-20">
                    <div className={`rounded-xl px-4 py-3 shadow-lg border text-sm flex items-center justify-between ${creditStatus.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        <div>
                            <div className="font-bold">Driver Credits: {creditStatus.creditBalance}</div>
                            <div className="text-xs">
                                {creditStatus.creditExpiresAt
                                    ? `Valid until ${new Date(creditStatus.creditExpiresAt).toLocaleDateString()}`
                                    : 'No active package'}
                            </div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => setView('wallet')}>
                            Manage
                        </Button>
                    </div>
                </div>
            )}

            {/* Pricing Settings Modal */}
            {showSettings && (
                <div className="absolute top-16 right-4 w-72 bg-white dark:bg-dark-900 rounded-2xl shadow-2xl border border-dark-100 dark:border-white/10 p-5 z-20 animate-in fade-in slide-in-from-top-2">
                    <h3 className="font-bold text-dark-900 dark:text-white mb-4 text-lg">My Pricing</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-1 block">Base Fare (AFN)</label>
                            <div className="flex items-center bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl px-3">
                                <span className="font-bold text-dark-400">؋</span>
                                <input
                                    type="number"
                                    className="w-full bg-transparent p-2 text-sm font-bold text-dark-900 dark:text-white focus:outline-none"
                                    value={pricing.base}
                                    onChange={e => setPricing({ ...pricing, base: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-1 block">Per KM (AFN)</label>
                            <div className="flex items-center bg-dark-50 dark:bg-white/5 border border-dark-200 dark:border-white/10 rounded-xl px-3">
                                <span className="font-bold text-dark-400">؋</span>
                                <input
                                    type="number"
                                    className="w-full bg-transparent p-2 text-sm font-bold text-dark-900 dark:text-white focus:outline-none"
                                    value={pricing.perKm}
                                    onChange={e => setPricing({ ...pricing, perKm: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                        <Button size="sm" onClick={() => setShowSettings(false)} className="w-full mt-2">Update Rates</Button>
                    </div>
                </div>
            )}

            {/* Main Action Button (Go Online Overlay) */}
            {!isOnline && !activeRide && (
                <div className="absolute inset-0 z-10 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center">
                    <button
                        onClick={toggleOnline}
                        className="w-32 h-32 rounded-full bg-brand-600 border-4 border-brand-200/50 shadow-[0_0_50px_rgba(37,99,235,0.6)] flex flex-col items-center justify-center text-white font-bold hover:scale-105 transition-transform"
                    >
                        <span className="text-2xl">GO</span>
                        <span className="text-xs opacity-80">ONLINE</span>
                    </button>
                </div>
            )}

            {/* Incoming Request Overlay */}
            {incomingRequest && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
                    <div className="w-full max-w-md bg-white dark:bg-dark-900 rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-20 border border-white/10 relative overflow-hidden">
                        <div className="absolute top-0 left-0 h-1 bg-brand-500 animate-[width_20s_linear_forwards] w-full" style={{ width: '0%' }}></div>

                        <div className="text-center mb-6 pt-2">
                            <div className="inline-block bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 px-4 py-1.5 rounded-full text-xs font-extrabold tracking-wider mb-3">NEW REQUEST</div>
                            <div className="text-5xl font-black text-dark-900 dark:text-white mb-1">؋{incomingRequest.fare}</div>
                            <div className="flex items-center justify-center gap-2 text-sm text-dark-500">
                                <span className="font-bold">{(incomingRequest.distance / 1000).toFixed(1)} km</span> • <span className="capitalize">{incomingRequest.serviceType}</span>
                            </div>
                        </div>

                        <div className="space-y-3 mb-8">
                            <div className="flex items-start gap-4 p-4 bg-dark-50 dark:bg-white/5 rounded-2xl border border-dark-100 dark:border-white/5">
                                <div className="mt-1 w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
                                    <MapPin size={16} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-dark-400 uppercase tracking-wider mb-0.5">Pickup</div>
                                    <div className="font-bold text-dark-900 dark:text-white leading-tight">Current Location</div>
                                    <div className="text-xs text-dark-500 mt-1 flex items-center gap-1"><Clock size={10} /> 3 mins away</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 p-4 bg-dark-50 dark:bg-white/5 rounded-2xl border border-dark-100 dark:border-white/5">
                                <div className="mt-1 w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                                    <MapPin size={16} />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-dark-400 uppercase tracking-wider mb-0.5">Dropoff</div>
                                    <div className="font-bold text-dark-900 dark:text-white leading-tight">{incomingRequest.destination}</div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Button variant="secondary" className="h-14 text-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20 hover:bg-red-100" onClick={handleReject} icon={<XCircle size={20} />}>Reject</Button>
                            <Button className="h-14 text-lg bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/25 border-transparent" onClick={handleAccept} icon={<CheckCircle size={20} />}>Accept</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Ride Controls */}
            {activeRide && (
                <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-dark-900 p-6 pb-24 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] z-20 animate-in slide-in-from-bottom-20">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="font-bold text-xl text-dark-900 dark:text-white mb-1">
                                {activeRide.status === 'accepted' ? 'Picking up Rider' :
                                    activeRide.status === 'arrived' ? 'Waiting for Rider' :
                                        activeRide.status === 'in_progress' ? 'Driving to Destination' : 'Trip'}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-dark-500">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                {activeRide.status === 'in_progress' ? 'En Route' : 'Navigating'}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="secondary" icon={<MessageCircle size={16} />} onClick={handleContactRider}>Chat</Button>
                            <Button size="sm" variant="secondary" icon={<Phone size={16} />} onClick={handleWhatsAppCall}>Call</Button>
                        </div>
                    </div>

                    {(activeRide.status === 'accepted' || activeRide.status === 'arrived') && riderPhone && (
                        <Button
                            variant="secondary"
                            className="w-full mb-4"
                            icon={<MessageCircle size={18} />}
                            onClick={() => setShowWhatsAppModal(true)}
                        >
                            Chat via WhatsApp
                        </Button>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                        {activeRide.status === 'accepted' && (
                            <Button
                                className="h-14 text-lg w-full bg-brand-600 text-white"
                                onClick={() => handleStatusUpdate('arrived')}
                                icon={<MapPin size={20} />}
                            >
                                Arrived at Pickup
                            </Button>
                        )}

                        {activeRide.status === 'arrived' && (
                            <Button
                                className="h-14 text-lg w-full bg-green-600 text-white"
                                onClick={() => handleStatusUpdate('in_progress')}
                                icon={<ArrowRight size={20} />}
                            >
                                Start Trip
                            </Button>
                        )}

                        {activeRide.status === 'in_progress' && (
                            <Button
                                className="h-14 text-lg w-full bg-red-600 text-white"
                                onClick={() => handleStatusUpdate('completed')}
                                icon={<Flag size={20} />}
                            >
                                Complete Trip
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
