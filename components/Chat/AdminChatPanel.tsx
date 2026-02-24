import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Send, X, Phone, User, MessageCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAppStore } from '../../store';
import { socketService } from '../../services/socket';
import { API_BASE } from '../../config';

interface AdminChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    recipientId: string;
    recipientName: string;
    recipientRole: 'DRIVER' | 'RIDER';
}

interface Message {
    id: string;
    adminUserId?: string;
    driverId?: string;
    riderId?: string;
    message: string;
    channel: 'IN_APP' | 'WHATSAPP';
    deliveryStatus: 'SENT' | 'FAILED';
    createdAt: string;
}

export const AdminChatPanel: React.FC<AdminChatPanelProps> = ({ 
    isOpen, 
    onClose, 
    recipientId, 
    recipientName, 
    recipientRole 
}) => {
    const { user, addToast, currentRole } = useAppStore();
    const [input, setInput] = useState('');
    const [channel, setChannel] = useState<'IN_APP' | 'WHATSAPP'>('IN_APP');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    const loadMessages = useCallback(async () => {
        if (!recipientId) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        setLoading(true);
        try {
            let endpoint = '';
            if (currentRole === 'ADMIN') {
                endpoint = recipientRole === 'DRIVER' 
                    ? `${API_BASE}/messages/admin/driver/${recipientId}`
                    : `${API_BASE}/messages/admin/rider/${recipientId}`;
            } else if (currentRole === 'DRIVER') {
                endpoint = `${API_BASE}/messages/driver/admin-messages`;
            } else if (currentRole === 'RIDER') {
                endpoint = `${API_BASE}/messages/rider/admin-messages`;
            }

            const response = await fetch(endpoint, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data?.message || 'Failed to load messages');
            }
            setMessages(data.data || []);
        } catch (error: any) {
            addToast('error', error?.message || 'Failed to load messages');
        } finally {
            setLoading(false);
        }
    }, [recipientId, recipientRole, currentRole, addToast]);

    useEffect(() => {
        if (!isOpen) return;
        void loadMessages();
    }, [isOpen, loadMessages]);

    useEffect(() => {
        if (!isOpen) return;

        const handler = (data: any) => {
            setMessages((prev) => {
                const newMsg: Message = {
                    id: Date.now().toString(),
                    message: data.message,
                    channel: 'IN_APP',
                    deliveryStatus: 'SENT',
                    createdAt: data.createdAt || new Date().toISOString(),
                    ...(currentRole === 'ADMIN' ? { adminUserId: user?.id } : {}),
                    ...(recipientRole === 'DRIVER' ? { driverId: data.driverId || recipientId } : {}),
                    ...(recipientRole === 'RIDER' ? { riderId: data.riderId || recipientId } : {}),
                };
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
            });
        };

        if (currentRole === 'ADMIN') {
            socketService.on('driver:message', handler);
            socketService.on('rider:message', handler);
        } else {
            socketService.on('admin:message', handler);
        }

        return () => {
            socketService.off('driver:message', handler);
            socketService.off('rider:message', handler);
            socketService.off('admin:message', handler);
        };
    }, [isOpen, currentRole, recipientRole, recipientId, user?.id]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        void (async () => {
            if (!input.trim() || !recipientId) return;
            const token = localStorage.getItem('token');
            if (!token) return;

            setSending(true);
            const text = input.trim();
            setInput('');

            try {
                let endpoint = '';
                let body: any = { message: text, channel };

                if (currentRole === 'ADMIN') {
                    endpoint = recipientRole === 'DRIVER'
                        ? `${API_BASE}/messages/admin/to-driver`
                        : `${API_BASE}/messages/admin/to-rider`;
                    body[recipientRole === 'DRIVER' ? 'driverId' : 'riderId'] = recipientId;
                } else if (currentRole === 'DRIVER') {
                    endpoint = `${API_BASE}/messages/driver/to-admin`;
                } else if (currentRole === 'RIDER') {
                    endpoint = `${API_BASE}/messages/rider/to-admin`;
                }

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(body),
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data?.message || 'Failed to send message');
                }

                // Add message to local state
                const newMsg: Message = {
                    id: Date.now().toString(),
                    message: text,
                    channel,
                    deliveryStatus: data.deliveryStatus || 'SENT',
                    createdAt: new Date().toISOString(),
                    ...(currentRole === 'ADMIN' ? { adminUserId: user?.id } : {}),
                    ...(recipientRole === 'DRIVER' ? { driverId: recipientId } : {}),
                    ...(recipientRole === 'RIDER' ? { riderId: recipientId } : {}),
                };
                setMessages((prev) => [...prev, newMsg]);
                
                if (data.deliveryStatus === 'FAILED') {
                    addToast('warning', 'Message sent but WhatsApp delivery failed');
                }
            } catch (error: any) {
                addToast('error', error?.message || 'Failed to send message');
                setInput(text);
            } finally {
                setSending(false);
            }
        })();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center pointer-events-none">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-300" onClick={onClose} />

            {/* Chat Window */}
            <div className="pointer-events-auto w-full md:w-[400px] h-[80vh] md:h-[600px] bg-white dark:bg-dark-900 md:rounded-2xl rounded-t-2xl shadow-2xl border border-dark-200 dark:border-white/10 flex flex-col animate-in slide-in-from-bottom-10 duration-300 transition-colors">
                {/* Header */}
                <div className="p-4 border-b border-dark-100 dark:border-white/5 flex items-center justify-between bg-dark-50 dark:bg-white/5 md:rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold">
                            {recipientName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div className="font-bold text-dark-900 dark:text-white text-sm">{recipientName}</div>
                            <div className="text-xs text-brand-600 dark:text-brand-400 font-medium capitalize flex items-center gap-1">
                                <MessageCircle size={12} />
                                {recipientRole === 'DRIVER' ? 'Driver' : recipientRole === 'RIDER' ? 'Rider' : 'Admin'} Support
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2 rounded-full hover:bg-dark-200 dark:hover:bg-white/10 text-brand-600 dark:text-brand-400 transition-colors">
                            <Phone size={18} />
                        </button>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-dark-200 dark:hover:bg-white/10 text-dark-400 transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-dark-50 dark:bg-dark-950/50">
                    {loading && (
                        <div className="text-center text-sm text-dark-500 dark:text-dark-400 py-8">
                            Loading messages...
                        </div>
                    )}
                    {!loading && messages.length === 0 && (
                        <div className="text-center text-sm text-dark-500 dark:text-dark-400 py-8">
                            No messages yet. Start the conversation!
                        </div>
                    )}
                    {messages.map((msg) => {
                        const isMe = currentRole === 'ADMIN' 
                            ? !!msg.adminUserId 
                            : currentRole === 'DRIVER'
                            ? !msg.adminUserId
                            : !msg.adminUserId;
                        
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                    isMe
                                        ? 'bg-brand-600 text-white rounded-br-none' 
                                        : 'bg-white dark:bg-dark-800 text-dark-800 dark:text-dark-200 rounded-bl-none border border-dark-100 dark:border-transparent'
                                }`}>
                                    {msg.message}
                                    <div className={`text-[10px] mt-1 opacity-70 ${isMe ? 'text-brand-100' : 'text-dark-400'}`}>
                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                                        {msg.channel === 'WHATSAPP' ? ' • WhatsApp' : ''}
                                        {isMe && msg.deliveryStatus === 'FAILED' ? ' • Failed' : ''}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSend} className="p-4 border-t border-dark-100 dark:border-white/5 bg-white dark:bg-dark-900 flex gap-2">
                    {currentRole === 'ADMIN' && (
                        <select
                            value={channel}
                            onChange={(e) => setChannel(e.target.value as 'IN_APP' | 'WHATSAPP')}
                            className="bg-dark-50 dark:bg-dark-950 border border-dark-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-dark-900 dark:text-white"
                            disabled={sending}
                        >
                            <option value="IN_APP">In App</option>
                            <option value="WHATSAPP">WhatsApp</option>
                        </select>
                    )}
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-dark-50 dark:bg-dark-950 border border-dark-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-dark-900 dark:text-white placeholder:text-dark-400 dark:placeholder:text-dark-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                        disabled={sending}
                    />
                    <Button
                        type="submit"
                        size="sm"
                        className="w-12 h-12 !px-0 rounded-xl flex items-center justify-center"
                        disabled={sending || !input.trim()}
                    >
                        <Send size={18} />
                    </Button>
                </form>
            </div>
        </div>
    );
};
