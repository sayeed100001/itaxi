import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Slider } from '../../components/ui/slider';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Settings, Save, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store';

export function AdminDispatchPage() {
  const addToast = useAppStore((state) => state.addToast);
  const [config, setConfig] = useState({
    weightETA: 0.5,
    weightRating: 0.3,
    weightAcceptance: 0.2,
    serviceMatchBonus: 0.1,
    offerTimeout: 30,
    maxOffers: 3,
    searchRadius: 10,
  });
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [phoneBooking, setPhoneBooking] = useState({
    riderName: '',
    riderPhone: '',
    pickupLat: 34.5333,
    pickupLng: 69.1667,
    dropLat: 34.515,
    dropLng: 69.2,
    fare: 120,
    distance: 5000,
    duration: 900,
    serviceType: 'city',
  });

  useEffect(() => {
    loadConfig();
    loadOffers();
  }, []);

  const loadConfig = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/dispatch/config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConfig(data.data);
      }
    } catch (error) {
      console.error('Failed to load config', error);
    }
  };

  const loadOffers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/dispatch/offers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOffers(data.data);
      }
    } catch (error) {
      console.error('Failed to load offers', error);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/dispatch/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.message || 'Failed to save configuration');
      }
      addToast('success', 'Configuration saved successfully');
    } catch (error: any) {
      addToast('error', error?.message || 'Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSliderChange = (setter: (value: number) => void) => (value: number) => {
    setter(value);
  };

  const createPhoneBooking = async () => {
    if (!phoneBooking.riderName || !phoneBooking.riderPhone) {
      addToast('warning', 'Rider name and phone are required');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/trips/phone-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(phoneBooking),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.message || 'Failed to create phone booking');
      }
      addToast('success', 'Phone booking created successfully');
      setPhoneBooking((prev) => ({
        ...prev,
        riderName: '',
        riderPhone: '',
      }));
    } catch (error: any) {
      addToast('error', error?.message || 'Failed to create phone booking');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="w-8 h-8" />
          Dispatch Configuration
        </h1>
        <Button onClick={loadOffers} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Scoring Weights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>ETA Weight: {config.weightETA.toFixed(2)}</Label>
              <Slider
                value={config.weightETA}
                onChange={handleSliderChange((value) => setConfig({ ...config, weightETA: value }))}
                min={0}
                max={1}
                step={0.05}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Rating Weight: {config.weightRating.toFixed(2)}</Label>
              <Slider
                value={config.weightRating}
                onChange={handleSliderChange((value) => setConfig({ ...config, weightRating: value }))}
                min={0}
                max={1}
                step={0.05}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Acceptance Rate Weight: {config.weightAcceptance.toFixed(2)}</Label>
              <Slider
                value={config.weightAcceptance}
                onChange={handleSliderChange((value) => setConfig({ ...config, weightAcceptance: value }))}
                min={0}
                max={1}
                step={0.05}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Service Match Bonus: {config.serviceMatchBonus.toFixed(2)}</Label>
              <Slider
                value={config.serviceMatchBonus}
                onChange={handleSliderChange((value) => setConfig({ ...config, serviceMatchBonus: value }))}
                min={0}
                max={1}
                step={0.05}
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dispatch Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Offer Timeout (seconds)</Label>
              <Input
                type="number"
                value={config.offerTimeout}
                onChange={(e) => setConfig({ ...config, offerTimeout: parseInt(e.target.value) || 0 })}
                min={10}
                max={120}
              />
            </div>

            <div>
              <Label>Max Sequential Offers</Label>
              <Input
                type="number"
                value={config.maxOffers}
                onChange={(e) => setConfig({ ...config, maxOffers: parseInt(e.target.value) || 0 })}
                min={1}
                max={10}
              />
            </div>

            <div>
              <Label>Search Radius (km)</Label>
              <Input
                type="number"
                value={config.searchRadius}
                onChange={(e) => setConfig({ ...config, searchRadius: parseFloat(e.target.value) || 0 })}
                min={1}
                max={50}
                step={0.5}
              />
            </div>

            <Button onClick={saveConfig} disabled={loading} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Phone Booking (Call Center)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Rider Name</Label>
              <Input
                value={phoneBooking.riderName}
                onChange={(e) => setPhoneBooking({ ...phoneBooking, riderName: e.target.value })}
              />
            </div>
            <div>
              <Label>Rider Phone</Label>
              <Input
                value={phoneBooking.riderPhone}
                onChange={(e) => setPhoneBooking({ ...phoneBooking, riderPhone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Pickup Lat</Label>
              <Input
                type="number"
                value={phoneBooking.pickupLat}
                onChange={(e) => setPhoneBooking({ ...phoneBooking, pickupLat: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Pickup Lng</Label>
              <Input
                type="number"
                value={phoneBooking.pickupLng}
                onChange={(e) => setPhoneBooking({ ...phoneBooking, pickupLng: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Drop Lat</Label>
              <Input
                type="number"
                value={phoneBooking.dropLat}
                onChange={(e) => setPhoneBooking({ ...phoneBooking, dropLat: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Drop Lng</Label>
              <Input
                type="number"
                value={phoneBooking.dropLng}
                onChange={(e) => setPhoneBooking({ ...phoneBooking, dropLng: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Fare</Label>
              <Input
                type="number"
                value={phoneBooking.fare}
                onChange={(e) => setPhoneBooking({ ...phoneBooking, fare: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Distance (m)</Label>
              <Input
                type="number"
                value={phoneBooking.distance}
                onChange={(e) => setPhoneBooking({ ...phoneBooking, distance: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Duration (sec)</Label>
              <Input
                type="number"
                value={phoneBooking.duration}
                onChange={(e) => setPhoneBooking({ ...phoneBooking, duration: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Service Type</Label>
              <Input
                value={phoneBooking.serviceType}
                onChange={(e) => setPhoneBooking({ ...phoneBooking, serviceType: e.target.value })}
              />
            </div>
          </div>

          <Button onClick={createPhoneBooking} className="w-full">
            Create Phone Booking
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Offers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Trip ID</th>
                  <th className="text-left p-2">Driver ID</th>
                  <th className="text-left p-2">Score</th>
                  <th className="text-left p-2">ETA (min)</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Offered At</th>
                  <th className="text-left p-2">Response Time</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-mono text-xs">{offer.tripId.slice(0, 8)}</td>
                    <td className="p-2 font-mono text-xs">{offer.driverId.slice(0, 8)}</td>
                    <td className="p-2">{offer.score.toFixed(3)}</td>
                    <td className="p-2">{offer.eta.toFixed(1)}</td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          offer.status === 'ACCEPTED'
                            ? 'bg-green-100 text-green-800'
                            : offer.status === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : offer.status === 'EXPIRED'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {offer.status}
                      </span>
                    </td>
                    <td className="p-2 text-xs">{new Date(offer.createdAt || offer.offeredAt).toLocaleString()}</td>
                    <td className="p-2 text-xs">
                      {offer.respondedAt
                        ? `${Math.round((new Date(offer.respondedAt).getTime() - new Date(offer.createdAt || offer.offeredAt).getTime()) / 1000)}s`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
