import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private resolveSocketUrl() {
    const envUrl = (import.meta as any).env?.VITE_SOCKET_URL;
    if (envUrl) return envUrl;

    // For Vite proxy to work correctly, we should use empty string (relative)
    // or the window origin. Relative is safest for proxying.
    return '';
  }

  connect(token: string) {
    if (this.socket?.connected) return;

    this.socket = io(this.resolveSocketUrl(), {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to server');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      this.reconnectAttempts++;
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  // Driver: Send location every 3 seconds
  startLocationUpdates(getLocation: () => { lat: number; lng: number; bearing?: number }) {
    const interval = setInterval(() => {
      if (!this.socket?.connected) {
        clearInterval(interval);
        return;
      }
      const location = getLocation();
      this.socket.emit('driver:location', location);
    }, 3000);

    return () => clearInterval(interval);
  }

  // Rider: Get nearby drivers
  getNearbyDrivers(lat: number, lng: number, radius?: number) {
    this.socket?.emit('rider:get_nearby_drivers', { lat, lng, radius });
  }

  // Trip: Request
  requestTrip(tripId: string, driverId?: string) {
    this.socket?.emit('trip:request', { tripId, driverId });
  }

  // Trip: Accept
  acceptTrip(tripId: string) {
    this.socket?.emit('trip:accept', { tripId });
  }

  // Dispatch Offer: Accept (preferred for intelligent dispatch flow)
  acceptOffer(tripId: string) {
    this.socket?.emit('offer:accept', { tripId });
  }

  // Trip: Arrived
  arrivedAtPickup(tripId: string) {
    this.socket?.emit('trip:arrived', { tripId });
  }

  // Trip: Start
  startTrip(tripId: string) {
    this.socket?.emit('trip:start', { tripId });
  }

  // Trip: Complete
  completeTrip(tripId: string) {
    this.socket?.emit('trip:complete', { tripId });
  }

  // Listen to events
  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }

  // Legacy compatibility
  emit(event: string, data: any) {
    this.socket?.emit(event, data);
  }
}

export const socketService = new SocketService();
