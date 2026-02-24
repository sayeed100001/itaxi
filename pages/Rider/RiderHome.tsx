
import React, { useState, useEffect, useCallback } from 'react';
import { MapBackground } from '../../components/Map/MapBackground';
import { Button } from '../../components/ui/Button';
import { MapPin, Navigation, Car, Building, Plane, Clock, User, MessageCircle, Phone, X, Star, Flag, ArrowLeft, Shield, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store';
import { Ride, ServiceType, Hotel, Location, DriverMarker } from '../../types';
import { RoutingManager } from '../../services/routing/RoutingManager';
import { socketService } from '../../services/socket';

export const RiderHome: React.FC = () => {
    const { activeRide, startRide, updateRideStatus, addToast, userLocation, drivers, hotels, adminSettings, setRoute, currentRoute, openChat, updateDrivers, updateDriver } = useAppStore();

    // View States
    const [viewState, setViewState] = useState<'grid' | 'selecting' | 'confirm_pickup' | 'drivers' | 'negotiating' | 'tracking'>('grid');
    const [selectedService, setSelectedService] = useState<ServiceType>('city');

    // Selection Data
    const [mapCenter, setMapCenter] = useState<Location>(userLocation);
    const [destination, setDestination] = useState<string>('');
    const [destCoords, setDestCoords] = useState<Location | null>(null);
    const [pickupCoords, setPickupCoords] = useState<Location | null>(null);

    // Request Data
    const [proposedFare, setProposedFare] = useState<string>('');
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
    const [scheduledFor, setScheduledFor] = useState<string>('');
    const [serviceClass, setServiceClass] = useState<'standard' | 'comfort' | 'premium' | 'xl'>('standard');
    const [requestForEnabled, setRequestForEnabled] = useState(false);
    const [requestForName, setRequestForName] = useState('');
    const [requestForPhone, setRequestForPhone] = useState('');
    const [extraStops, setExtraStops] = useState<Array<{ lat: number; lng: number; label?: string }>>([]);

    // Dynamic Data
    const [etaText, setEtaText] = useState('12 min');
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [distanceInfo, setDistanceInfo] = useState<{ distanceKm: number; etaMinutes: number } | null>(null);
    const [showPhoneFallback, setShowPhoneFallback] = useState(false);
    const [showSOSConfirm, setShowSOSConfirm] = useState(false);
    const [sosTriggered, setSosTriggered] = useState(false);

    // Search Data
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // Track if we've done the initial center
    const [hasInitialCentered, setHasInitialCentered] = useState(false);

    // Initial map sync - only run once when we get a valid location
    useEffect(() => {
        if (!hasInitialCentered && userLocation.lat !== 0) {
            setMapCenter(userLocation);
            setHasInitialCentered(true);
        }
    }, [userLocation, hasInitialCentered]);

    // Keep nearby drivers list synced from backend socket feed
    useEffect(() => {
        const mapDriverStatus = (status: string): DriverMarker['status'] => {
            if (status === 'ONLINE') return 'available';
            if (status === 'BUSY') return 'busy';
            return 'offline';
        };

        const mapServiceTier = (baseFare: number): DriverMarker['type'] => {
            if (baseFare >= 100) return 'lux';
            if (baseFare >= 60) return 'plus';
            return 'eco';
        };

        const handleNearbyDrivers = (payload: any[]) => {
            if (!Array.isArray(payload)) return;

            const mapped: DriverMarker[] = payload
                .filter((driver: any) => driver?.id && driver?.location?.lat != null && driver?.location?.lng != null)
                .map((driver: any) => ({
                    id: driver.id,
                    name: driver.user?.name || 'Driver',
                    vehicle: driver.vehicleType || 'Vehicle',
                    rating: Number(driver.rating || 5),
                    location: {
                        lat: Number(driver.location.lat),
                        lng: Number(driver.location.lng),
                    },
                    status: mapDriverStatus(String(driver.status || 'OFFLINE')),
                    baseFare: Number(driver.baseFare || adminSettings.pricing.minFare || 50),
                    perKmRate: Number(driver.perKmRate || 20),
                    type: mapServiceTier(Number(driver.baseFare || adminSettings.pricing.minFare || 50)),
                    phone: driver.user?.phone,
                    email: driver.user?.email,
                    licensePlate: driver.plateNumber,
                }));

            updateDrivers(mapped);
        };

        const handleDriverLocationUpdate = (payload: { driverId: string; lat: number; lng: number; bearing?: number }) => {
            if (!payload?.driverId || payload?.lat == null || payload?.lng == null) return;
            updateDriver(payload.driverId, {
                location: {
                    lat: payload.lat,
                    lng: payload.lng,
                    bearing: payload.bearing,
                },
            });
        };

        socketService.on('rider:nearby_drivers', handleNearbyDrivers);
        socketService.on('driver:location:update', handleDriverLocationUpdate);

        return () => {
            socketService.off('rider:nearby_drivers', handleNearbyDrivers);
            socketService.off('driver:location:update', handleDriverLocationUpdate);
        };
    }, [adminSettings.pricing.minFare, updateDriver, updateDrivers]);

    // Request nearby drivers when rider enters destination/driver selection flow.
    useEffect(() => {
        if (viewState !== 'selecting' && viewState !== 'drivers') return;
        const origin = pickupCoords || userLocation;
        socketService.getNearbyDrivers(origin.lat, origin.lng, adminSettings.system.radiusLimit);
    }, [viewState, pickupCoords, userLocation, adminSettings.system.radiusLimit]);

    // Listen for distance updates from socket
    useEffect(() => {
        const handleDistanceUpdate = (data: { tripId: string; distanceKm: number; etaMinutes: number; status: string }) => {
            if (activeRide && data.tripId === activeRide.id) {
                setDistanceInfo({ distanceKm: data.distanceKm, etaMinutes: data.etaMinutes });

                if (data.distanceKm < 0.05 && data.status === 'ARRIVED') {
                    updateRideStatus('arrived');
                }
            }
        };

        socketService.on('trip:distance_update', handleDistanceUpdate);
        return () => socketService.off('trip:distance_update', handleDistanceUpdate);
    }, [activeRide]);

    // Update ETA based on driver location
    useEffect(() => {
        if (activeRide && activeRide.driverId) {
            const driver = drivers.find(d => d.id === activeRide.driverId);
            if (driver) {
                // Estimate ETA from live driver coordinates.
                const target = activeRide.status === 'in_progress' ? activeRide.destinationLocation : activeRide.pickupLocation;
                const dist = Math.sqrt(Math.pow(target.lat - driver.location.lat, 2) + Math.pow(target.lng - driver.location.lng, 2));
                // Approx conversion: 0.01 deg ~= 1km. 50km/h => 0.83 km/min.
                const km = dist * 100;
                const mins = Math.max(1, Math.round(km / 0.8));

                if (activeRide.status === 'arrived') {
                    setEtaText('Here');
                } else {
                    setEtaText(`${mins} min`);
                }
            }
        }
    }, [drivers, activeRide]);

    // Handle Hotel Selection from Map Popup
    useEffect(() => {
        const handleHotelSelect = (e: any) => {
            const hotel = e.detail as Hotel;
            setDestination(hotel.name);
            setDestCoords(hotel.location);
            setViewState('selecting');
            // Add slight delay to allow map to settle before route calculation visual
            setTimeout(() => handleSetDestination(hotel.location, hotel.name), 200);
        };
        window.addEventListener('select-hotel', handleHotelSelect);
        return () => window.removeEventListener('select-hotel', handleHotelSelect);
    }, []);

    // Perform Search against backend Places API
    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([]);
            return;
        }

        const debounce = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await fetch(`/api/places/search?q=${encodeURIComponent(searchQuery)}`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                const data = await response.json();
                if (data.success) {
                    setSearchResults(data.data);
                }
            } catch (error) {
                console.error('Search failed', error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(debounce);
    }, [searchQuery]);

    // --- Actions ---

    const handleServiceSelect = (service: ServiceType) => {
        setSelectedService(service);
        if (service === 'hotel') {
            setViewState('selecting');
        } else {
            setViewState('selecting');
            setMapCenter(userLocation);
        }
    };

    const handleCameraChange = useCallback((center: Location) => {
        setMapCenter(center);
    }, []);

    const handleSetDestination = async (coords: Location, name: string) => {
        setDestCoords(coords);
        setDestination(name);

        try {
            const pickup = pickupCoords || userLocation;

            const routeData = await RoutingManager.getRoute(pickup, coords, adminSettings);
            setRoute(routeData);
            setViewState('drivers');

            // Auto-calculate suggested fare
            const distKm = routeData.distance / 1000;
            const suggested = Math.round(distKm * 20 + adminSettings.pricing.minFare);
            setProposedFare(suggested.toString());
        } catch (error) {
            addToast('error', "Could not calculate route.");
        }
    };

    const handleConfirmSelection = () => {
        if (viewState === 'selecting') {
            handleSetDestination(mapCenter, "Pinned Location");
        }
    };

    const handleSelectDriver = (driverId: string, baseFare: number) => {
        setSelectedDriverId(driverId);
        setProposedFare(Math.max(parseInt(proposedFare) || 0, baseFare).toString());
    };

    const addCurrentPinAsStop = () => {
        if (extraStops.length >= 2) {
            addToast('warning', 'Maximum 2 extra stops allowed');
            return;
        }

        setExtraStops((prev) => [
            ...prev,
            {
                lat: mapCenter.lat,
                lng: mapCenter.lng,
                label: `Stop ${prev.length + 1}`,
            },
        ]);
    };

    const removeStop = (index: number) => {
        setExtraStops((prev) => prev.filter((_, i) => i !== index));
    };

    const handleRequestRide = async () => {
        // Check if user is logged in
        const token = localStorage.getItem('token');
        const { user } = useAppStore.getState();
        
        if (!token || !user || !user.id) {
            addToast('error', 'Please login first');
            return;
        }

        // Allow RIDER and ADMIN roles to request rides
        if (user.role !== 'RIDER' && user.role !== 'ADMIN') {
            addToast('error', 'Only riders and admins can request rides');
            return;
        }

        // Allow request without specific driver if none available
        if (drivers.length > 0 && !selectedDriverId) {
            addToast('error', 'Please select a driver');
            return;
        }
        
        if (selectedService === 'scheduled' && !scheduledFor) {
            addToast('error', 'Please select a schedule time');
            return;
        }
        if (scheduledFor && new Date(scheduledFor).getTime() <= Date.now()) {
            addToast('error', 'Scheduled time must be in the future');
            return;
        }

        try {
            const tripData = {
                pickupLat: (pickupCoords || userLocation).lat,
                pickupLng: (pickupCoords || userLocation).lng,
                dropLat: (destCoords || mapCenter).lat,
                dropLng: (destCoords || mapCenter).lng,
                fare: parseInt(proposedFare) || adminSettings.pricing.minFare,
                distance: currentRoute?.distance || 0,
                duration: currentRoute?.duration || 0,
                serviceType: selectedService,
                serviceClass,
                womenOnly: selectedService === 'women',
                scheduledFor: scheduledFor || undefined,
                requestedFor: requestForEnabled && requestForName && requestForPhone
                    ? { name: requestForName, phone: requestForPhone }
                    : undefined,
                preferredDriverId: selectedDriverId || undefined,
                stops: extraStops.length > 0 ? extraStops : undefined,
            };

            const endpoint = selectedService === 'scheduled' ? '/api/trips/scheduled' : '/api/trips';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify(tripData),
            });

            const data = await response.json();
            if (data.success) {
                const trip = data.data;
                const ride: Ride = {
                    id: trip.id,
                    pickup: 'Pickup',
                    destination: destination || 'Destination',
                    pickupLocation: { lat: trip.pickupLat, lng: trip.pickupLng },
                    destinationLocation: { lat: trip.dropLat, lng: trip.dropLng },
                    fare: trip.fare,
                    proposedFare: parseInt(proposedFare) || trip.fare,
                    status: 'requested',
                    driverId: trip.driverId,
                    riderId: trip.riderId,
                    serviceType: selectedService,
                    serviceClass,
                    scheduledFor: scheduledFor || undefined,
                    womenOnly: selectedService === 'women',
                    requestedFor: requestForEnabled && requestForName && requestForPhone
                        ? { name: requestForName, phone: requestForPhone }
                        : undefined,
                    bookingChannel: trip.metadata?.bookingChannel || 'APP',
                    stops: extraStops.length > 0 ? extraStops : undefined,
                    timestamp: Date.now(),
                    distance: trip.distance,
                    duration: trip.duration,
                    route: currentRoute || undefined,
                };
                if (selectedService === 'scheduled') {
                    addToast('success', 'Scheduled ride created successfully');
                    resetFlow();
                } else {
                    startRide(ride);
                    setViewState('tracking');
                }
            } else {
                addToast('error', data.message || 'Failed to create trip');
            }
        } catch (error) {
            addToast('error', 'Failed to create trip');
        }
    };

    const resetFlow = () => {
        setViewState('grid');
        setDestCoords(null);
        setPickupCoords(null);
        setRoute(null);
        setDestination('');
        startRide(null);
        setSelectedDriverId(null);
        setScheduledFor('');
        setServiceClass('standard');
        setRequestForEnabled(false);
        setRequestForName('');
        setRequestForPhone('');
        setExtraStops([]);
        setMapCenter(userLocation);
    };

    const handleContactDriver = () => {
        const driver = drivers.find(d => d.id === activeRide?.driverId);
        if (driver && activeRide) {
            openChat(driver.id, driver.name, 'Driver', activeRide.id);
        }
    };

    const handleCallDriver = () => {
        addToast('info', 'Calling Driver...');
    };

    const handleWhatsAppCall = async () => {
        const driver = drivers.find(d => d.id === activeRide?.driverId);
        if (driver?.phone && activeRide) {
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

            const link = `https://wa.me/${driver.phone.replace(/[^0-9]/g, '')}`;
            const newWindow = window.open(link, '_blank');

            if (!newWindow) {
                setShowPhoneFallback(true);
            }
        }
    };

    const handlePhoneCall = () => {
        const driver = drivers.find(d => d.id === activeRide?.driverId);
        if (driver?.phone) {
            window.location.href = `tel:${driver.phone}`;
            setShowPhoneFallback(false);
        }
    };

    const handleTriggerSOS = async () => {
        if (!activeRide || sosTriggered) return;

        try {
            const response = await fetch(`/api/trips/${activeRide.id}/sos`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });

            const data = await response.json();
            if (data.success) {
                setSosTriggered(true);
                addToast('success', 'Emergency alert sent to admin');
                setShowSOSConfirm(false);
            } else {
                addToast('error', 'Failed to send emergency alert');
            }
        } catch (error) {
            addToast('error', 'Failed to send emergency alert');
        }
    };

    const handleWhatsAppChat = () => {
        const driver = drivers.find(d => d.id === activeRide?.driverId);
        if (driver && activeRide) {
            openChat(driver.id, driver.name, 'Driver', activeRide.id);
            setShowWhatsAppModal(false);
            addToast('info', 'Select WhatsApp channel in chat to send via WhatsApp.');
        }
    };

    // --- UI Components ---

    const ServiceGrid = () => (
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-dark-950 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20 animate-in slide-in-from-bottom-10 duration-300">
            <div className="p-6">
                <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-6">Where to?</h2>
                <div className="grid grid-cols-3 gap-4 mb-20 md:mb-4">
                    {[
                        { id: 'city', label: 'City Taxi', icon: <Car size={28} />, color: 'bg-blue-100 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400' },
                        { id: 'intercity', label: 'Intercity', icon: <MapPin size={28} />, color: 'bg-green-100 text-green-600 dark:bg-green-600/20 dark:text-green-400' },
                        { id: 'airport', label: 'Airport', icon: <Plane size={28} />, color: 'bg-purple-100 text-purple-600 dark:bg-purple-600/20 dark:text-purple-400' },
                        { id: 'hotel', label: 'Hotels', icon: <Building size={28} />, color: 'bg-orange-100 text-orange-600 dark:bg-orange-600/20 dark:text-orange-400' },
                        { id: 'scheduled', label: 'Schedule', icon: <Clock size={28} />, color: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400' },
                        { id: 'women', label: 'Women', icon: <User size={28} />, color: 'bg-pink-100 text-pink-600 dark:bg-pink-700/20 dark:text-pink-300' },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleServiceSelect(item.id as ServiceType)}
                            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-dark-50 dark:bg-white/5 active:scale-95 transition-transform hover:bg-dark-100 dark:hover:bg-white/10"
                        >
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${item.color}`}>
                                {item.icon}
                            </div>
                            <span className="text-xs font-bold text-dark-700 dark:text-dark-300">{item.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    const MapSelectionOverlay = () => (
        <>
            <div className="absolute top-0 left-0 right-0 z-20 flex flex-col pt-safe bg-gradient-to-b from-black/20 to-transparent">
                <div className="flex items-center gap-3 p-4">
                    <button onClick={resetFlow} className="w-10 h-10 shrink-0 rounded-full bg-white dark:bg-dark-900 shadow-lg flex items-center justify-center text-dark-900 dark:text-white">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex-1 relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500"></div>
                        <input
                            type="text"
                            placeholder={selectedService === 'hotel' ? "Search hotels..." : "Type destination (e.g. Kabul Airport, Jamhuriat Hospital)"}
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setShowResults(true);
                            }}
                            onFocus={() => setShowResults(true)}
                            autoFocus
                            className="w-full h-12 bg-white dark:bg-dark-900 rounded-xl shadow-lg pl-8 pr-10 text-dark-900 dark:text-white font-medium placeholder:text-dark-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Autocomplete Results Dropdown */}
                {showResults && searchQuery.length > 0 && (
                    <div className="mx-4 bg-white dark:bg-dark-900 rounded-xl shadow-2xl max-h-[40vh] overflow-y-auto mb-4 border border-dark-100 dark:border-white/10 relative">
                        {isSearching ? (
                            <div className="p-4 text-center text-sm text-dark-500">Searching Afghanistan data...</div>
                        ) : searchResults.length > 0 ? (
                            <div className="flex flex-col">
                                {searchResults.map((result, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setShowResults(false);
                                            setSearchQuery('');
                                            setMapCenter({ lat: result.lat, lng: result.lng });
                                            handleSetDestination({ lat: result.lat, lng: result.lng }, result.nameDari ? `${result.name} (${result.nameDari})` : result.name);
                                        }}
                                        className="flex flex-col text-left px-4 py-3 border-b border-dark-100 dark:border-white/5 hover:bg-dark-50 dark:hover:bg-white/5 active:bg-dark-100 last:border-0"
                                    >
                                        <div className="flex justify-between items-center w-full">
                                            <span className="font-bold text-dark-900 dark:text-white">{result.name}</span>
                                            {result.nameDari && <span className="text-sm font-arabic text-brand-600 dark:text-brand-400">{result.nameDari}</span>}
                                        </div>
                                        <span className="text-xs text-dark-500 mt-1 capitalize">
                                            {result.type ? result.type.replace('_', ' ') : 'City'} • {result.province || result.city}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-sm text-dark-500">No places found in Afghanistan for "{searchQuery}"</div>
                        )}
                    </div>
                )}
            </div>

            {selectedService !== 'hotel' && !showResults && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-4 z-10 pointer-events-none flex flex-col items-center">
                    <div className="w-10 h-10 bg-dark-900 text-white rounded-full flex items-center justify-center shadow-xl mb-1 relative">
                        <MapPin size={20} fill="currentColor" />
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-3 bg-dark-900"></div>
                    </div>
                    <div className="bg-white dark:bg-dark-800 px-3 py-1.5 rounded-lg shadow-lg text-xs font-bold whitespace-nowrap">
                        Drag map to pinpoint
                    </div>
                </div>
            )}

            {!showResults && (
                <div className="absolute bottom-10 left-4 right-4 z-20">
                    {selectedService === 'hotel' ? (
                        <div className="bg-white dark:bg-dark-900 p-4 rounded-xl shadow-xl text-center">
                            <p className="text-sm font-bold mb-0 text-dark-700 dark:text-dark-300">Tap a hotel icon to select</p>
                        </div>
                    ) : (
                        <Button size="lg" className="w-full shadow-2xl bg-dark-900 hover:bg-black text-white py-4 text-lg font-bold transition-transform active:scale-95" onClick={handleConfirmSelection}>
                            Confirm Pin Location
                        </Button>
                    )}
                </div>
            )}
        </>
    );

    const DriverSelectionPanel = () => (
        <div className="fixed inset-x-0 bottom-0 bg-white dark:bg-dark-950 rounded-t-3xl shadow-2xl z-50 flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-300">
            {/* Header */}
            <div className="p-3 border-b border-dark-100 dark:border-white/5 shrink-0">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-base text-dark-900 dark:text-white">Select Driver</h3>
                    <button onClick={() => setViewState('selecting')} className="p-1.5 hover:bg-dark-100 dark:hover:bg-white/10 rounded-full"><X size={18} /></button>
                </div>

                {/* Fare Adjuster */}
                <div className="flex items-center justify-between bg-brand-50 dark:bg-brand-900/20 p-2 rounded-lg border border-brand-200 dark:border-brand-500/30 mb-2">
                    <span className="text-xs font-bold text-brand-700 dark:text-brand-300">Your Offer (AFN)</span>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setProposedFare((parseInt(proposedFare) - 10).toString())} className="w-6 h-6 rounded-full bg-white dark:bg-white/10 flex items-center justify-center font-bold text-dark-600 dark:text-white shadow-sm text-sm">-</button>
                        <input
                            type="number"
                            className="w-14 bg-transparent text-center font-black text-base text-brand-700 dark:text-white focus:outline-none"
                            value={proposedFare}
                            onChange={(e) => setProposedFare(e.target.value)}
                        />
                        <button onClick={() => setProposedFare((parseInt(proposedFare) + 10).toString())} className="w-6 h-6 rounded-full bg-white dark:bg-white/10 flex items-center justify-center font-bold text-dark-600 dark:text-white shadow-sm text-sm">+</button>
                    </div>
                </div>

                {/* Service Class & Schedule */}
                <div className="flex gap-2 mb-2">
                    <div className="flex-1">
                        <select
                            value={serviceClass}
                            onChange={(e) => setServiceClass(e.target.value as 'standard' | 'comfort' | 'premium' | 'xl')}
                            className="w-full rounded-lg border border-dark-200 dark:border-white/10 bg-white dark:bg-dark-900 px-2 py-1.5 text-xs font-medium"
                        >
                            <option value="standard">Standard</option>
                            <option value="comfort">Comfort</option>
                            <option value="premium">Premium</option>
                            <option value="xl">XL</option>
                        </select>
                    </div>
                    {selectedService === 'scheduled' && (
                        <div className="flex-1">
                            <input
                                type="datetime-local"
                                value={scheduledFor}
                                onChange={(e) => setScheduledFor(e.target.value)}
                                className="w-full rounded-lg border border-dark-200 dark:border-white/10 bg-white dark:bg-dark-900 px-2 py-1.5 text-xs"
                            />
                        </div>
                    )}
                </div>

                {/* Expandable Options */}
                <details className="group">
                    <summary className="text-xs font-bold text-brand-600 dark:text-brand-400 cursor-pointer list-none flex items-center justify-between py-1">
                        <span>More Options</span>
                        <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </summary>
                    <div className="mt-2 space-y-2">
                        {/* Book for Another */}
                        <div className="rounded-lg border border-dark-100 dark:border-white/10 p-2">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-dark-700 dark:text-dark-300">Book for another person</span>
                                <input
                                    type="checkbox"
                                    checked={requestForEnabled}
                                    onChange={(e) => setRequestForEnabled(e.target.checked)}
                                    className="w-4 h-4"
                                />
                            </div>
                            {requestForEnabled && (
                                <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                                    <input
                                        type="text"
                                        placeholder="Name"
                                        value={requestForName}
                                        onChange={(e) => setRequestForName(e.target.value)}
                                        className="rounded-lg border border-dark-200 dark:border-white/10 bg-white dark:bg-dark-900 px-2 py-1.5 text-xs"
                                    />
                                    <input
                                        type="tel"
                                        placeholder="Phone"
                                        value={requestForPhone}
                                        onChange={(e) => setRequestForPhone(e.target.value)}
                                        className="rounded-lg border border-dark-200 dark:border-white/10 bg-white dark:bg-dark-900 px-2 py-1.5 text-xs"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Extra Stops */}
                        <div className="rounded-lg border border-dark-100 dark:border-white/10 p-2">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-dark-700 dark:text-dark-300">Extra Stops ({extraStops.length}/2)</span>
                                <button
                                    onClick={addCurrentPinAsStop}
                                    className="text-xs font-bold text-brand-600 dark:text-brand-400"
                                    type="button"
                                >
                                    + Add
                                </button>
                            </div>
                            {extraStops.map((stop, index) => (
                                <div key={`${stop.lat}-${stop.lng}-${index}`} className="flex items-center justify-between text-[10px] text-dark-600 dark:text-dark-300 mt-1">
                                    <span className="truncate">{stop.label || `Stop ${index + 1}`}</span>
                                    <button className="text-red-500 ml-2" onClick={() => removeStop(index)} type="button">Remove</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </details>
            </div>

            {/* Driver List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
                {drivers.length === 0 ? (
                    <div className="text-center py-6">
                        <Car size={40} className="mx-auto text-dark-300 dark:text-dark-600 mb-2" />
                        <p className="text-sm text-dark-500 dark:text-dark-400 font-medium">No drivers nearby</p>
                        <p className="text-xs text-dark-400 dark:text-dark-500 mt-1">Try again in a moment</p>
                    </div>
                ) : (
                    drivers.map(driver => (
                        <div
                            key={driver.id}
                            onClick={() => handleSelectDriver(driver.id, driver.baseFare)}
                            className={`relative flex items-center p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                                selectedDriverId === driver.id 
                                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-md' 
                                    : 'border-dark-100 dark:border-white/5 hover:border-brand-200 dark:hover:border-white/20'
                            }`}
                        >
                            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center mr-2.5 relative shrink-0">
                                <Car size={22} className="text-white" />
                                {driver.status === 'available' && (
                                    <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white"></div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                    <span className="font-bold text-dark-900 dark:text-white text-sm truncate">{driver.name}</span>
                                    <span className="font-black text-brand-600 dark:text-brand-400 text-base ml-2">؋{driver.baseFare}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-dark-600 dark:text-dark-400">
                                    <span className="font-medium truncate">{driver.vehicle}</span>
                                    <span className="flex items-center text-orange-500 font-bold ml-2">
                                        <Star size={10} fill="currentColor" className="mr-0.5" /> {driver.rating.toFixed(1)}
                                    </span>
                                </div>
                                {driver.licensePlate && (
                                    <div className="text-[10px] text-dark-500 dark:text-dark-500 font-mono bg-dark-100 dark:bg-white/5 px-1.5 py-0.5 rounded inline-block mt-0.5">
                                        {driver.licensePlate}
                                    </div>
                                )}
                            </div>
                            {selectedDriverId === driver.id && (
                                <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Request Button */}
            <div className="p-3 border-t border-dark-100 dark:border-white/5 bg-white dark:bg-dark-950 shrink-0">
                {drivers.length === 0 ? (
                    <Button 
                        size="lg" 
                        className="w-full text-sm shadow-xl bg-brand-600 hover:bg-brand-700 text-white py-3 font-bold" 
                        onClick={handleRequestRide}
                    >
                        Request Any Available Driver
                    </Button>
                ) : (
                    <Button 
                        size="lg" 
                        className="w-full text-sm shadow-xl bg-brand-600 hover:bg-brand-700 text-white py-3 font-bold disabled:bg-dark-200 disabled:text-dark-500" 
                        disabled={!selectedDriverId} 
                        onClick={handleRequestRide}
                    >
                        {selectedDriverId ? 'Request Ride' : 'Select a Driver'}
                    </Button>
                )}
            </div>
        </div>
    );

    const ActiveTripPanel = () => {
        if (!activeRide) return null;
        const isPending = activeRide.status === 'requested';
        const isArrived = activeRide.status === 'arrived';
        const isInProgress = activeRide.status === 'in_progress';

        // Dynamic Driver Data
        const driver = drivers.find(d => d.id === activeRide.driverId);

        return (
            <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-dark-950 rounded-t-3xl shadow-[0_-10px_50px_rgba(0,0,0,0.2)] z-30 p-6 mb-16 md:mb-0 animate-in slide-in-from-bottom-20 duration-300">
                {isPending ? (
                    <div className="text-center py-6">
                        <div className="w-16 h-16 rounded-full border-4 border-brand-500 border-t-transparent animate-spin mx-auto mb-4"></div>
                        <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-1">Contacting Driver...</h2>
                        <p className="text-dark-500">Waiting for acceptance</p>
                        <Button variant="ghost" className="mt-4 text-red-500" onClick={() => updateRideStatus('cancelled')}>Cancel Request</Button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <div className="text-xs font-bold text-brand-600 uppercase tracking-wider mb-1">
                                    {isArrived ? 'Driver is Here!' : isInProgress ? 'On Trip' : 'Driver Arriving'}
                                </div>
                                <h2 className="text-2xl font-bold text-dark-900 dark:text-white">
                                    {isArrived ? 'Meet at Pickup Point' : isInProgress ? 'Heading to Destination' : 'Driver En Route'}
                                </h2>
                                {distanceInfo && !isArrived && !isInProgress && (
                                    <div className="mt-2 inline-flex items-center gap-2 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-3 py-1.5 rounded-full text-sm font-bold">
                                        <Navigation size={14} />
                                        {distanceInfo.distanceKm < 0.05
                                            ? 'Driver has arrived'
                                            : `${distanceInfo.distanceKm} km away (~${distanceInfo.etaMinutes} min)`
                                        }
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-black text-dark-900 dark:text-white">
                                    {isArrived ? '0' : distanceInfo ? `${distanceInfo.etaMinutes}m` : etaText}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 bg-gradient-to-r from-brand-50 to-blue-50 dark:from-brand-900/20 dark:to-blue-900/20 p-4 rounded-xl mb-6 border-2 border-brand-200 dark:border-brand-500/30 shadow-md">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 overflow-hidden relative shadow-lg shrink-0">
                                <img src={`https://ui-avatars.com/api/?name=${driver?.name || 'Driver'}&background=4F46E5&color=fff&bold=true`} className="w-full h-full" alt="driver" />
                                {driver?.type === 'plus' && <div className="absolute bottom-0 right-0 w-5 h-5 bg-yellow-400 rounded-full border-2 border-white flex items-center justify-center"><Star size={10} className="text-white fill-white" /></div>}
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-dark-900 dark:text-white text-lg flex items-center gap-2 mb-1">
                                    {driver?.name || 'Unknown Driver'}
                                    <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 font-bold flex items-center gap-1">
                                        <Star size={12} fill="currentColor" /> {driver?.rating.toFixed(1)}
                                    </span>
                                </div>
                                <div className="text-sm text-dark-600 dark:text-dark-300 font-medium mb-1">
                                    {(driver?.vehicle || 'Unknown Vehicle')}
                                </div>
                                <div className="text-xs text-dark-500 dark:text-dark-400">
                                    Plate: <span className="font-mono bg-white dark:bg-white/10 px-2 py-0.5 rounded font-bold">{driver?.licensePlate || 'N/A'}</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={handleContactDriver} title="Chat in App" className="w-11 h-11 rounded-full bg-brand-600 hover:bg-brand-700 flex items-center justify-center text-white shadow-lg transition-transform active:scale-95">
                                    <MessageCircle size={20} />
                                </button>
                                <button onClick={handleWhatsAppCall} title="Call via WhatsApp" className="w-11 h-11 rounded-full bg-green-600 hover:bg-green-700 flex items-center justify-center text-white shadow-lg transition-transform active:scale-95">
                                    <Phone size={20} />
                                </button>
                            </div>
                        </div>

                        {(activeRide.status === 'accepted' || activeRide.status === 'arrived') && driver?.phone && (
                            <Button
                                variant="secondary"
                                className="w-full mb-4"
                                icon={<MessageCircle size={18} />}
                                onClick={() => setShowWhatsAppModal(true)}
                            >
                                Chat via WhatsApp
                            </Button>
                        )}

                        {isInProgress ? (
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-4 border border-blue-100 dark:border-blue-500/20 text-blue-700 dark:text-blue-300 text-sm font-medium text-center flex items-center justify-center gap-2">
                                <Shield size={16} /> Trip secured & monitored
                            </div>
                        ) : null}

                        <div className="flex gap-3">
                            {!isInProgress && (
                                <>
                                    <Button variant="secondary" className="flex-1" icon={<Flag size={18} />}>Share</Button>
                                    <Button variant="destructive" className="flex-1" onClick={() => { updateRideStatus('cancelled'); setTimeout(resetFlow, 1000); }}>Cancel</Button>
                                </>
                            )}
                            <Button
                                variant="destructive"
                                className="flex-1 bg-red-600 hover:bg-red-700"
                                icon={<AlertTriangle size={18} />}
                                onClick={() => setShowSOSConfirm(true)}
                                disabled={sosTriggered}
                            >
                                {sosTriggered ? 'SOS Sent' : 'SOS'}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        );
    };

    // --- Main Render ---

    if (activeRide && activeRide.status !== 'cancelled' && activeRide.status !== 'completed') {
        return (
            <div className="relative h-full w-full">
                <MapBackground
                    pickup={activeRide.pickupLocation}
                    destination={activeRide.destinationLocation}
                    route={activeRide.route}
                    // If accepted, focus on driver+pickup. If in_progress, focus on driver+dest.
                    zoom={15}
                />
                <ActiveTripPanel />
            </div>
        );
    }

    return (
        <div className="relative h-full w-full bg-slate-100 dark:bg-slate-900">
            {/* WhatsApp Confirmation Modal */}
            {showWhatsAppModal && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-white dark:bg-dark-900 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
                        <h3 className="text-xl font-bold text-dark-900 dark:text-white mb-2">Open WhatsApp?</h3>
                        <p className="text-dark-600 dark:text-dark-400 mb-6">This will open WhatsApp to chat with your driver about this ride.</p>
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

            {/* SOS Confirmation Modal */}
            {showSOSConfirm && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-sm bg-white dark:bg-dark-900 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                <AlertTriangle size={24} className="text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold text-dark-900 dark:text-white">Emergency SOS</h3>
                        </div>
                        <p className="text-dark-600 dark:text-dark-400 mb-6">
                            This will immediately alert the admin team and emergency contacts. Use only in genuine emergencies.
                        </p>
                        <div className="flex gap-3">
                            <Button variant="secondary" className="flex-1" onClick={() => setShowSOSConfirm(false)}>Cancel</Button>
                            <Button variant="destructive" className="flex-1 bg-red-600 hover:bg-red-700" onClick={handleTriggerSOS}>Send SOS</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Map */}
            <MapBackground
                pickup={viewState !== 'grid' && viewState !== 'selecting' ? userLocation : undefined}
                destination={destCoords}
                route={currentRoute}
                showHotels={selectedService === 'hotel'}
                hotels={hotels}
                onCameraChange={handleCameraChange}
                center={mapCenter}
                zoom={selectedService === 'hotel' ? 13 : 16}
            />

            {/* Recenter Button (Only in grid/selecting modes) */}
            <div className="absolute top-4 right-4 z-10 pointer-events-auto">
                <button
                    onClick={() => setMapCenter(userLocation)}
                    className="w-10 h-10 bg-white dark:bg-dark-900 rounded-full shadow-lg flex items-center justify-center text-dark-900 dark:text-white active:scale-95 transition-transform"
                >
                    <Navigation size={20} />
                </button>
            </div>

            {/* UI Layers */}
            {viewState === 'grid' && <ServiceGrid />}
            {viewState === 'selecting' && <MapSelectionOverlay />}
            {viewState === 'drivers' && <DriverSelectionPanel />}
        </div>
    );
};
