
import React, { useRef, useEffect, useState } from 'react';
import { Send, X, Phone, User, MessageCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAppStore } from '../../store';
import { useI18n } from '../../services/useI18n';

interface ChatSheetProps {
    isOpen: boolean;
    onClose: () => void;
    recipientName: string;
    recipientRole: string;
}

export const ChatSheet: React.FC<ChatSheetProps> = ({ isOpen, onClose, recipientName, recipientRole }) => {
    const chatState = useAppStore((state) => state.chatState);
    const sendMessage = useAppStore((state) => state.sendMessage);
    const [input, setInput] = useState('');
    const { t, tx } = useI18n();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recipientId = chatState.recipientId || '';
    const messages = (chatState.messages && recipientId) ? (chatState.messages[recipientId] || []) : [];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    // Initial greeting logic removed to prevent loops
    // If we want a greeting, we should do it once when the chat session is created, not every time the sheet opens.
    
    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !recipientId) return;
        
        sendMessage(recipientId, input, 'me');
        setInput('');
    };

    // Prevent dark overlay from causing issues
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // اگر چت باز نیست یا اطلاعات کامل نیست، چیزی نمایش نده
    if (!isOpen || !recipientName || !recipientId) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
            {/* Chat Window */}
            <div className="relative w-full md:w-[400px] h-[80vh] md:h-[600px] bg-white dark:bg-slate-900 md:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col animate-in slide-in-from-bottom-10 duration-300 transition-colors z-10">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-white/5 md:rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-white/10 shadow-sm">
                            <User size={20} className="text-slate-500 dark:text-slate-400" />
                        </div>
                        <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm">{recipientName || t.chat.recipient_fallback}</div>
                            <div className="text-xs text-brand-600 dark:text-brand-400 font-medium capitalize">{recipientRole || t.chat.role_fallback}</div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => {
                                const driver = useAppStore.getState().drivers.find(d => d.id === recipientId);
                                if (driver?.phone) {
                                    const message = encodeURIComponent(t.chat.whatsapp_message);
                                    window.open(`https://wa.me/${driver.phone.replace('+', '')}?text=${message}`, '_blank');
                                } else {
                                    useAppStore.getState().addToast('error', t.chat.phone_not_available);
                                }
                            }}
                            className="p-2 rounded-full hover:bg-green-100 dark:hover:bg-green-500/20 text-green-600 dark:text-green-400 transition-colors"
                            title={t.chat.whatsapp_title}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                        </button>
                        <button 
                            onClick={() => {
                                const driver = useAppStore.getState().drivers.find(d => d.id === recipientId);
                                if (driver?.phone) {
                                    window.open(`tel:${driver.phone}`);
                                } else {
                                    useAppStore.getState().addToast('error', t.chat.phone_not_available);
                                }
                            }}
                            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-brand-600 dark:text-brand-400 transition-colors"
                            title={t.chat.call_title}
                        >
                            <Phone size={18} />
                        </button>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950/50">
                    <div className="text-center text-xs text-slate-400 dark:text-slate-500 my-4 font-medium uppercase tracking-wider">{t.chat.today}</div>
                    {messages && messages.length > 0 ? (
                        messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                                    msg.sender === 'me' 
                                    ? 'bg-brand-600 text-white rounded-br-none' 
                                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-100 dark:border-transparent'
                                }`}>
                                    {msg.text}
                                    <div className={`text-[10px] mt-1 opacity-70 ${msg.sender === 'me' ? 'text-brand-100' : 'text-slate-400'}`}>
                                        {msg.time}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-slate-500 dark:text-slate-400 py-8">
                            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center mx-auto mb-3 shadow-sm">
                                <MessageCircle size={26} className="text-brand-600 dark:text-brand-400" />
                            </div>
                            <p className="text-sm font-medium">{tx('chat.start_with', { name: recipientName })}</p>
                            <p className="text-xs mt-1">{t.chat.type_prompt}</p>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSend} className="p-4 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 flex gap-2">
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={t.chat.placeholder}
                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                    />
                    <Button type="submit" size="sm" className="w-12 h-12 !px-0 rounded-xl flex items-center justify-center">
                        <Send size={18} />
                    </Button>
                </form>
            </div>
        </div>
    );
};
