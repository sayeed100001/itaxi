import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../store.js';
import type { Location, Ride } from '../types.js';
import { SOCKET_URL } from '../src/config/api.js';

class SocketService {
    private socket: Socket | null = null;
    private isConnected: boolean = false;
    private isConnecting: boolean = false;
    private authToken: string | null = null;
    private desiredRoom: string | null = null;
    private connectTimer: ReturnType<typeof setTimeout> | null = null;

    // Queue only critical actions while connecting (avoid backlogging high-frequency telemetry)
    private pending: Array<{ event: string; data: any }> = [];
    private readonly MAX_PENDING = 25;
    private readonly QUEUEABLE = new Set(['accept_ride', 'send_message']);

    connect() {
        const token = (typeof window !== 'undefined') ? window.localStorage.getItem('token') : null;

        // If we already have a socket instance, don't create another one.
        // If token changed (login/logout), recreate to ensure server-side auth data is correct.
        if (this.socket) {
            const tokenChanged = (token || null) !== (this.authToken || null);
            if (!tokenChanged) return;
            this.disconnect();
        }

        if (this.isConnecting) return;
        if (this.connectTimer) return;

        this.isConnecting = true;
        this.isConnected = false;
        this.authToken = token || null;

        const start = () => {
            this.connectTimer = null;
            console.log("Connecting to iTaxi Server...");

            this.socket = io(SOCKET_URL, {
                transports: ['polling', 'websocket'],
                timeout: 20000,
                auth: token ? { token } : {},
                reconnection: false,
                reconnectionAttempts: 0
            });

        this.socket.on('connect', () => {
            this.isConnected = true;
            this.isConnecting = false;
            console.log(`✅ Connected to iTaxi Server: ${SOCKET_URL}`);

            // Join personal room for the current user (used for rider/driver direct events).
            const store = useAppStore.getState();
            const userId = this.desiredRoom || store.user?.id;
            if (userId) {
                this.desiredRoom = userId;
                this.socket?.emit('join_room', userId);
            }

            // Flush queued critical events (accept_ride, send_message, etc.)
            this.flushPending();
        });

        this.socket.on('connect_error', (err) => {
            // Keep this log minimal; socket.io will retry.
            this.isConnected = false;
            this.isConnecting = false;
            console.warn('Socket connection error:', err?.message || err);
        });

        this.socket.on('disconnect', () => {
            this.isConnected = false;
            this.isConnecting = false;
            console.log("❌ Disconnected from iTaxi Server");
        });

        // Listen for real-time events
        this.socket.on('new_ride_request', (data) => {
            const store = useAppStore.getState();
            if (store.currentRole === 'driver' && store.user) {
                // Check if driver is online and available
                const myDriver = store.drivers.find(d => d.id === store.user?.id);
                if (myDriver && myDriver.status === 'available') {
                    store.addToast('info', 'New ride request nearby!');
                    store.setIncomingRideRequest(data);
                }
            }
        });

        this.socket.on('ride_accepted', (data) => {
            const store = useAppStore.getState();
            const activeRide = store.activeRide;
            if (!activeRide || activeRide.id !== data.rideId) return;

                // Update ride with driver info
                const updatedRide: Ride = { 
                    ...activeRide, 
                    status: 'accepted',
                    driverId: data.driverId
                };
                
                useAppStore.setState({ activeRide: updatedRide });
                
                // Add driver to drivers list if not present
                if (data.driver && !store.drivers.find(d => d.id === data.driverId)) {
                    const newDriver = {
                        id: data.driverId,
                        name: data.driver.name,
                        phone: data.driver.phone,
                        rating: data.driver.rating || 4.8,
                        vehicle: data.driver.vehicle || 'Vehicle',
                        licensePlate: data.driver.licensePlate || 'N/A',
                        location: data.driver.location || { lat: 0, lng: 0, bearing: 0 },
                        status: 'busy' as const,
                        type: 'eco' as const,
                        serviceTypes: ['city'],
                        baseFare: 50,
                        perKmRate: 20,
                        totalRides: 0,
                        earnings: 0
                    };
                    
                    store.updateDrivers([...store.drivers, newDriver]);
                }
                
                store.addToast('success', `Driver ${data.driver?.name || 'assigned'} accepted your ride!`);
        });

        // Driver-side acknowledgement for accept_ride.
        this.socket.on('ride_accepted_success', (data: { rideId: string }) => {
            const store = useAppStore.getState();
            if (store.currentRole !== 'driver') return;

            const req = store.incomingRequest;
            if (!req || req.id !== data.rideId) return;

            const driverId = store.user?.id;
            store.startRide({ ...req, status: 'accepted', driverId: driverId || req.driverId });
            store.setIncomingRideRequest(null);
            if (driverId) {
                store.updateDriver(driverId, { status: 'busy' });
            }
            store.addToast('success', 'Ride accepted');
        });

        this.socket.on('ride_accept_failed', (data: { rideId: string; reason?: string }) => {
            const store = useAppStore.getState();
            if (store.currentRole !== 'driver') return;

            if (store.incomingRequest?.id === data.rideId) {
                store.setIncomingRideRequest(null);
            }
            store.addToast('error', data.reason || 'Ride acceptance failed');
        });

        this.socket.on('ride_taken', (data: { rideId: string }) => {
            const store = useAppStore.getState();
            if (store.currentRole !== 'driver') return;

            if (store.incomingRequest?.id === data.rideId) {
                store.setIncomingRideRequest(null);
                store.addToast('info', 'Ride was taken by another driver');
            }
        });

        this.socket.on('ride_status_update', (ride) => {
            const store = useAppStore.getState();
            if (store.activeRide?.id === ride.id) {
                // Update the status in the store without triggering another API call
                // We can use a direct set or a specific action that doesn't call API
                // But updateRideStatus calls API. 
                // We should probably just update the state directly here or add a new action 'syncRideStatus'
                useAppStore.setState(state => ({
                    activeRide: { ...state.activeRide!, status: ride.status }
                }));
                
                let msg = '';
                if (ride.status === 'arrived') msg = 'Driver has arrived!';
                if (ride.status === 'in_progress') msg = 'Trip started!';
                if (ride.status === 'completed') msg = 'Trip completed!';
                
                if (msg) store.addToast('info', msg);
            }
        });

        this.socket.on('driver_location_update', (data) => {
            const store = useAppStore.getState();
            // Update driver location in store
            const updatedDrivers = store.drivers.map(d => 
                d.id === data.driverId ? { ...d, location: data.location } : d
            );
            store.updateDrivers(updatedDrivers);
        });

        this.socket.on('driver_status_update', (data) => {
            const store = useAppStore.getState();
            if (!data?.driverId) return;
            store.updateDriver(data.driverId, { status: data.status });
        });

        this.socket.on('new_message', (data) => {
            const store = useAppStore.getState();
            store.addMessage(data);
            if (!store.chatState.isOpen) {
                store.addToast('info', `New message from ${data.senderName || 'Driver'}`);
            }
        });
        };

        // React StrictMode mounts/unmounts components twice in development.
        // Schedule socket creation on the next tick and cancel it on cleanup to avoid noisy WS errors.
        if (import.meta.env.DEV && typeof window !== 'undefined') {
            this.connectTimer = setTimeout(start, 0);
        } else {
            start();
        }
    }

