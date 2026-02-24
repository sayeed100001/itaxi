
import React, { useEffect, useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Search, Phone, MessageCircle } from 'lucide-react';
import { useAppStore } from '../../store';
import { Button } from '../../components/ui/Button';
import { AdminChatPanel } from '../../components/Chat/AdminChatPanel';
import { ChatSheet } from '../../components/Chat/ChatSheet';

export const MessagesPage: React.FC = () => {
    const { currentRole, openChat, user, chatState, closeChat } = useAppStore();
    const [loading, setLoading] = useState(true);
    const [adminChatOpen, setAdminChatOpen] = useState(false);
    const [selectedChat, setSelectedChat] = useState<{
        recipientId: string;
        recipientName: string;
        recipientRole: 'DRIVER' | 'RIDER' | 'ADMIN';
        tripId?: string;
    } | null>(null);
    const [chats, setChats] = useState<Array<{
        id: string;
        tripId: string | null;
        name: string;
        role: 'Driver' | 'Rider' | 'Admin';
        partnerUserId: string | null;
        lastMessage: string;
        time: string;
        unread: number;
        avatar: string;
        isAdminChat: boolean;
    }>>([]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            setLoading(false);
            return;
        }

        const fetchConversations = async () => {
            setLoading(true);
            try {
                let conversations: any[] = [];

                // Fetch trip-based conversations
                const tripsResponse = await fetch('/api/trips', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const tripsData = await tripsResponse.json();
                
                if (tripsResponse.ok && tripsData.success) {
                    const tripChats = (tripsData.data || []).map((trip: any) => {
                        const isRider = currentRole === 'RIDER';
                        const isDriver = currentRole === 'DRIVER';
                        const partnerName = isRider 
                            ? (trip.driver?.user?.name || 'Pending Driver') 
                            : isDriver
                            ? (trip.rider?.name || 'Rider')
                            : 'User';
                        const partnerUserId = isRider 
                            ? (trip.driver?.userId || null) 
                            : isDriver
                            ? (trip.riderId || null)
                            : null;
                        const partnerRole = isRider ? 'Driver' as const : 'Rider' as const;
                        const statusText = String(trip.status || '').replaceAll('_', ' ');

                        return {
                            id: `trip-${trip.id}`,
                            tripId: trip.id,
                            name: partnerName,
                            role: partnerRole,
                            partnerUserId,
                            lastMessage: `Trip status: ${statusText}`,
                            time: new Date(trip.updatedAt || trip.createdAt).toLocaleString(),
                            unread: 0,
                            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(partnerName)}&background=random`,
                            isAdminChat: false,
                        };
                    });
                    conversations = [...conversations, ...tripChats];
                }

                // Fetch admin conversations for drivers and riders
                // Only fetch if user's actual backend role matches
                if (currentRole === 'DRIVER' && user?.role === 'DRIVER') {
                    const adminMsgsResponse = await fetch('/api/messages/driver/admin-messages', {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const adminMsgsData = await adminMsgsResponse.json();
                    
                    if (adminMsgsResponse.ok && adminMsgsData.success && adminMsgsData.data.length > 0) {
                        const lastMsg = adminMsgsData.data[0];
                        conversations.push({
                            id: 'admin-chat',
                            tripId: null,
                            name: 'Admin Support',
                            role: 'Admin' as const,
                            partnerUserId: 'admin',
                            lastMessage: lastMsg.message || 'No messages yet',
                            time: new Date(lastMsg.createdAt).toLocaleString(),
                            unread: 0,
                            avatar: 'https://ui-avatars.com/api/?name=Admin&background=3b82f6',
                            isAdminChat: true,
                        });
                    } else {
                        // Add admin chat even if no messages
                        conversations.push({
                            id: 'admin-chat',
                            tripId: null,
                            name: 'Admin Support',
                            role: 'Admin' as const,
                            partnerUserId: 'admin',
                            lastMessage: 'Start a conversation with admin',
                            time: new Date().toLocaleString(),
                            unread: 0,
                            avatar: 'https://ui-avatars.com/api/?name=Admin&background=3b82f6',
                            isAdminChat: true,
                        });
                    }
                } else if (currentRole === 'RIDER' && user?.role === 'RIDER') {
                    const adminMsgsResponse = await fetch('/api/messages/rider/admin-messages', {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const adminMsgsData = await adminMsgsResponse.json();
                    
                    if (adminMsgsResponse.ok && adminMsgsData.success && adminMsgsData.data.length > 0) {
                        const lastMsg = adminMsgsData.data[0];
                        conversations.push({
                            id: 'admin-chat',
                            tripId: null,
                            name: 'Admin Support',
                            role: 'Admin' as const,
                            partnerUserId: 'admin',
                            lastMessage: lastMsg.message || 'No messages yet',
                            time: new Date(lastMsg.createdAt).toLocaleString(),
                            unread: 0,
                            avatar: 'https://ui-avatars.com/api/?name=Admin&background=3b82f6',
                            isAdminChat: true,
                        });
                    } else {
                        // Add admin chat even if no messages
                        conversations.push({
                            id: 'admin-chat',
                            tripId: null,
                            name: 'Admin Support',
                            role: 'Admin' as const,
                            partnerUserId: 'admin',
                            lastMessage: 'Start a conversation with admin',
                            time: new Date().toLocaleString(),
                            unread: 0,
                            avatar: 'https://ui-avatars.com/api/?name=Admin&background=3b82f6',
                            isAdminChat: true,
                        });
                    }
                } else if (currentRole === 'ADMIN' || user?.role === 'ADMIN') {
                    // Fetch all admin conversations
                    const adminConvsResponse = await fetch('/api/messages/admin/conversations', {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    const adminConvsData = await adminConvsResponse.json();
                    
                    if (adminConvsResponse.ok && adminConvsData.success) {
                        const adminChats = (adminConvsData.data || []).map((conv: any) => ({
                            id: `admin-${conv.userId}`,
                            tripId: null,
                            name: conv.userName,
                            role: conv.userRole === 'DRIVER' ? 'Driver' as const : 'Rider' as const,
                            partnerUserId: conv.userId,
                            lastMessage: conv.lastMessage || 'No messages',
                            time: new Date(conv.lastMessageAt).toLocaleString(),
                            unread: conv.unreadCount || 0,
                            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.userName)}&background=random`,
                            isAdminChat: true,
                        }));
                        conversations = [...conversations, ...adminChats];
                    }
                }

                setChats(conversations);
            } catch (error) {
                console.error('Failed to fetch conversations:', error);
                setChats([]);
            } finally {
                setLoading(false);
            }
        };

        void fetchConversations();
    }, [currentRole]);

    const handleOpenChat = (chat: any) => {
        if (!chat.partnerUserId) return;
        
        // For admin-driver/rider chats, use AdminChatPanel
        if (chat.isAdminChat) {
            setSelectedChat({
                recipientId: chat.partnerUserId === 'admin' ? 'admin' : chat.partnerUserId,
                recipientName: chat.name,
                recipientRole: chat.role,
            });
            setAdminChatOpen(true);
        } else {
            // For trip-based chats, use ChatSheet
            openChat(chat.partnerUserId, chat.name, chat.role, chat.tripId);
        }
    };

    return (
        <div className="p-4 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 transition-colors duration-300 pb-24">
            <header className="mb-6">
                <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">Messages</h1>
                <p className="text-dark-500 dark:text-dark-400">
                    {currentRole === 'ADMIN' 
                        ? 'Manage conversations with drivers and riders' 
                        : 'Connect with drivers, riders, and support'}
                </p>
            </header>

            {/* Search Bar */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-3.5 text-dark-400" size={20} />
                <input 
                    type="text" 
                    placeholder="Search messages..." 
                    className="w-full bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-dark-900 dark:text-white placeholder:text-dark-400 dark:placeholder:text-dark-500 focus:outline-none focus:border-brand-500 transition-all shadow-sm"
                />
            </div>

            <div className="space-y-3">
                {loading && (
                    <Card className="p-4 text-sm text-dark-500 dark:text-dark-400">
                        Loading conversations...
                    </Card>
                )}
                {!loading && chats.length === 0 && (
                    <Card className="p-4 text-sm text-dark-500 dark:text-dark-400">
                        No conversations yet. {currentRole !== 'ADMIN' && 'Start a trip or contact admin support.'}
                    </Card>
                )}
                {chats.map((chat) => (
                    <Card 
                        key={chat.id} 
                        onClick={() => handleOpenChat(chat)}
                        className="flex items-center gap-4 p-4 hover:bg-white dark:hover:bg-white/5 cursor-pointer transition-colors group border-transparent hover:border-dark-100 dark:hover:border-white/5"
                    >
                        <div className="relative">
                            <img src={chat.avatar} alt={chat.name} className="w-12 h-12 rounded-full object-cover" />
                            {chat.unread > 0 && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold border-2 border-white dark:border-dark-900">
                                    {chat.unread}
                                </div>
                            )}
                            {chat.isAdminChat && (
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center border-2 border-white dark:border-dark-900">
                                    <MessageCircle size={12} className="text-white" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-1">
                                <h3 className={`font-bold text-base truncate ${chat.unread > 0 ? 'text-dark-900 dark:text-white' : 'text-dark-700 dark:text-dark-200'}`}>
                                    {chat.name}
                                    {chat.isAdminChat && <span className="ml-2 text-xs text-brand-500 font-normal">(Support)</span>}
                                </h3>
                                <span className="text-xs text-dark-400 dark:text-dark-500 whitespace-nowrap ml-2">{chat.time}</span>
                            </div>
                            <p className={`text-sm truncate ${chat.unread > 0 ? 'text-dark-900 dark:text-white font-medium' : 'text-dark-500 dark:text-dark-400'}`}>
                                {chat.lastMessage}
                            </p>
                        </div>
                        <div className="hidden group-hover:flex items-center gap-2">
                            <button className="p-2 rounded-full bg-dark-100 dark:bg-white/10 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/20 transition-colors">
                                <Phone size={18} />
                            </button>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Admin Chat Panel for admin-driver/rider messaging */}
            {adminChatOpen && selectedChat && (
                <AdminChatPanel
                    isOpen={adminChatOpen}
                    onClose={() => {
                        setAdminChatOpen(false);
                        setSelectedChat(null);
                    }}
                    recipientId={selectedChat.recipientId}
                    recipientName={selectedChat.recipientName}
                    recipientRole={selectedChat.recipientRole as 'DRIVER' | 'RIDER'}
                />
            )}

            {/* Trip Chat Sheet for trip-based messaging */}
            <ChatSheet
                isOpen={chatState.isOpen}
                onClose={closeChat}
                recipientName={chatState.recipientName}
                recipientRole={chatState.recipientRole}
            />
        </div>
    );
};
