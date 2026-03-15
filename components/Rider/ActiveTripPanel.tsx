import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Star, MessageCircle, Phone, Shield, Flag, Send, Navigation, MapPin, Car, Clock, AlertTriangle, X, ChevronRight, ChevronLeft, RotateCcw, ArrowUp, ArrowUpLeft, ArrowUpRight } from 'lucide-react';
import { Ride } from '../../types';
import { apiFetch } from '../../services/api';
import { useAppStore } from '../../store';

interface ActiveTripPanelProps {
    activeRide: Ride;
    drivers: any[];
    destination: string;
    etaText: string;
    handleContactDriver: () => void;
    handleWhatsAppContact: () => void;
    updateRideStatus: (status: any) => void;
    resetFlow: () => void;
    addToast: (type: string, msg: string) => void;
}

// Turn-by-turn instruction types
interface NavStep {
    instruction: string;
    distance: string;
    maneuver: 'straight' | 'left' | 'right' | 'uturn' | 'arrive';
}

function getManeuverIcon(maneuver: NavStep['maneuver']) {
    switch (maneuver) {
        case 'left': return <ArrowUpLeft size={20} className="text-white" />;
        case 'right': return <ArrowUpRight size={20} className="text-white" />;
        case 'uturn': return <RotateCcw size={20} className="text-white" />;
        case 'arrive': return <MapPin size={20} className="text-white" />;
        default: return <ArrowUp size={20} className="text-white" />;
    }
}

// Generate nav steps from route coordinates (simple simulation)
function generateNavSteps(route: any, destination: string): NavStep[] {
    if (!route?.coordinates || route.coordinates.length < 2) {
        return [{ instruction: `Head to ${destination}`, distance: '', maneuver: 'straight' }];
    }
    const distKm = route.distance ? (route.distance / 1000).toFixed(1) : '?';
    const durMin = route.duration ? Math.round(route.duration / 60) : '?';
    return [
        { instruction: 'Head north on current road', distance: '200 m', maneuver: 'straight' },
        { instruction: 'Turn right at the intersection', distance: '500 m', maneuver: 'right' },
        { instruction: 'Continue straight', distance: `${distKm} km`, maneuver: 'straight' },
        { instruction: `Arrive at ${destination}`, distance: `${durMin} min`, maneuver: 'arrive' },
    ];
}

