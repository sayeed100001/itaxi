
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { MessageCircle, Phone, ChevronDown, ChevronUp, Search, FileText, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../../store';

const FAQS = [
    { q: "How do I change my payment method?", a: "Go to your Wallet section, select 'Manage Cards', and you can add or remove payment methods instantly." },
    { q: "My driver was rude, how do I report?", a: "We take safety seriously. Go to your Trip History, select the specific trip, and tap 'Report Issue'. Our safety team will investigate immediately." },
    { q: "How is the fare calculated?", a: "Fares are based on a base rate plus distance and time. Surge pricing may apply during high demand. You always see the estimated fare upfront." },
    { q: "I lost an item in the car.", a: "Please contact the driver immediately through the app using the anonymous call feature within 24 hours of the trip." },
];

export const SupportPage: React.FC = () => {
    const { currentRole, addToast, openChat } = useAppStore();
    const [openFaq, setOpenFaq] = useState<number | null>(0);

    const handleSOS = () => {
        addToast('error', 'SOS Signal Sent! Emergency contacts notified.');
    };

    const handleChat = () => {
        openChat('support_agent', 'Support Agent', 'Support');
    };

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-dark-50 dark:bg-dark-950 pb-24 transition-colors duration-300">
            <header className="mb-8 text-center md:text-left">
                <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">Help Center</h1>
                <p className="text-dark-500 dark:text-dark-400">24/7 Support for {currentRole === 'DRIVER' ? 'Partners' : 'Riders'}</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <Card 
                    onClick={handleChat}
                    className="flex flex-col items-center text-center hover:bg-white dark:hover:bg-white/5 transition-colors cursor-pointer group shadow-sm hover:shadow-md"
                >
                    <div className="w-14 h-14 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 mb-4 group-hover:scale-110 transition-transform">
                        <MessageCircle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-dark-900 dark:text-white mb-1">Live Chat</h3>
                    <p className="text-sm text-dark-500 dark:text-dark-400 mb-4">Connect with an agent in ~2 mins</p>
                    <Button variant="secondary" size="sm">Start Chat</Button>
                </Card>

                <Card className="flex flex-col items-center text-center hover:bg-white dark:hover:bg-white/5 transition-colors cursor-pointer group shadow-sm hover:shadow-md">
                    <div className="w-14 h-14 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4 group-hover:scale-110 transition-transform">
                        <Phone size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-dark-900 dark:text-white mb-1">Emergency Line</h3>
                    <p className="text-sm text-dark-500 dark:text-dark-400 mb-4">For urgent safety concerns</p>
                    <Button variant="danger" size="sm" onClick={handleSOS}>Call SOS</Button>
                </Card>

                <Card className="flex flex-col items-center text-center hover:bg-white dark:hover:bg-white/5 transition-colors cursor-pointer group shadow-sm hover:shadow-md">
                    <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400 mb-4 group-hover:scale-110 transition-transform">
                        <FileText size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-dark-900 dark:text-white mb-1">Tickets</h3>
                    <p className="text-sm text-dark-500 dark:text-dark-400 mb-4">View status of open requests</p>
                    <Button variant="secondary" size="sm">View History</Button>
                </Card>
            </div>

            <div className="max-w-3xl mx-auto">
                <div className="relative mb-8">
                    <Search className="absolute left-4 top-3.5 text-dark-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search for help..." 
                        className="w-full bg-white dark:bg-dark-900 border border-dark-200 dark:border-white/10 rounded-xl py-3 pl-12 pr-4 text-dark-900 dark:text-white placeholder:text-dark-400 dark:placeholder:text-dark-500 focus:outline-none focus:border-brand-500 transition-all shadow-sm"
                    />
                </div>

                <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-4">Frequently Asked Questions</h2>
                <div className="space-y-3">
                    {FAQS.map((faq, idx) => (
                        <div key={idx} className="bg-white dark:bg-white/5 border border-dark-200 dark:border-white/5 rounded-xl overflow-hidden shadow-sm">
                            <button 
                                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                className="w-full flex items-center justify-between p-4 text-left hover:bg-dark-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <span className="font-medium text-dark-900 dark:text-dark-200">{faq.q}</span>
                                {openFaq === idx ? <ChevronUp size={18} className="text-brand-500 dark:text-brand-400"/> : <ChevronDown size={18} className="text-dark-400 dark:text-dark-500"/>}
                            </button>
                            {openFaq === idx && (
                                <div className="px-4 pb-4 text-sm text-dark-600 dark:text-dark-400 animate-in slide-in-from-top-2 duration-200 leading-relaxed">
                                    {faq.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
