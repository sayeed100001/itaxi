import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { RefreshCw, CheckCircle, XCircle, Send, MessageSquare } from 'lucide-react';

interface OTPLog {
  id: string;
  phone: string;
  deliveryStatus: string;
  messageId: string | null;
  createdAt: string;
  verified: boolean;
}

interface RideNotification {
  id: string;
  tripId: string;
  driverId: string;
  status: string;
  messageId: string | null;
  sentAt: string;
  driver: {
    user: { name: string };
    whatsappNumber: string | null;
  };
}

interface Analytics {
  totalOTP: number;
  sentOTP: number;
  failedOTP: number;
  otpSuccessRate: string;
  totalRide: number;
  sentRide: number;
  failedRide: number;
  rideSuccessRate: string;
}

export const AdminWhatsAppPage: React.FC = () => {
  const [otpLogs, setOtpLogs] = useState<OTPLog[]>([]);
  const [rideNotifications, setRideNotifications] = useState<RideNotification[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/admin/whatsapp-logs', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      if (data.success) {
        setOtpLogs(data.data.otpLogs);
        setRideNotifications(data.data.rideNotifications);
        setAnalytics(data.data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch logs', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRetryOTP = async (otpId: string) => {
    setRetrying(otpId);
    try {
      await fetch(`/api/admin/whatsapp/retry-otp/${otpId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      fetchLogs();
    } catch (error) {
      console.error('Retry failed', error);
    } finally {
      setRetrying(null);
    }
  };

  const handleRetryNotification = async (notificationId: string) => {
    setRetrying(notificationId);
    try {
      await fetch(`/api/admin/whatsapp/retry-notification/${notificationId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      fetchLogs();
    } catch (error) {
      console.error('Retry failed', error);
    } finally {
      setRetrying(null);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-dark-900 dark:text-white">WhatsApp Monitoring</h1>
        <Button onClick={fetchLogs} icon={<RefreshCw size={18} />}>Refresh</Button>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-dark-500 mb-1">Total OTP Sent</div>
            <div className="text-3xl font-bold text-dark-900 dark:text-white">{analytics.totalOTP}</div>
            <div className="text-xs text-green-600 mt-1">{analytics.otpSuccessRate}% success</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-dark-500 mb-1">Failed OTP</div>
            <div className="text-3xl font-bold text-red-600">{analytics.failedOTP}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-dark-500 mb-1">Ride Notifications</div>
            <div className="text-3xl font-bold text-dark-900 dark:text-white">{analytics.totalRide}</div>
            <div className="text-xs text-green-600 mt-1">{analytics.rideSuccessRate}% success</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-dark-500 mb-1">Failed Notifications</div>
            <div className="text-3xl font-bold text-red-600">{analytics.failedRide}</div>
          </Card>
        </div>
      )}

      {/* OTP Logs */}
      <Card className="p-6">
        <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
          <MessageSquare size={20} /> OTP Messages
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-200 dark:border-white/10">
                <th className="text-left p-3 text-sm font-bold text-dark-700 dark:text-dark-300">Phone</th>
                <th className="text-left p-3 text-sm font-bold text-dark-700 dark:text-dark-300">Status</th>
                <th className="text-left p-3 text-sm font-bold text-dark-700 dark:text-dark-300">Verified</th>
                <th className="text-left p-3 text-sm font-bold text-dark-700 dark:text-dark-300">Time</th>
                <th className="text-left p-3 text-sm font-bold text-dark-700 dark:text-dark-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {otpLogs.map((log) => (
                <tr key={log.id} className="border-b border-dark-100 dark:border-white/5">
                  <td className="p-3 text-sm text-dark-900 dark:text-white">{log.phone}</td>
                  <td className="p-3">
                    {log.deliveryStatus === 'SENT' ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle size={16} /> Sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                        <XCircle size={16} /> Failed
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-sm">{log.verified ? '✅' : '⏳'}</td>
                  <td className="p-3 text-sm text-dark-600 dark:text-dark-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    {log.deliveryStatus === 'FAILED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRetryOTP(log.id)}
                        disabled={retrying === log.id}
                        icon={<Send size={14} />}
                      >
                        {retrying === log.id ? 'Retrying...' : 'Retry'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Ride Notifications */}
      <Card className="p-6">
        <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
          <Send size={20} /> Ride Notifications
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-200 dark:border-white/10">
                <th className="text-left p-3 text-sm font-bold text-dark-700 dark:text-dark-300">Driver</th>
                <th className="text-left p-3 text-sm font-bold text-dark-700 dark:text-dark-300">Phone</th>
                <th className="text-left p-3 text-sm font-bold text-dark-700 dark:text-dark-300">Trip ID</th>
                <th className="text-left p-3 text-sm font-bold text-dark-700 dark:text-dark-300">Status</th>
                <th className="text-left p-3 text-sm font-bold text-dark-700 dark:text-dark-300">Time</th>
                <th className="text-left p-3 text-sm font-bold text-dark-700 dark:text-dark-300">Action</th>
              </tr>
            </thead>
            <tbody>
              {rideNotifications.map((notif) => (
                <tr key={notif.id} className="border-b border-dark-100 dark:border-white/5">
                  <td className="p-3 text-sm text-dark-900 dark:text-white">{notif.driver.user.name}</td>
                  <td className="p-3 text-sm text-dark-600 dark:text-dark-400">
                    {notif.driver.whatsappNumber || 'N/A'}
                  </td>
                  <td className="p-3 text-sm text-dark-600 dark:text-dark-400 font-mono">
                    {notif.tripId.slice(0, 8)}...
                  </td>
                  <td className="p-3">
                    {notif.status === 'SENT' ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle size={16} /> Sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 text-sm">
                        <XCircle size={16} /> Failed
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-dark-600 dark:text-dark-400">
                    {new Date(notif.sentAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    {notif.status === 'FAILED' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRetryNotification(notif.id)}
                        disabled={retrying === notif.id}
                        icon={<Send size={14} />}
                      >
                        {retrying === notif.id ? 'Retrying...' : 'Retry'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