    disconnect() {
        if (this.connectTimer) {
            try {
                clearTimeout(this.connectTimer);
            } catch {}
            this.connectTimer = null;
        }
        if (this.socket) {
            try {
                this.socket.removeAllListeners();
            } catch {}
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        this.isConnecting = false;
    }

    on(event: string, callback: any) {
        if (this.socket) {
            this.socket.on(event, callback);
        }
    }

    off(event: string, callback: any) {
        if (this.socket) {
            this.socket.off(event, callback);
        }
    }

    emit(event: string, data: any) {
        // Ensure we have a socket instance (idempotent)
        if (!this.socket) this.connect();

        if (this.socket && this.isConnected) {
            this.socket.emit(event, data);
            return;
        }

        // Don't queue high-frequency events while offline (prevents huge backlogs)
        if (!this.QUEUEABLE.has(event)) {
            return;
        }

        // Bound queue size
        if (this.pending.length >= this.MAX_PENDING) {
            this.pending.shift();
        }
        this.pending.push({ event, data });
    }

    getIsConnected(): boolean {
        return this.isConnected;
    }

    joinRoom(userId: string) {
        this.desiredRoom = userId;
        if (!this.socket) this.connect();
        if (this.socket && this.isConnected) {
            this.socket.emit('join_room', userId);
        }
    }

    private flushPending() {
        if (!this.socket || !this.isConnected) return;
        if (this.pending.length === 0) return;

        const batch = this.pending.slice();
        this.pending = [];
        for (const item of batch) {
            this.socket.emit(item.event, item.data);
        }
    }
}

export const socketService = new SocketService();