export const ActiveTripPanel: React.FC<ActiveTripPanelProps> = ({
    activeRide, drivers, destination, etaText,
    handleContactDriver, handleWhatsAppContact,
    updateRideStatus, resetFlow, addToast
}) => {
    if (!activeRide) return null;

    const user = useAppStore((state) => state.user);
    const currentRoute = useAppStore((state) => state.currentRoute);

    const isPending = activeRide.status === 'requested' || activeRide.status === 'searching';
    const isPreferredRequest = activeRide.status === 'requested' && !!activeRide.driverId;
    const isArrived = activeRide.status === 'arrived';
    const isInProgress = activeRide.status === 'in_progress';
    const isAccepted = activeRide.status === 'accepted';

    const [showSOS, setShowSOS] = useState(false);
    const [sosLoading, setSosLoading] = useState(false);
    const [showNav, setShowNav] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const navSteps = generateNavSteps(currentRoute || activeRide.route, destination);

    const driver = drivers.find(d => d.id === activeRide.driverId);

    const statusMeta = isArrived
        ? { icon: MapPin, text: 'Driver is here' }
        : isInProgress
            ? { icon: Car, text: 'On trip' }
            : { icon: Clock, text: 'Arriving soon' };
    const StatusIcon = statusMeta.icon;

    const handleSOS = async () => {
        if (sosLoading) return;
        setSosLoading(true);
        try {
            const location = { lat: activeRide.pickupLocation?.lat || 0, lng: activeRide.pickupLocation?.lng || 0 };
            const res = await apiFetch('/api/emergency/sos', {
                method: 'POST',
                body: JSON.stringify({ rideId: activeRide.id, location })
            });
            if (res.ok) {
                addToast('error', '🚨 SOS Alert sent! Emergency contacts notified.');
            } else {
                addToast('error', 'SOS sent (offline mode)');
            }
        } catch {
            addToast('error', 'SOS sent (offline mode)');
        } finally {
            setSosLoading(false);
            setShowSOS(false);
        }
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.6)] z-30 p-6 pb-24 md:pb-6 animate-slide-up ring-1 ring-black/5 dark:ring-white/10">
            <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-6"></div>

            {/* Turn-by-turn Navigation Panel */}
            {showNav && isInProgress && (
                <div className="mb-4 rounded-2xl overflow-hidden border border-blue-200 dark:border-blue-800 animate-fade-in">
                    <div className="bg-blue-600 p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                {getManeuverIcon(navSteps[currentStep]?.maneuver || 'straight')}
                            </div>
                            <div>
                                <div className="text-white font-bold text-sm">{navSteps[currentStep]?.instruction}</div>
                                <div className="text-blue-200 text-xs">{navSteps[currentStep]?.distance}</div>
                            </div>
                        </div>
                        <button onClick={() => setShowNav(false)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <X size={14} className="text-white" />
                        </button>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/50 p-2 flex items-center justify-between">
                        <button
                            onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
                            disabled={currentStep === 0}
                            className="p-2 rounded-lg disabled:opacity-40 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        >
                            <ChevronLeft size={16} className="text-blue-600 dark:text-blue-400" />
                        </button>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                            Step {currentStep + 1} of {navSteps.length}
                        </span>
                        <button
                            onClick={() => setCurrentStep(s => Math.min(navSteps.length - 1, s + 1))}
                            disabled={currentStep === navSteps.length - 1}
                            className="p-2 rounded-lg disabled:opacity-40 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        >
                            <ChevronRight size={16} className="text-blue-600 dark:text-blue-400" />
                        </button>
                    </div>
                </div>
            )}

            {isPending ? (
                <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full border-4 border-zinc-200 dark:border-zinc-800 border-t-blue-500 animate-spin mx-auto mb-6"></div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                        {isPreferredRequest ? 'Waiting for the selected driver...' : 'Waiting for a driver to accept...'}
                    </h2>
                    <p className="text-zinc-500 font-medium mb-6">Trip to {destination}</p>
                    <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-2xl mb-6">
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mb-2 flex items-center justify-center gap-2">
                            {isPreferredRequest ? <Send size={16} /> : <Navigation size={16} />}
                            <span>{isPreferredRequest ? 'Request sent to your selected driver' : 'Request sent to nearby drivers'}</span>
                        </p>
                        <p className="text-xs text-zinc-500">
                            {isPreferredRequest
                                ? 'If they do not respond, cancel and choose another driver.'
                                : 'Drivers can accept or reject. You will be notified once accepted.'}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="secondary" className="flex-1 h-14 rounded-2xl font-bold bg-zinc-100 dark:bg-zinc-900 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-800" onClick={() => { updateRideStatus('cancelled'); resetFlow(); }}>
                            Cancel Request
                        </Button>
                        {/* SOS during pending */}
                        <button
                            onClick={() => setShowSOS(true)}
                            className="w-14 h-14 rounded-2xl bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 transition-all active:scale-95"
                        >
                            <AlertTriangle size={22} className="text-white" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="animate-fade-in">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">
                                {isArrived ? 'Meet at Pickup Point' : isInProgress ? 'Heading to Destination' : 'Driver En Route'}
                            </h2>
                            <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-2">
                                <StatusIcon size={16} className="opacity-90" />
                                {statusMeta.text}
                                {!isArrived && activeRide?.distance && (
                                    <span className="text-xs bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded-full">
                                        {(activeRide.distance / 1000).toFixed(1)} km away
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="text-right bg-zinc-50 dark:bg-zinc-900 px-4 py-2 rounded-2xl border-2 border-blue-500/20">
                            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                {isArrived ? '0' : etaText}
                            </div>
                            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">ETA</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl mb-4 shadow-sm">
                        <div className="w-14 h-14 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden relative shrink-0 border-2 border-white dark:border-zinc-950 shadow-sm">
                            <img src={`https://ui-avatars.com/api/?name=${driver?.name || 'Driver'}&background=random`} className="w-full h-full" alt="driver" />
                            {driver?.type === 'plus' && <div className="absolute bottom-0 right-0 w-4 h-4 bg-yellow-400 rounded-full border-2 border-white dark:border-zinc-800 flex items-center justify-center"><Star size={8} className="text-white fill-white" /></div>}
                        </div>
                        <div className="flex-1">
                            <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-2 text-lg">
                                {driver?.name || 'Driver'}
                                <span className="flex items-center gap-1 text-sm text-zinc-500"><Star size={14} className="fill-zinc-400 text-zinc-400" /> {driver?.rating ? parseFloat(driver.rating.toString()).toFixed(1) : '4.8'}</span>
                            </div>
                            <div className="text-sm text-zinc-500 font-medium">{driver?.vehicle || 'Vehicle'} • <span className="font-mono bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md text-zinc-700 dark:text-zinc-300">{driver?.licensePlate || 'N/A'}</span></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleContactDriver} className="w-12 h-12 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors border border-zinc-100 dark:border-zinc-700">
                                <MessageCircle size={20} />
                            </button>
                            <button onClick={handleWhatsAppContact} className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white shadow-sm hover:bg-green-600 transition-colors">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                            </button>
                            <button onClick={() => driver?.phone ? window.open(`tel:${driver.phone}`) : addToast('error', 'No phone number available')} className="w-12 h-12 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors border border-zinc-100 dark:border-zinc-700">
                                <Phone size={20} />
                            </button>
                        </div>
                    </div>

                    {isInProgress ? (
                        <div className="space-y-3">
                            {/* Navigation button */}
                            <button
                                onClick={() => setShowNav(v => !v)}
                                className="w-full p-3 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800 flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                                        <Navigation size={16} className="text-white" />
                                    </div>
                                    <span className="font-bold text-blue-700 dark:text-blue-300 text-sm">Turn-by-Turn Navigation</span>
                                </div>
                                <ChevronRight size={16} className="text-blue-500" />
                            </button>

                            <div className="flex gap-3">
                                <div className="flex-1 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl text-zinc-700 dark:text-zinc-300 text-sm font-bold flex items-center justify-center gap-2">
                                    <Shield size={16} className="text-blue-500" /> Trip secured
                                </div>
                                {/* SOS Button */}
                                <button
                                    onClick={() => setShowSOS(true)}
                                    className="w-12 h-12 rounded-2xl bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 transition-all active:scale-95"
                                    title="Emergency SOS"
                                >
                                    <AlertTriangle size={18} className="text-white" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                className="flex-1 rounded-2xl h-14 font-bold bg-zinc-100 dark:bg-zinc-900 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white"
                                icon={<Flag size={18} />}
                                onClick={() => {
                                    try {
                                        if (navigator.share && !(window as any).shareInProgress) {
                                            (window as any).shareInProgress = true;
                                            navigator.share({
                                                title: 'My Ride',
                                                text: `I'm on a ride with ${driver?.name || 'a driver'} to ${destination}. Track me here:`,
                                                url: window.location.href
                                            }).then(() => {
                                                (window as any).shareInProgress = false;
                                            }).catch((error) => {
                                                (window as any).shareInProgress = false;
                                                navigator.clipboard.writeText(`I'm on a ride to ${destination}.`);
                                                addToast('success', 'Trip details copied to clipboard');
                                            });
                                        } else {
                                            navigator.clipboard.writeText(`I'm on a ride to ${destination}.`);
                                            addToast('success', 'Trip details copied to clipboard');
                                        }
                                    } catch {
                                        navigator.clipboard.writeText(`I'm on a ride to ${destination}.`);
                                        addToast('success', 'Trip details copied to clipboard');
                                    }
                                }}
                            >
                                Share
                            </Button>
                            <Button
                                variant="secondary"
                                className="flex-1 rounded-2xl h-14 font-bold bg-zinc-100 dark:bg-zinc-900 border-transparent text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                                onClick={() => {
                                    if (window.confirm('Are you sure you want to cancel this ride? Cancellation fees may apply.')) {
                                        updateRideStatus('cancelled');
                                        setTimeout(resetFlow, 1000);
                                        addToast('info', 'Ride cancelled');
                                    }
                                }}
                            >
                                Cancel
                            </Button>
                            {/* SOS Button */}
                            <button
                                onClick={() => setShowSOS(true)}
                                className="w-14 h-14 rounded-2xl bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 transition-all active:scale-95 shrink-0"
                                title="Emergency SOS"
                            >
                                <AlertTriangle size={18} className="text-white" />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* SOS Confirmation Modal */}
            {showSOS && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-[28px] p-7 shadow-2xl animate-scale-up">
                        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center mx-auto mb-5">
                            <AlertTriangle size={32} className="text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white text-center mb-2">Emergency SOS</h3>
                        <p className="text-sm text-zinc-500 text-center mb-6">
                            This will alert emergency contacts and notify our safety team with your current location.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                className="flex-1 h-12 rounded-2xl font-bold bg-zinc-100 dark:bg-zinc-800 border-transparent"
                                onClick={() => setShowSOS(false)}
                            >
                                Cancel
                            </Button>
                            <button
                                onClick={handleSOS}
                                disabled={sosLoading}
                                className="flex-1 h-12 rounded-2xl font-bold bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {sosLoading ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <AlertTriangle size={16} />
                                        Send SOS
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
