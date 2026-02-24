
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Send, X, Phone, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAppStore } from '../../store';
import { socketService } from '../../services/socket';

interface ChatSheetProps {
    isOpen: boolean;
    onClose: () => void;
    recipientName: string;
    recipientRole: string;
}

export const ChatSheet: React.FC<ChatSheetProps> = ({ isOpen, onClose, recipientName, recipientRole }) => {
    const { activeRide, chatState, user, addToast } = useAppStore();
    const activeTripId = chatState.tripId || activeRide?.id;
    const [input, setInput] = useState('');
    const [channel, setChannel] = useState<'IN_APP' | 'WHATSAPP'>('IN_APP');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [messages, setMessages] = useState<Array<{
        id: string;
        tripId: string;
        fromUserId: string;
        body: string;
        channel: 'IN_APP' | 'WHATSAPP';
        deliveryStatus: 'SENT' | 'FAILED';
        createdAt: string;
    }>>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    const loadMessages = useCallback(async () => {
        if (!activeTripId) return;
        const token = localStorage.getItem('token');
        if (!token) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/trips/${activeTripId}/messages`, {
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
    }, [activeTripId, addToast]);

    useEffect(() => {
        if (!isOpen) return;
        void loadMessages();
    }, [isOpen, loadMessages]);

    useEffect(() => {
        if (!isOpen || !activeTripId) return;

        const handler = (message: any) => {
            if (message?.tripId !== activeTripId) return;
            setMessages((prev) => {
                if (prev.some((m) => m.id === message.id)) return prev;
                return [...prev, message];
            });
        };

        socketService.on('trip:message:new', handler);
        return () => socketService.off('trip:message:new', handler);
    }, [isOpen, activeTripId]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        void (async () => {
            if (!input.trim() || !activeTripId) return;
            const token = localStorage.getItem('token');
            if (!token) return;

            setSending(true);
            const text = input.trim();
            setInput('');

            try {
                const response = await fetch(`/api/trips/${activeTripId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ text, channel }),
                });
                const data = await response.json();
                if (!response.ok || !data.success) {
                    throw new Error(data?.message || 'Failed to send message');
                }

                setMessages((prev) => {
                    if (prev.some((m) => m.id === data.data.id)) return prev;
                    return [...prev, data.data];
                });
            } catch (error: any) {
                addToast('error', error?.message || 'Failed to send message');
                setInput(text);
                void loadMessages();
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
            <div className="pointer-events-auto w-full md:w-[400px] h-[80vh] md:h-[600px] bg-white dark:bg-slate-900 md:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col animate-in slide-in-from-bottom-10 duration-300 transition-colors">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-white/5 md:rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-white/10 shadow-sm">
                            <User size={20} className="text-slate-500 dark:text-slate-400" />
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm">{recipientName || 'Driver'}</div>
                            <div className="text-xs text-brand-600 dark:text-brand-400 font-medium capitalize">{recipientRole || 'Partner'}</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-brand-600 dark:text-brand-400 transition-colors">
                            <Phone size={18} />
                        </button>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50">
                    {!activeTripId && (
                        <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
                            Open chat from an active trip.
                        </div>
                    )}
                    {activeTripId && loading && (
                        <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
                            Loading messages...
                        </div>
                    )}
                    {activeTripId && !loading && messages.length === 0 && (
                        <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
                            No messages yet.
                        </div>
                    )}
                    {messages.map((msg) => {
                        const isMe = msg.fromUserId === user?.id;
                        return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                isMe
                                ? 'bg-brand-600 text-white rounded-br-none' 
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-100 dark:border-transparent'
                            }`}>
                                {msg.body}
                                <div className={`text-[10px] mt-1 opacity-70 ${isMe ? 'text-brand-100' : 'text-slate-400'}`}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {msg.channel === 'WHATSAPP' ? '• WhatsApp' : ''}
                                    {isMe && msg.deliveryStatus === 'FAILED' ? ' • Failed' : ''}
                                </div>
                            </div>
                        </div>
                    )})}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSend} className="p-4 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 flex gap-2">
                    <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as 'IN_APP' | 'WHATSAPP')}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
                        disabled={!activeTripId || sending}
                    >
                        <option value="IN_APP">In App</option>
                        <option value="WHATSAPP">WhatsApp</option>
                    </select>
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                        disabled={!activeTripId || sending}
                    />
                    <Button
                        type="submit"
                        size="sm"
                        className="w-12 h-12 !px-0 rounded-xl flex items-center justify-center"
                        disabled={!activeTripId || sending || !input.trim()}
                    >
                        <Send size={18} />
                    </Button>
                </form>
            </div>
        </div>
    );
};
