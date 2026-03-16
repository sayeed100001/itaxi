
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MapBackground } from '../../components/Map/MapBackground';
import { Button } from '../../components/ui/Button';
import { MapPin, Navigation, Car, Building, Plane, Clock, User, MessageCircle, Phone, X, Star, Flag, ArrowLeft, Shield, Edit2, Package, Home, Briefcase, Plus, Calendar, Search, Check, Bell, ChevronDown, Zap, Heart, Gift, DollarSign, Tag, Users, Route } from 'lucide-react';
import { useAppStore } from '../../store';
import { Ride, ServiceType, Hotel, Location, RouteData, Poi } from '../../types';
import { apiFetch } from '../../services/api';
import { RoutingManager } from '../../services/routing/RoutingManager';
import { DriverSelectionPanel } from '../../components/Rider/DriverSelectionPanel';
import { ActiveTripPanel } from '../../components/Rider/ActiveTripPanel';
import { TAXI_TYPES } from '../../services/taxiTypes';
import { translations } from '../../i18n/translations';

export const RiderHome: React.FC = () => {
    const activeRide = useAppStore((state) => state.activeRide);
    const startRide = useAppStore((state) => state.startRide);
    const createRide = useAppStore((state) => state.createRide);
    const updateRideStatus = useAppStore((state) => state.updateRideStatus);
    const addToast = useAppStore((state) => state.addToast);
    const userLocation = useAppStore((state) => state.userLocation);
    const drivers = useAppStore((state) => state.drivers);
    const hotels = useAppStore((state) => state.hotels);
    const adminSettings = useAppStore((state) => state.adminSettings);
    const updateSavedPlace = useAppStore((state) => state.updateSavedPlace);
    const setRoute = useAppStore((state) => state.setRoute);
    const currentRoute = useAppStore((state) => state.currentRoute);
    const openChat = useAppStore((state) => state.openChat);
    const user = useAppStore((state) => state.user);
    const setView = useAppStore((state) => state.setView);
    const unreadNotifications = useAppStore((state) => state.notifications.filter(n => !n.read).length);
    const selectedTaxiType = useAppStore((state) => state.selectedTaxiType);
    const setSelectedTaxiType = useAppStore((state) => state.setSelectedTaxiType);
    const language = useAppStore((state) => state.language);
    const t = translations[language];

    // View States
    const [viewState, setViewState] = useState<'grid' | 'selecting' | 'search' | 'confirm_pickup' | 'compare' | 'drivers' | 'negotiating' | 'tracking'>('grid');
    const [selectedService, setSelectedService] = useState<ServiceType>('city');

    // Selection Data
    const [mapCenter, setMapCenter] = useState<Location>(userLocation);
    const [destination, setDestination] = useState<string>('');
    const [destCoords, setDestCoords] = useState<Location | null>(null);
    const [pickupCoords, setPickupCoords] = useState<Location | null>(null);

    // Search
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Request Data
    const [proposedFare, setProposedFare] = useState<string>('');
    const [showFareInput, setShowFareInput] = useState(false);
    const [notes, setNotes] = useState<string>('');

    // Dynamic Data
    const [etaText, setEtaText] = useState('12 min');
    const [isSubscribed, setIsSubscribed] = useState(false);

    const handleSetDestinationRef = useRef<(coords: Location, name: string) => Promise<void>>(async () => {});

    // Modals
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showSubsModal, setShowSubsModal] = useState(false);
    const [scheduledTime, setScheduledTime] = useState<string>('');

    // Promo code
    const [promoCode, setPromoCode] = useState('');
    const [promoDiscount, setPromoDiscount] = useState(0);
    const [promoLoading, setPromoLoading] = useState(false);
    const [promoApplied, setPromoApplied] = useState(false);

    // Multi-stop
    const [showMultiStop, setShowMultiStop] = useState(false);
    const [extraStops, setExtraStops] = useState<Array<{address: string; lat: number; lng: number}>>([]);

    // Poll ride status when there's an active ride (replaces socket on Vercel)
    useEffect(() => {
        if (!activeRide?.id || activeRide.status === 'completed' || activeRide.status === 'cancelled') return;
        const poll = async () => {
            try {
                const res = await apiFetch(`/api/rides/${activeRide.id}`);
                if (!res.ok) return;
                const ride = await res.json();
                if (ride.status && ride.status !== activeRide.status) {
                    useAppStore.setState({ activeRide: { ...activeRide, ...ride } });
                    if (ride.status === 'accepted') addToast('success', 'Driver accepted your ride!');
                    if (ride.status === 'arrived') addToast('info', 'Driver has arrived!');
                    if (ride.status === 'in_progress') addToast('info', 'Trip started!');
                    if (ride.status === 'completed') addToast('info', 'Trip completed!');
                }
            } catch {}
        };
        poll();
        const id = setInterval(poll, 4000);
        return () => clearInterval(id);
    }, [activeRide?.id, activeRide?.status]);

    // Keep the map centered on the user while idle; don't fight the user while selecting a destination.
    useEffect(() => {
        if (viewState === 'grid') {
            setMapCenter(userLocation);
        }
    }, [userLocation, viewState]);

    // Always refresh drivers when location changes (demo/local generation).
    useEffect(() => {
        const { generateLocalDrivers } = useAppStore.getState();
        generateLocalDrivers(userLocation);
    }, [userLocation]);

    // Keep taxi-type filter consistent with selected service (avoid "selected but disabled" state)
    useEffect(() => {
        const allowed =
            selectedService === 'city' ? ['eco', 'plus'] :
                selectedService === 'intercity' ? ['lux', 'premium'] :
                    ['eco', 'plus', 'lux', 'premium'];

        if (selectedTaxiType && !allowed.includes(selectedTaxiType.id)) {
            setSelectedTaxiType(null);
        }
    }, [selectedService, selectedTaxiType?.id, setSelectedTaxiType]);

    const filteredDrivers = useMemo(() => {
        if (!selectedService) return drivers;
        if (selectedService === 'hotel') return [];
        if (selectedService === 'scheduled' || selectedService === 'subscription') return drivers;

        const byService = drivers.filter(d => {
            if (d.serviceTypes && d.serviceTypes.length > 0) {
                return d.serviceTypes.includes(selectedService);
            }
            // Fallback
            if (selectedService === 'city') return ['eco', 'plus'].includes(d.type);
            if (selectedService === 'intercity') return ['lux', 'premium'].includes(d.type);
            if (selectedService === 'airport') return true;
            return true;
        });

        if (!selectedTaxiType) return byService;
        return byService.filter(d => d.type === selectedTaxiType.id);
    }, [drivers, selectedService, selectedTaxiType?.id]);

    // Update ETA based on driver location
    useEffect(() => {
        if (activeRide && activeRide.driverId) {
            const driver = drivers.find(d => d.id === activeRide.driverId);
            if (driver) {
                // Simple distance check for simulation
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
            setTimeout(() => handleSetDestinationRef.current(hotel.location, hotel.name), 200);
        };
        window.addEventListener('select-hotel', handleHotelSelect);
        return () => window.removeEventListener('select-hotel', handleHotelSelect);
    }, []);

    // Handle POI Selection from Map Popup (airports, malls, hotels, ...)
    useEffect(() => {
        const handlePoiSelect = (e: any) => {
            const poi = e.detail as Poi;
            if (!poi?.location) return;
            const name = String(poi.name || '').trim() || 'Pinned Location';
            setDestination(name);
            setDestCoords(poi.location);
            setViewState('selecting');
            setTimeout(() => handleSetDestinationRef.current(poi.location, name), 120);
        };

        window.addEventListener('select-poi', handlePoiSelect);
        return () => window.removeEventListener('select-poi', handlePoiSelect);
    }, []);

    // --- Actions ---

    const handleServiceSelect = (service: ServiceType) => {
        if (service === 'scheduled') {
            setShowScheduleModal(true);
            return;
        }
        if (service === 'subscription') {
            setShowSubsModal(true);
            return;
        }

        setSelectedService(service);
        if (service === 'hotel') {
            setViewState('selecting');
        } else {
            setViewState('selecting');
            setMapCenter(userLocation);
        }
    };

    const handleScheduleConfirm = (date: string, time: string) => {
        setScheduledTime(`${date} ${time}`);
        setShowScheduleModal(false);
        setSelectedService('scheduled');
        setViewState('selecting');
        addToast('success', `Ride scheduled for ${date} at ${time}`);
    };

    const handleCameraChange = useCallback((center: Location) => {
        if (viewState !== 'selecting') return;
        if (selectedService === 'hotel') return;
        // While selecting, always treat the map center as the pinned destination.
        setMapCenter(center);
    }, [viewState, selectedService]);

    const handleSetDestination = async (coords: Location, name: string) => {
        const finalPickup = pickupCoords || userLocation;

        // Persist pickup & destination in local state so نقشه همیشه مبدا/مقصد را بداند
        setPickupCoords(finalPickup);
        setDestCoords(coords);
        setDestination(name);

        try {
            const routeData = await RoutingManager.getRoute(finalPickup, coords, adminSettings);
            setRoute(routeData);

            // بعد از محاسبهٔ مسیر، مستقیماً وارد صفحهٔ مقایسه شو
            setViewState('compare');

        } catch (error) {
            // Fallback: allow the flow to continue even if routing provider is down.
            // Use straight-line distance + conservative duration to enable fare estimation and taxi selection.
            try {
                const R = 6371; // km
                const toRad = (d: number) => d * (Math.PI / 180);
                const dLat = toRad(coords.lat - finalPickup.lat);
                const dLng = toRad(coords.lng - finalPickup.lng);
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(toRad(finalPickup.lat)) * Math.cos(toRad(coords.lat)) *
                    Math.sin(dLng / 2) * Math.sin(dLng / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distKm = Math.max(0.3, R * c);

                // Conservative urban speed. (Keeps estimates realistic when routing is unavailable)
                const avgSpeedKmh = 28;
                const durationSec = Math.max(120, Math.round((distKm / avgSpeedKmh) * 3600));
                const distanceMeters = Math.round(distKm * 1000);

                setRoute({
                    coordinates: [
                        [finalPickup.lat, finalPickup.lng],
                        [coords.lat, coords.lng]
                    ],
                    distance: distanceMeters,
                    duration: durationSec,
                    bbox: [
                        Math.min(finalPickup.lat, coords.lat),
                        Math.min(finalPickup.lng, coords.lng),
                        Math.max(finalPickup.lat, coords.lat),
                        Math.max(finalPickup.lng, coords.lng),
                    ]
                });

                addToast('warning', 'Route unavailable. Using approximate distance.');
                setViewState('compare');
            } catch {
                addToast('error', "Could not calculate route.");
            }
        }
    };

    // Keep map-selection handlers fresh without re-binding window event listeners.
    handleSetDestinationRef.current = handleSetDestination;

    const handleConfirmSelection = () => {
        // اگر در حالت انتخاب هستیم، مقصد را بر اساس موقعیت فعلی پین ثبت کن
        if (viewState === 'selecting') {
            const baseCoords = mapCenter || destCoords || userLocation;
            handleSetDestination(baseCoords, destination || "Pinned Location");
            return;
        }

        // اگر قبلاً مقصد و مسیر داریم، دکمه فقط باید ما را به صفحهٔ مقایسه/درخواست ببرد
        if (destCoords && currentRoute) {
            setViewState('compare');
        } else if (!destCoords) {
            addToast('error', 'Please select a destination on the map first.');
        }
    };

    const handleSelectServiceFromCompare = (serviceId: ServiceType, price: number) => {
        setSelectedService(serviceId);
        const discounted = promoDiscount > 0 ? Math.max(0, price - promoDiscount) : price;
        setProposedFare(discounted.toString());
    };

    const handleApplyPromo = async () => {
        if (!promoCode.trim() || promoApplied) return;
        const suggestedFare = getSuggestedFare(selectedService) || 0;
        if (!suggestedFare) { addToast('error', 'Select a service first'); return; }
        setPromoLoading(true);
        try {
            const res = await apiFetch('/api/promo/validate', {
                method: 'POST',
                body: JSON.stringify({ code: promoCode.trim(), fare: suggestedFare })
            });
            const data = await res.json();
            if (data.valid) {
                setPromoDiscount(data.discount);
                setPromoApplied(true);
                addToast('success', `Promo applied! ؋${data.discount} discount`);
            } else {
                addToast('error', data.message || 'Invalid promo code');
            }
        } catch {
            addToast('error', 'Could not validate promo code');
        } finally {
            setPromoLoading(false);
        }
    };

    const handleAddStop = () => {
        setExtraStops(prev => [...prev, { address: '', lat: 0, lng: 0 }]);
    };

    const handleRemoveStop = (idx: number) => {
        setExtraStops(prev => prev.filter((_, i) => i !== idx));
    };

    const getSuggestedFare = (serviceId: ServiceType): number | null => {
        const route: RouteData | null = currentRoute;
        if (!route) return null;

        let distKm = route.distance && Number.isFinite(route.distance) ? route.distance / 1000 : 0;
        let durMin = route.duration && Number.isFinite(route.duration) ? route.duration / 60 : 0;

        // If we don't have valid distance/duration, estimate from pickup/destination coords.
        if ((!distKm || !Number.isFinite(distKm)) && (pickupCoords || userLocation) && (destCoords || mapCenter)) {
            const start = pickupCoords || userLocation;
            const end = destCoords || mapCenter;
            const R = 6371; // km
            const toRad = (d: number) => d * (Math.PI / 180);
            const dLat = toRad(end.lat - start.lat);
            const dLng = toRad(end.lng - start.lng);
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(start.lat)) * Math.cos(toRad(end.lat)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distKm = R * c;
        }

        if (!durMin || !Number.isFinite(durMin)) {
            const avgSpeedKmh = 30;
            durMin = (distKm / avgSpeedKmh) * 60;
        }

        const pricing =
            adminSettings?.services?.find(s => s.id === serviceId) ||
            adminSettings?.services?.find(s => s.id === 'city') ||
            adminSettings?.services?.[0];
        if (!pricing) return null;

        let price = Math.round((distKm * pricing.perKm) + pricing.baseFare + (durMin * pricing.perMin));

        const points = Number(user?.loyaltyPoints ?? 0);
        if (points >= 50) price = Math.round(price * 0.85);
        else if (points >= 30) price = Math.round(price * 0.90);
        else if (points >= 10) price = Math.round(price * 0.95);

        if (isSubscribed) {
            price = Math.round(price * 0.85);
        }

        const minFare = Number(pricing.minFare) || Number(adminSettings?.pricing?.minFare) || 0;
        if (minFare) price = Math.max(minFare, price);

        return price;
    };

    const handleOpenDriverSelection = () => {
        const parsedFare = typeof proposedFare === 'string' ? Number(proposedFare) : NaN;
        const hasValidFare = Number.isFinite(parsedFare) && parsedFare > 0;
        if (!hasValidFare) {
            const suggested = getSuggestedFare(selectedService);
            if (suggested) setProposedFare(String(suggested));
        }
        setViewState('drivers');
    };

    const handleRequestRide = async () => {
        const finalPickup = pickupCoords || userLocation;

        // Validate required data before sending
        if (!user?.id) {
            addToast('error', 'User not authenticated. Please log in again.');
            return;
        }

        if (!destCoords) {
            addToast('error', 'Please select a destination first.');
            return;
        }

        if (!selectedService) {
            addToast('error', 'Please select a service type.');
            return;
        }

        if (!currentRoute) {
            addToast('error', 'Route not ready. Please try selecting the destination again.');
            return;
        }

        const parsedFare = typeof proposedFare === 'string' && proposedFare.trim() ? Number(proposedFare) : NaN;
        const suggestedFare = getSuggestedFare(selectedService);
        const finalProposedFare = (Number.isFinite(parsedFare) && parsedFare > 0)
            ? Math.round(parsedFare)
            : (suggestedFare ?? null);

        // Pool ride: use dedicated endpoint
        if (selectedService === 'pool') {
            try {
                const res = await apiFetch('/api/rides/pool/request', {
                    method: 'POST',
                    body: JSON.stringify({
                        pickupLoc: { lat: finalPickup.lat, lng: finalPickup.lng },
                        destLoc: { lat: destCoords.lat, lng: destCoords.lng },
                        pickup: 'Current Location',
                        destination: destination || 'Destination',
                        proposedFare: finalProposedFare
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Pool request failed');
                addToast('success', data.matched ? `Pool ride matched with ${data.matchCount} other rider(s)!` : 'Pool ride requested! Waiting for match...');
                setViewState('tracking');
                return;
            } catch (error) {
                addToast('error', error instanceof Error ? error.message : 'Pool ride failed');
                return;
            }
        }

        // Multi-stop ride
        if (extraStops.length > 0) {
            try {
                const stops = [
                    { address: 'Current Location', lat: finalPickup.lat, lng: finalPickup.lng, order: 0 },
                    ...extraStops.filter(s => s.address).map((s, i) => ({ ...s, order: i + 1 })),
                    { address: destination || 'Destination', lat: destCoords.lat, lng: destCoords.lng, order: extraStops.length + 1 }
                ];
                const res = await apiFetch('/api/rides/multistop', {
                    method: 'POST',
                    body: JSON.stringify({ stops, serviceType: selectedService })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Multi-stop failed');
                addToast('success', `Multi-stop ride created with ${stops.length} stops!`);
                setViewState('tracking');
                return;
            } catch (error) {
                addToast('error', error instanceof Error ? error.message : 'Multi-stop failed');
                return;
            }
        }

        const rideData = {
            riderId: user.id,
            pickup: 'Current Location',
            destination: destination || "Pinned Location",
            pickupLoc: {
                lat: finalPickup.lat,
                lng: finalPickup.lng
            },
            destLoc: {
                lat: destCoords.lat,
                lng: destCoords.lng
            },
            serviceType: selectedService,
            taxiTypeId: selectedTaxiType?.id || undefined,
            route: currentRoute,
            proposedFare: finalProposedFare,
            scheduledTime: scheduledTime || undefined,
            notes: notes || undefined
        };

        console.log('🚗 Requesting ride with data:', rideData);

        try {
            await createRide(rideData);
            setViewState('tracking');
            addToast('success', 'Ride requested successfully!');
        } catch (error) {
            console.error('❌ Ride request failed:', error);

            // More specific error handling
            if (error instanceof Error) {
                if (error.message.includes('coordinates')) {
                    addToast('error', 'Invalid location coordinates. Please try selecting the location again.');
                } else if (error.message.includes('authentication')) {
                    addToast('error', 'Authentication failed. Please log in again.');
                } else if (error.message.includes('required fields')) {
                    addToast('error', 'Missing required information. Please check your selection.');
                } else {
                    addToast('error', `Failed to request ride: ${error.message}`);
                }
            } else {
                addToast('error', 'Failed to request ride. Please try again.');
            }
        }
    };

    const resetFlow = () => {
        setViewState('grid');
        setDestCoords(null);
        setPickupCoords(null);
        setRoute(null);
        setDestination('');
        startRide(null);
        setMapCenter(userLocation);
        setScheduledTime('');
    };

    const handleContactDriver = () => {
        try {
            const driver = drivers.find(d => d.id === activeRide?.driverId);
            if (driver && driver.id && driver.name) {
                console.log('Opening chat with driver:', driver);
                openChat(driver.id, driver.name, 'Driver');
            } else {
                console.error('Driver not found:', { driverId: activeRide?.driverId, drivers });
                addToast('error', 'اطلاعات راننده در دسترس نیست');
            }
        } catch (error) {
            console.error('Chat open error:', error);
            addToast('error', 'خطا در باز کردن چت');
        }
    };

    const handleCallDriver = () => {
        addToast('info', 'Calling Driver...');
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 3) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            // Check cache first
            const cacheKey = `search:${query}:${userLocation.lat}:${userLocation.lng}`;
            const cached = sessionStorage.getItem(cacheKey);

            if (cached) {
                const cachedData = JSON.parse(cached);
                if (Date.now() - cachedData.timestamp < 300000) { // 5 min cache
                    setSearchResults(cachedData.results);
                    setIsSearching(false);
                    return;
                }
            }

            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&lat=${userLocation.lat}&lng=${userLocation.lng}`);
            if (response.ok) {
                const results = await response.json();
                setSearchResults(results);

                // Cache results
                sessionStorage.setItem(cacheKey, JSON.stringify({
                    results,
                    timestamp: Date.now()
                }));
            }
        } catch (error) {
            console.error('Search failed:', error);
            addToast('error', 'Search failed. Please try again.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectSearchResult = (result: any) => {
        setDestination(result.name);
        setDestCoords({ lat: result.lat, lng: result.lng });
        setSearchQuery('');
        setSearchResults([]);
        setViewState('selecting');
        handleSetDestination({ lat: result.lat, lng: result.lng }, result.name);
    };

    const handleWhatsAppContact = () => {
        const driver = drivers.find(d => d.id === activeRide?.driverId);
        if (driver?.phone) {
            const message = encodeURIComponent(`Hello, I'm your passenger for ride to ${activeRide?.destination}. My pickup location is ${activeRide?.pickup}.`);
            const phoneNumber = driver.phone.replace(/[^0-9]/g, ''); // Remove all non-numeric characters
            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

            // Try to open WhatsApp, fallback to regular phone call if fails
            const whatsappWindow = window.open(whatsappUrl, '_blank');
            if (!whatsappWindow) {
                addToast('error', 'Could not open WhatsApp. Please check if WhatsApp is installed.');
                // Fallback to phone call
                window.open(`tel:${driver.phone}`);
            } else {
                addToast('success', 'Opening WhatsApp chat with driver');
            }
        } else {
            addToast('error', 'Driver phone number not available');
        }
    };

    // --- Silicon Valley Level UI Components ---

    const PremiumSearchBar = () => (
        <div
            onClick={() => { setSelectedService('city'); setViewState('search'); }}
            className="group relative overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative flex items-center gap-4 p-5 rounded-3xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl cursor-pointer transition-all duration-500 hover:bg-white dark:hover:bg-zinc-900 shadow-lg hover:shadow-2xl border border-zinc-200/50 dark:border-white/10 hover:border-blue-500/30">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/30 transition-transform group-hover:scale-110 duration-300">
                    <Search size={24} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                    <div className="font-display font-bold text-xl text-zinc-900 dark:text-white mb-1">{language === 'fa' ? t.rider.common.where_to : 'Where to?'}</div>
                    <div className="text-sm text-zinc-500 font-medium">{language === 'fa' ? t.rider.common.search_destinations : 'Search destinations, hotels, airports'}</div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-2 rounded-full text-xs font-bold text-zinc-900 dark:text-white shadow-sm flex items-center gap-2 border border-zinc-200 dark:border-zinc-700">
                        <Clock size={14} className="text-blue-500" /> {language === 'fa' ? t.rider.common.now : 'Now'}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <ChevronDown size={16} className="text-zinc-500" />
                    </div>
                </div>
            </div>
        </div>
    );

    const ScheduleModal = () => {
        if (!showScheduleModal) return null;
        const [date, setDate] = useState('');
        const [time, setTime] = useState('');

        return (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[32px] p-8 shadow-2xl ring-1 ring-white/10 animate-scale-up">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">Schedule a Ride</h3>
                        <button onClick={() => setShowScheduleModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X size={24} /></button>
                    </div>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-zinc-600 dark:text-zinc-400 mb-2 ml-1">Date</label>
                            <input type="date" className="w-full h-14 px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-brand-500 focus:ring-0 text-zinc-900 dark:text-white font-bold transition-all outline-none" onChange={e => setDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-zinc-600 dark:text-zinc-400 mb-2 ml-1">Time</label>
                            <input type="time" className="w-full h-14 px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-2 border-transparent focus:border-brand-500 focus:ring-0 text-zinc-900 dark:text-white font-bold transition-all outline-none" onChange={e => setTime(e.target.value)} />
                        </div>
                        <Button size="lg" className="w-full h-14 text-lg font-bold rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 shadow-lg shadow-zinc-900/20 mt-4" onClick={() => handleScheduleConfirm(date, time)} disabled={!date || !time}>
                            Confirm Schedule
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    const SubsModal = () => {
        if (!showSubsModal) return null;
        return (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-[32px] p-8 shadow-2xl ring-1 ring-white/10 animate-scale-up">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-2xl font-display font-bold text-zinc-900 dark:text-white">iTaxi Pass</h3>
                        <button onClick={() => setShowSubsModal(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X size={24} /></button>
                    </div>
                    <div className="space-y-6">
                        <div className="p-6 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/30 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <div className="font-display font-bold text-2xl mb-1">Monthly Pass</div>
                                        <div className="text-brand-100 text-sm font-medium">Unlock premium benefits</div>
                                    </div>
                                    <div className="font-black text-3xl">؋500</div>
                                </div>
                                <ul className="space-y-3 mb-8">
                                    <li className="flex items-center gap-3 font-medium"><div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"><Check size={14} strokeWidth={3} /></div> 15% off all rides</li>
                                    <li className="flex items-center gap-3 font-medium"><div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"><Check size={14} strokeWidth={3} /></div> Priority dispatch</li>
                                    <li className="flex items-center gap-3 font-medium"><div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"><Check size={14} strokeWidth={3} /></div> Free cancellations</li>
                                </ul>
                                <Button size="lg" className="w-full h-12 bg-white text-brand-600 hover:bg-brand-50 font-bold rounded-xl shadow-sm border-0" onClick={() => { addToast('success', 'Subscription activated!'); setIsSubscribed(true); setShowSubsModal(false); }}>
                                    Subscribe Now
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const ServiceGrid = () => {
        const savedPlaces = user?.savedPlaces || [];
        const home = savedPlaces.find(p => p.name === 'Home');
        const work = savedPlaces.find(p => p.name === 'Work');

        const handleSetSavedPlace = (type: 'Home' | 'Work') => {
            updateSavedPlace({ name: type, address: `Pinned ${type} Location`, location: mapCenter });
            addToast('success', `${type} location saved to current map center`);
        };

        const services = [
            {
                id: 'city',
                label: language === 'fa' ? t.rider.common.ride : 'Ride',
                subtitle: language === 'fa' ? t.rider.common.ride_subtitle : 'Affordable city rides',
                gradient: 'from-blue-500 to-blue-600',
                icon: <Car className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />,
                popular: true
            },
            {
                id: 'pool',
                label: language === 'fa' ? t.rider.common.pool : 'Pool',
                subtitle: language === 'fa' ? t.rider.common.pool_subtitle : 'Share & save 30%',
                gradient: 'from-teal-500 to-teal-600',
                icon: <Users className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
            },
            {
                id: 'scheduled',
                label: language === 'fa' ? t.rider.common.reserve : 'Reserve',
                subtitle: language === 'fa' ? t.rider.common.reserve_subtitle : 'Book for later',
                gradient: 'from-purple-500 to-purple-600',
                icon: <Calendar className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />,
                action: () => setShowScheduleModal(true)
            },
            {
                id: 'hotel',
                label: language === 'fa' ? t.rider.common.hotels : 'Hotels',
                subtitle: language === 'fa' ? t.rider.common.hotels_subtitle : 'Find & book stays',
                gradient: 'from-emerald-500 to-emerald-600',
                icon: <Building className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
            }
        ];

        return (
            <div className="absolute bottom-0 left-0 right-0 max-h-[85dvh] overflow-y-auto overscroll-contain scroll-area bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.6)] z-[40] p-4 sm:p-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-6 animate-slide-up ring-1 ring-black/5 dark:ring-white/10">
                {/* Drag Handle */}
                <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-6 sm:mb-8"></div>

                {/* Premium Search Bar - Responsive */}
                <div className="mb-6 sm:mb-8">
                    <PremiumSearchBar />
                </div>

                {/* Premium Service Cards - Responsive Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                    {services.map((service) => (
                        <button
                            key={service.id}
                            onClick={() => handleServiceSelect(service.id as ServiceType)}
                            className="group relative overflow-hidden"
                        >
                            {/* Glow Effect */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${service.gradient} rounded-2xl sm:rounded-3xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-500`}></div>

                            {/* Main Card - Responsive */}
                            <div className="relative">
                                <div className={`w-full aspect-[4/3] sm:aspect-[4/3] rounded-2xl sm:rounded-3xl bg-gradient-to-br ${service.gradient} p-0.5 shadow-lg transition-all duration-500 group-hover:shadow-2xl group-active:scale-95`}>
                                    <div className="w-full h-full rounded-[14px] sm:rounded-[22px] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-3 sm:p-4 transition-all duration-300 group-hover:bg-white/90 dark:group-hover:bg-zinc-950/90">
                                        {/* Popular Badge */}
                                        {service.popular && (
                                            <div className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg">
                                                <Zap size={8} className="inline mr-1" />
                                                <span className="hidden sm:inline">Popular</span>
                                            </div>
                                        )}

                                        {/* Icon - Responsive */}
                                        <div className={`text-transparent bg-gradient-to-br ${service.gradient} bg-clip-text transition-all duration-300 group-hover:scale-110 mb-2 sm:mb-3`}>
                                            {service.icon}
                                        </div>

                                        {/* Text - Responsive */}
                                        <div className="text-center">
                                            <div className="font-bold text-zinc-900 dark:text-white text-sm sm:text-base mb-1">{service.label}</div>
                                            <div className="text-xs text-zinc-500 font-medium hidden sm:block">{service.subtitle}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Saved Places - Premium Style - Responsive */}
                <div className="space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between px-1 sm:px-2">
                        <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">{language === 'fa' ? t.rider.common.saved_places : 'Saved Places'}</h3>
                        <button className="text-xs sm:text-sm font-bold text-blue-500 hover:text-blue-600 transition-colors">{language === 'fa' ? t.rider.common.edit : 'Edit'}</button>
                    </div>

                    <div className="space-y-2 sm:space-y-3">
                        {[
                            { type: 'Home', icon: Home, data: home, color: 'from-green-500 to-emerald-600' },
                            { type: 'Work', icon: Briefcase, data: work, color: 'from-blue-500 to-indigo-600' }
                        ].map((place) => (
                            <div
                                key={place.type}
                                onClick={() => place.data ? handleSetDestination(place.data.location, place.data.address) : handleSetSavedPlace(place.type as 'Home' | 'Work')}
                                className="group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-pointer transition-all duration-300 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
                            >
                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br ${place.color} flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-105 duration-300`}>
                                    <place.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-zinc-900 dark:text-white text-sm sm:text-base">{language === 'fa' ? (place.type === 'Home' ? t.rider.common.home : t.rider.common.work) : place.type}</div>
                                    <div className="text-xs sm:text-sm text-zinc-500 truncate font-medium">
                                        {place.data ? place.data.address : (language === 'fa' ? (place.type === 'Home' ? t.rider.common.home_subtitle : t.rider.common.work_subtitle) : `Set your ${place.type.toLowerCase()} address`)}
                                    </div>
                                </div>
                                {!place.data && (
                                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                        <Plus className="w-3 h-3 sm:w-4 sm:h-4 text-zinc-400" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const MapSelectionOverlay = () => (
        <>
            {/* Top Floating Bar - Premium Style */}
            <div className="absolute top-4 left-4 right-4 z-[60] flex items-center gap-3 animate-slide-down">
                <button
                    onClick={resetFlow}
                    className="w-12 h-12 rounded-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-lg shadow-zinc-900/10 flex items-center justify-center text-zinc-900 dark:text-white transition-all hover:scale-105 active:scale-95 border border-zinc-200/50 dark:border-white/10"
                >
                    <ArrowLeft size={22} />
                </button>
                <div className="flex-1 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-full shadow-lg shadow-zinc-900/10 flex items-center px-5 h-12 border border-zinc-200/50 dark:border-white/10">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-3 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse"></div>
                    <span className="font-bold text-zinc-900 dark:text-white truncate text-sm">
                        {selectedService === 'hotel' ? 'Select Hotel' : 'Set Destination'}
                    </span>
                </div>
            </div>

            {/* Premium Center Pin */}
            {selectedService !== 'hotel' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-10 z-[55] pointer-events-none flex flex-col items-center animate-float-gentle">
                    <div className="relative">
                        {/* Glow Effect */}
                        <div className="absolute inset-0 w-16 h-16 bg-blue-500/30 rounded-full blur-xl animate-pulse-glow"></div>

                        {/* Main Pin */}
                        <div className="relative w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-full flex items-center justify-center shadow-2xl z-10">
                            <MapPin size={28} fill="currentColor" strokeWidth={2.5} />
                        </div>

                        {/* Pin Stick */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-1.5 h-10 bg-gradient-to-b from-blue-600 to-blue-800 rounded-full shadow-lg"></div>

                        {/* Shadow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-8 w-6 h-2 bg-black/20 rounded-full blur-sm"></div>
                    </div>

                    {/* Tooltip */}
                    <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-2 rounded-full shadow-xl text-xs font-bold whitespace-nowrap mt-12 transform transition-transform hover:scale-105">
                        Release to set location
                    </div>
                </div>
            )}

            {/* Bottom Action - Premium Style */}
            <div className="absolute left-6 right-6 z-[60] animate-slide-up bottom-[calc(2rem+env(safe-area-inset-bottom)+4rem)]">
                {selectedService === 'hotel' ? (
                    <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl p-5 rounded-3xl shadow-2xl border border-zinc-200/50 dark:border-white/10 text-center">
                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Tap a hotel icon on the map to select</p>
                    </div>
                ) : (
                    <Button
                        size="lg"
                        className="w-full shadow-2xl shadow-zinc-900/20 rounded-2xl h-14 text-lg font-bold bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 transition-all active:scale-[0.98] border-0"
                        onClick={handleConfirmSelection}
                    >
                        Confirm Destination
                    </Button>
                )}
            </div>
        </>
    );

    const SearchPanel = () => (
        <div className="absolute inset-0 bg-white dark:bg-zinc-950 z-[60] flex flex-col">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                    <button onClick={() => { setViewState('grid'); setSearchQuery(''); setSearchResults([]); }} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="Search destination..."
                            autoFocus
                            className="w-full h-12 px-4 pr-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border-2 border-transparent focus:border-brand-500 text-zinc-900 dark:text-white font-medium outline-none"
                        />
                        {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>}
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                {searchResults.length > 0 ? (
                    <div className="p-4 space-y-2">
                        {searchResults.map((result, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleSelectSearchResult(result)}
                                className="w-full flex items-start gap-3 p-4 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors text-left"
                            >
                                <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center shrink-0 mt-1">
                                    <MapPin size={20} className="text-brand-600 dark:text-brand-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-zinc-900 dark:text-white truncate">{result.name.split(',')[0]}</div>
                                    <div className="text-sm text-zinc-500 truncate">{result.address}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : searchQuery.length >= 3 && !isSearching ? (
                    <div className="p-8 text-center text-zinc-500">No results found</div>
                ) : (
                    <div className="p-8 text-center text-zinc-500">Type at least 3 characters to search</div>
                )}
            </div>
        </div>
    );

    const ServiceComparisonPanel = () => {
        if (!currentRoute) return null;

        // Fallback if backend did not provide distance/duration for any reason
        let distKm = currentRoute.distance && Number.isFinite(currentRoute.distance)
            ? currentRoute.distance / 1000
            : 0;
        let durMin = currentRoute.duration && Number.isFinite(currentRoute.duration)
            ? currentRoute.duration / 60
            : 0;

        // If we still don't have valid distance, estimate from pickup/destination coords
        if ((!distKm || !Number.isFinite(distKm)) && (pickupCoords || userLocation) && (destCoords || mapCenter)) {
            const start = pickupCoords || userLocation;
            const end = destCoords || mapCenter;
            const R = 6371; // km
            const toRad = (d: number) => d * (Math.PI / 180);
            const dLat = toRad(end.lat - start.lat);
            const dLng = toRad(end.lng - start.lng);
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(start.lat)) * Math.cos(toRad(end.lat)) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distKm = R * c;
        }

        // If duration is missing, estimate with avg city speed (~30km/h)
        if (!durMin || !Number.isFinite(durMin)) {
            const avgSpeedKmh = 30;
            durMin = (distKm / avgSpeedKmh) * 60;
        }

        const radiusKm = Math.max(1, Number(adminSettings?.system?.radiusLimit) || 15);
        const services = (adminSettings?.services || []).map(s => {
            let price = Math.round((distKm * s.perKm) + s.baseFare + (durMin * s.perMin));

            if (user?.loyaltyPoints) {
                const points = user.loyaltyPoints;
                let discount = 0;
                if (points >= 50) discount = 15;
                else if (points >= 30) discount = 10;
                else if (points >= 10) discount = 5;

                if (discount > 0) {
                    price = Math.round(price * (1 - discount / 100));
                }
            }

            if (isSubscribed) {
                price = Math.round(price * 0.85);
            }

            const minFare = Number(s.minFare) || Number(adminSettings?.pricing?.minFare) || 0;
            if (minFare) price = Math.max(minFare, price);

            const pickup = pickupCoords || userLocation;
            const matchingDrivers = drivers.filter(d => {
                if (d.serviceTypes && d.serviceTypes.length > 0) return d.serviceTypes.includes(s.id);
                if (s.id === 'city') return ['eco', 'plus'].includes(d.type);
                if (s.id === 'intercity') return ['lux', 'premium'].includes(d.type);
                if (s.id === 'airport') return true;
                return true;
            });

            // Keep availability & ETA consistent with the DriverSelection panel.
            const driversWithDistance = matchingDrivers
                .map(d => {
                    const distanceKm = Math.sqrt(
                        Math.pow(pickup.lat - d.location.lat, 2) +
                        Math.pow(pickup.lng - d.location.lng, 2)
                    ) * 111;
                    return { ...d, distanceKm };
                })
                .filter(d => Number.isFinite(d.distanceKm) && d.distanceKm <= radiusKm);

            const availableNearby = driversWithDistance.filter(d => d.status === 'available');
            const busyNearby = driversWithDistance.filter(d => d.status === 'busy');

            const availability: 'available' | 'busy' | 'none' =
                availableNearby.length > 0 ? 'available' :
                    busyNearby.length > 0 ? 'busy' : 'none';

            let eta = 'N/A';
            if (availability === 'available') {
                const minDistKm = Math.max(0, Math.min(...availableNearby.map(d => d.distanceKm)));
                const mins = Math.max(2, Math.round(minDistKm * 2)); // ~30km/h average
                eta = `${mins} min`;
            }

            return {
                ...s,
                price,
                eta,
                availability,
                nearbyDrivers: driversWithDistance.length,
                availableDrivers: availableNearby.length,
                busyDrivers: busyNearby.length
            };
        });

        return (
            <div className="fixed inset-x-0 bottom-0 bg-white/98 dark:bg-zinc-950/98 backdrop-blur-2xl rounded-t-[32px] sm:rounded-t-[40px] shadow-[0_-12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_-12px_40px_rgba(0,0,0,0.8)] z-[60] animate-slide-up flex flex-col h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[92vh] ring-1 ring-black/5 dark:ring-white/5">
                {/* Premium Drag Handle */}
                <div className="relative pt-safe sm:pt-6 pb-1 sm:pb-2">
                    <div className="w-12 sm:w-16 h-1.5 bg-gradient-to-r from-zinc-300 via-zinc-400 to-zinc-300 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700 rounded-full mx-auto shadow-sm"></div>
                    <div className="absolute inset-x-0 top-0 h-7 sm:h-8 bg-gradient-to-b from-white/50 dark:from-zinc-950/50 to-transparent rounded-t-[32px] sm:rounded-t-[40px]"></div>
                </div>

                {/* Header Section - Responsive */}
                <div className="px-3 sm:px-6 lg:px-8 pb-3 sm:pb-6 border-b border-zinc-100/80 dark:border-zinc-800/80 shrink-0">
                    <div className="flex justify-between items-start mb-2 sm:mb-4">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-display font-black text-lg sm:text-3xl text-zinc-900 dark:text-white tracking-tight leading-tight mb-1 sm:mb-2">
                                {scheduledTime ? `Scheduled: ${scheduledTime.split(' ')[1]}` : 'Choose Your Ride'}
                            </h3>
                            <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium flex-wrap">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                    <span>To <span className="text-zinc-900 dark:text-white font-bold truncate max-w-[120px] sm:max-w-none">{destination}</span></span>
                                </div>
                                <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600 hidden sm:block"></div>
                                <span className="text-zinc-400">{distKm.toFixed(1)} km • {Math.round(durMin)} min</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setViewState('selecting')}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all duration-300 shadow-sm hover:shadow-md shrink-0 ml-3 sm:ml-4"
                        >
                            <X size={16} strokeWidth={2.5} />
                        </button>
                    </div>

                    {/* Premium Status Indicators - Responsive */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        {/* Payment Method */}
                        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-xs font-bold text-green-700 dark:text-green-400">Cash Payment</span>
                        </div>

                        {/* Subscription Badge */}
                        {isSubscribed && (
                            <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25">
                                <Zap size={12} className="text-yellow-300" />
                                <span className="text-xs font-bold">Pass Active</span>
                            </div>
                        )}

                        {/* Promo Applied Badge */}
                        {promoApplied && promoDiscount > 0 && (
                            <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20">
                                <Tag size={12} className="text-purple-500" />
                                <span className="text-xs font-bold text-purple-700 dark:text-purple-400">-؋{promoDiscount}</span>
                            </div>
                        )}

                        {/* Loyalty Points */}
                        {user?.loyaltyPoints && user.loyaltyPoints > 0 && (
                            <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                                <Star size={12} className="text-amber-500 fill-amber-500" />
                                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{user.loyaltyPoints} pts</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Service Options - Responsive Grid */}
                <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y px-3 sm:px-6 lg:px-8 py-3 sm:py-4 space-y-2.5 sm:space-y-4 pb-64 sm:pb-40">
                    {services.map((service, index) => {
                        const isSelected = selectedService === service.id;
                        const isRecommended = index === 0 && service.availability === 'available';
                        const isEmpty = service.availability === 'none';
                        const iconKey = String((service as any)?.icon || '').toLowerCase();

                        return (
                            <div
                                key={service.id}
                                onClick={() => handleSelectServiceFromCompare(service.id as ServiceType, service.price)}
                                className={`group relative overflow-hidden transition-all duration-500 cursor-pointer ${isSelected
                                    ? 'scale-[1.02]'
                                    : 'hover:scale-[1.01]'
                                    } ${isEmpty ? 'opacity-90' : ''}`}
                            >
                                {/* Background Glow */}
                                {isSelected && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl sm:rounded-3xl blur-xl"></div>
                                )}

                                {/* Main Card - Responsive */}
                                <div className={`relative p-3 sm:p-6 rounded-2xl sm:rounded-3xl border-2 transition-all duration-500 ${isSelected
                                    ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 shadow-xl shadow-blue-500/20'
                                    : isEmpty
                                        ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700'
                                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg'
                                    }`}>

                                    {/* Recommended Badge */}
                                    {isRecommended && (
                                        <div className="absolute -top-2 left-3 sm:left-6 px-2.5 sm:px-3 py-0.5 sm:py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[11px] sm:text-xs font-bold rounded-full shadow-lg shadow-green-500/30">
                                            <div className="flex items-center gap-1">
                                                <Zap size={10} className="text-yellow-300" />
                                                Recommended
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 sm:gap-5">
                                        {/* Service Icon - Responsive */}
                                        <div className={`relative w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 ${isEmpty
                                            ? 'bg-zinc-200 dark:bg-zinc-800'
                                            : isSelected
                                                ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30'
                                                : 'bg-zinc-100 dark:bg-zinc-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10'
                                            }`}>
                                            {/* Icon Glow */}
                                            {isSelected && (
                                                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl sm:rounded-2xl blur-lg opacity-50"></div>
                                            )}

                                            <div className={`relative transition-all duration-500 ${isEmpty
                                                ? 'text-zinc-400 dark:text-zinc-600'
                                                : isSelected
                                                    ? 'text-white scale-110'
                                                    : 'text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-105'
                                                }`}>
                                                {iconKey === 'plane' || iconKey === 'airplane' ? (
                                                    <Plane size={28} strokeWidth={2} className="w-7 h-7 sm:w-9 sm:h-9" />
                                                ) : iconKey === 'map-pin' || iconKey === 'pin' ? (
                                                    <MapPin size={28} strokeWidth={2} className="w-7 h-7 sm:w-9 sm:h-9" />
                                                ) : (
                                                    <Car size={28} strokeWidth={2} className="w-7 h-7 sm:w-9 sm:h-9" />
                                                )}
                                            </div>

                                            {/* Premium Badge */}
                                            {service.id === 'airport' && (
                                                <div className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                                                    <Star size={10} className="sm:w-3 sm:h-3 text-white fill-white" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Service Details - Responsive */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-2 sm:mb-3">
                                                <div className="min-w-0 flex-1">
                                                    <h4 className={`font-bold text-base sm:text-xl transition-colors duration-300 truncate ${isEmpty
                                                        ? 'text-zinc-600 dark:text-zinc-300'
                                                        : 'text-zinc-900 dark:text-white'
                                                        }`}>
                                                        {service.name}
                                                    </h4>
                                                    <p className={`text-[11px] sm:text-sm font-medium mt-1 ${isEmpty
                                                        ? 'text-zinc-500 dark:text-zinc-400'
                                                        : 'text-zinc-500 dark:text-zinc-400'
                                                        }`}>
                                                        {service.id === 'city' ? 'Affordable everyday rides' :
                                                            service.id === 'intercity' ? 'Comfortable long distance' :
                                                                service.id === 'airport' ? 'Premium airport service' : 'Standard service'}
                                                    </p>
                                                </div>

                                                {/* Price - Responsive */}
                                                <div className="text-right ml-3">
                                                    <div className={`font-black text-lg sm:text-2xl transition-colors duration-300 ${isSelected
                                                        ? 'text-blue-600 dark:text-blue-400'
                                                        : isEmpty
                                                            ? 'text-zinc-700 dark:text-zinc-200'
                                                            : 'text-zinc-900 dark:text-white'
                                                        }`}>
                                                        ؋{service.price}
                                                    </div>
                                                    {user?.loyaltyPoints && user.loyaltyPoints > 10 && (
                                                        <div className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">
                                                            {user.loyaltyPoints >= 50 ? '15%' : user.loyaltyPoints >= 30 ? '10%' : '5%'} off
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Service Stats - Responsive */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3 sm:gap-4">
                                                    {/* ETA */}
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={12} className={`sm:w-3.5 sm:h-3.5 ${service.availability === 'available'
                                                            ? 'text-blue-500'
                                                            : service.availability === 'busy'
                                                                ? 'text-amber-500'
                                                                : 'text-zinc-400 dark:text-zinc-500'
                                                            }`} />
                                                        <span className={`text-xs sm:text-sm font-bold ${service.availability === 'available'
                                                            ? (service.eta !== 'N/A' ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400')
                                                            : service.availability === 'busy'
                                                                ? 'text-amber-600 dark:text-amber-400'
                                                                : 'text-zinc-500 dark:text-zinc-400'
                                                            }`}>
                                                            {service.availability === 'available' ? service.eta : service.availability === 'busy' ? 'Busy' : 'No drivers'}
                                                        </span>
                                                    </div>

                                                    {/* Capacity */}
                                                    <div className="flex items-center gap-2">
                                                        <User size={12} className={`sm:w-3.5 sm:h-3.5 ${isEmpty
                                                            ? 'text-zinc-400 dark:text-zinc-500'
                                                            : 'text-zinc-500 dark:text-zinc-400'
                                                            }`} />
                                                        <span className={`text-xs sm:text-sm font-medium ${isEmpty
                                                            ? 'text-zinc-500 dark:text-zinc-400'
                                                            : 'text-zinc-500 dark:text-zinc-400'
                                                            }`}>
                                                            {service.id === 'intercity' ? '6' : '4'} seats
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Selection Indicator */}
                                                {isSelected && (
                                                    <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                                        <Check size={10} className="sm:w-3.5 sm:h-3.5 text-white" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom Action Area - Responsive */}
                <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-6 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95 dark:to-transparent pt-4 sm:pt-16 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] z-50">
                    {/* Taxi Type (Req #10) */}
                    <div className="mb-3 sm:mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                                Taxi Type
                            </div>
                            {selectedTaxiType && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedTaxiType(null)}
                                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="flex flex-nowrap gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1">
                            <button
                                type="button"
                                onClick={() => setSelectedTaxiType(null)}
                                className={`shrink-0 px-2.5 py-1 sm:px-4 sm:py-2 rounded-lg sm:rounded-2xl border text-[10px] sm:text-xs leading-none font-bold transition-colors ${!selectedTaxiType ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/90 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-200 border-zinc-200/60 dark:border-zinc-800'}`}
                            >
                                Any
                            </button>
                            {Object.values(TAXI_TYPES).map((t) => {
                                const isSelected = selectedTaxiType?.id === t.id;
                                const allowed =
                                    selectedService === 'city' ? ['eco', 'plus'] :
                                        selectedService === 'intercity' ? ['lux', 'premium'] :
                                            ['eco', 'plus', 'lux', 'premium'];
                                const disabled = !allowed.includes(t.id);

                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => setSelectedTaxiType(t)}
                                        className={`shrink-0 px-2.5 py-1 sm:px-4 sm:py-2 rounded-lg sm:rounded-2xl border text-[10px] sm:text-xs leading-none font-bold transition-colors flex items-center gap-1.5 sm:gap-2 ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white/90 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-200 border-zinc-200/60 dark:border-zinc-800'}`}
                                    >
                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style={{ backgroundColor: t.color }} />
                                        {t.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Promo Code Input */}
                    <div className="mb-3 sm:mb-4">
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input
                                    type="text"
                                    value={promoCode}
                                    onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoApplied(false); setPromoDiscount(0); }}
                                    placeholder="Promo code"
                                    disabled={promoApplied}
                                    className="w-full h-10 pl-8 pr-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:border-purple-400 disabled:opacity-60"
                                />
                            </div>
                            <button
                                onClick={promoApplied ? () => { setPromoApplied(false); setPromoDiscount(0); setPromoCode(''); } : handleApplyPromo}
                                disabled={promoLoading || (!promoCode.trim() && !promoApplied)}
                                className={`px-4 h-10 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${
                                    promoApplied
                                        ? 'bg-green-500 text-white hover:bg-red-500'
                                        : 'bg-purple-600 text-white hover:bg-purple-700'
                                }`}
                            >
                                {promoLoading ? '...' : promoApplied ? '✓ Applied' : 'Apply'}
                            </button>
                        </div>
                    </div>

                    {/* Multi-stop toggle */}
                    <div className="mb-3 sm:mb-4">
                        <button
                            onClick={() => setShowMultiStop(v => !v)}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <Route size={16} className="text-blue-500" />
                                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Multi-Stop Ride</span>
                                {extraStops.length > 0 && (
                                    <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{extraStops.length} stop{extraStops.length > 1 ? 's' : ''}</span>
                                )}
                            </div>
                            <ChevronDown size={14} className={`text-zinc-400 transition-transform ${showMultiStop ? 'rotate-180' : ''}`} />
                        </button>
                        {showMultiStop && (
                            <div className="mt-2 space-y-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                {extraStops.map((stop, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{idx + 1}</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={stop.address}
                                            onChange={e => setExtraStops(prev => prev.map((s, i) => i === idx ? { ...s, address: e.target.value } : s))}
                                            placeholder={`Stop ${idx + 1} address`}
                                            className="flex-1 h-9 px-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm outline-none focus:border-blue-400"
                                        />
                                        <button onClick={() => handleRemoveStop(idx)} className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                            <X size={12} className="text-red-500" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={handleAddStop}
                                    className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-500 text-sm font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                    <Plus size={14} /> Add Stop
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Premium Fare Negotiation Section */}
                    {showFareInput ? (
                        <div className="relative overflow-hidden bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-zinc-950 dark:via-blue-950/20 dark:to-purple-950/20 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-blue-500/50 shadow-2xl shadow-blue-500/25 mb-3 sm:mb-4 animate-scale-up backdrop-blur-xl">
                            {/* Background Glow */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl sm:rounded-3xl blur-xl"></div>

                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-3 sm:mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                            <DollarSign size={20} className="text-white" />
                                            </div>
                                            <div>
                                                <label className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">Negotiate Your Fare</label>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Propose a fair price for your ride</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowFareInput(false)}
                                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/80 dark:bg-zinc-800/80 hover:bg-white dark:hover:bg-zinc-800 flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl backdrop-blur-sm border border-zinc-200/50 dark:border-zinc-700/50"
                                    >
                                        <X size={16} className="text-zinc-500 dark:text-zinc-400" />
                                    </button>
                                </div>

                                {/* Premium Input Field */}
                                <div className="relative">
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-lg opacity-50"></div>
                                    <div className="relative flex items-center bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-2xl px-4 py-3 border-2 border-white/50 dark:border-zinc-800/50 shadow-xl">
                                        <div className="flex items-center gap-3 mr-3">
                                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                                                <span className="text-white font-bold text-sm">؋</span>
                                            </div>
                                        </div>
                                        <input
                                            type="number"
                                            value={proposedFare}
                                            onChange={(e) => setProposedFare(e.target.value)}
                                            placeholder="Enter your offer"
                                            className="flex-1 bg-transparent text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                                            autoFocus
                                        />
                                        <div className="text-xs sm:text-sm font-bold text-zinc-500 dark:text-zinc-400 ml-2 sm:ml-3">
                                            AFN
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Amount Suggestions */}
                                <div className="flex items-center gap-2 mt-3 sm:mt-4">
                                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mr-2">Quick:</span>
                                    {[100, 200, 300, 500].map(amount => (
                                        <button
                                            key={amount}
                                            onClick={() => setProposedFare(amount.toString())}
                                            className="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 border border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-600"
                                        >
                                            ؋{amount}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="relative group mb-3 sm:mb-4">
                            {/* Background Glow */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                            <button
                                onClick={() => setShowFareInput(true)}
                                className="relative w-full p-3 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-zinc-950 dark:via-blue-950/20 dark:to-purple-950/20 hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-950/30 dark:hover:to-purple-950/30 transition-all duration-500 border-2 border-zinc-200/50 dark:border-zinc-800/50 hover:border-blue-300/50 dark:hover:border-blue-600/50 shadow-lg hover:shadow-2xl backdrop-blur-sm group-active:scale-[0.98]"
                            >
                                <div className="flex items-center justify-center gap-4">
                                    {/* Premium Icon */}
                                    <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl shadow-blue-500/30 transition-transform group-hover:scale-110 duration-300">
                                        <DollarSign size={20} className="text-white animate-bounce" />
                                    </div>

                                    {/* Text Content */}
                                    <div className="flex-1 text-left">
                                        <div className="text-base sm:text-xl font-black text-zinc-900 dark:text-white mb-0.5 sm:mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                                            Negotiate Your Fare
                                        </div>
                                        <div className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
                                            Propose a custom price for your ride
                                        </div>
                                    </div>

                                    {/* Arrow Icon */}
                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center transition-transform group-hover:translate-x-1 duration-300">
                                        <ChevronDown size={14} className="text-zinc-500 dark:text-zinc-400 rotate-[-90deg]" />
                                    </div>
                                </div>

                                {/* Floating Badge */}
                                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg shadow-green-500/30">
                                    <Zap size={10} className="inline mr-1" />
                                    Save More
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Request Button */}
                    <div className="flex gap-3">
                        <Button
                            size="lg"
                            variant="secondary"
                            className="flex-1 h-11 sm:h-14 text-sm sm:text-lg font-bold rounded-2xl bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                            onClick={handleOpenDriverSelection}
                        >
                            <User size={16} className="mr-2" />
                            Select Driver
                        </Button>
                        <Button
                            size="lg"
                            variant="gradient"
                            className="flex-1 h-11 sm:h-14 text-sm sm:text-lg font-bold rounded-2xl"
                            onClick={handleRequestRide}
                        >
                            Request Any Driver
                        </Button>
                    </div>
                </div>
            </div>
        );
    };



    // --- Main Render ---

    if (activeRide && activeRide.status !== 'cancelled' && activeRide.status !== 'completed') {
        // Only show the active driver's car to the rider
        const activeDriverMarkers = activeRide.driverId
            ? drivers.filter(d => d.id === activeRide.driverId)
            : filteredDrivers;

        return (
            <div className="absolute inset-0 w-full">
                <MapBackground
                    pickup={activeRide.pickupLocation}
                    destination={activeRide.destinationLocation}
                    route={activeRide.route}
                    drivers={activeDriverMarkers}
                    // If accepted, focus on driver+pickup. If in_progress, focus on driver+dest.
                    zoom={15}
                />
                <ActiveTripPanel
                    activeRide={activeRide}
                    drivers={drivers}
                    destination={destination}
                    etaText={etaText}
                    handleContactDriver={handleContactDriver}
                    handleWhatsAppContact={handleWhatsAppContact}
                    updateRideStatus={updateRideStatus}
                    resetFlow={resetFlow}
                    addToast={addToast}
                />
            </div>
        );
    }

    return (
        <div className="absolute inset-0 w-full bg-zinc-50 dark:bg-zinc-950">
            {/* Map */}
            <MapBackground
                pickup={pickupCoords || userLocation}
                destination={destCoords}
                route={currentRoute}
                showHotels={selectedService === 'hotel'}
                hotels={hotels}
                drivers={filteredDrivers}
                onCameraChange={viewState === 'selecting' ? handleCameraChange : undefined}
                center={mapCenter}
                zoom={selectedService === 'hotel' ? 13 : 16}
            />

            {/* Premium Top Bar */}
            {viewState === 'grid' && (
                <div className="absolute top-0 left-0 right-0 p-4 pt-safe flex justify-between items-center z-20 pointer-events-none">
                    <button
                        onClick={() => setView('notifications')}
                        className="relative w-12 h-12 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-full shadow-lg shadow-zinc-900/10 flex items-center justify-center text-zinc-900 dark:text-white pointer-events-auto border border-zinc-200/50 dark:border-white/10 transition-transform active:scale-95 hover:bg-white dark:hover:bg-zinc-900"
                        aria-label="Notifications"
                    >
                        <Bell size={22} strokeWidth={2.5} />
                        {unreadNotifications > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950">
                                {unreadNotifications > 9 ? '9+' : unreadNotifications}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setView('profile')}
                        className="w-12 h-12 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-full shadow-lg shadow-zinc-900/10 flex items-center justify-center text-zinc-900 dark:text-white pointer-events-auto border border-zinc-200/50 dark:border-white/10 overflow-hidden transition-transform active:scale-95 hover:border-zinc-300 dark:hover:border-zinc-600"
                        aria-label="Profile"
                    >
                        <img src={`https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=random`} alt="Profile" className="w-full h-full object-cover" />
                    </button>
                </div>
            )}

            {/* Premium Recenter Button */}
            <div className={`absolute right-4 z-10 pointer-events-auto transition-all ${viewState === 'grid' ? 'top-20' : 'top-4'}`}>
                <button
                    onClick={() => setMapCenter(userLocation)}
                    className="w-12 h-12 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-full shadow-lg shadow-zinc-900/10 flex items-center justify-center text-zinc-900 dark:text-white active:scale-95 transition-all border border-zinc-200/50 dark:border-white/10 hover:bg-white dark:hover:bg-zinc-900"
                >
                    <Navigation size={20} className="text-zinc-900 dark:text-white" strokeWidth={2.5} />
                </button>
            </div>

            {/* UI Layers */}
            {viewState === 'grid' && <ServiceGrid />}
            {viewState === 'search' && <SearchPanel />}
            {viewState === 'selecting' && <MapSelectionOverlay />}
            {viewState === 'compare' && <ServiceComparisonPanel />}
            {viewState === 'drivers' && (
                <DriverSelectionPanel
                    currentRoute={currentRoute}
                    destCoords={destCoords}
                    pickupCoords={pickupCoords}
                    userLocation={userLocation}
                    filteredDrivers={filteredDrivers}
                    selectedService={selectedService}
                    destination={destination}
                    scheduledTime={scheduledTime}
                    proposedFare={proposedFare}
                    setViewState={setViewState}
                    addToast={addToast}
                />
            )}

            <ScheduleModal />
            <SubsModal />
        </div>
    );
};
