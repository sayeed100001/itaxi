    const ServiceComparisonPanel = () => {
        if (!currentRoute) return null;
        
        const distKm = currentRoute.distance / 1000;
        const durMin = currentRoute.duration / 60;

        const services = adminSettings.services.map(s => {
            let price = Math.round((distKm * s.perKm) + s.baseFare + (durMin * s.perMin));
            
            if (user?.loyaltyPoints) {
                const points = user.loyaltyPoints;
                let discount = 0;
                if (points >= 50) discount = 15;
                else if (points >= 30) discount = 10;
                else if (points >= 10) discount = 5;
                
                if (discount > 0) {
                    price = Math.round(price * (1 - discount / 100));
                }
            }
            
            if (isSubscribed) {
                price = Math.round(price * 0.85);
            }
            
            const availableDrivers = drivers.filter(d => {
                if (d.serviceTypes && d.serviceTypes.length > 0) return d.serviceTypes.includes(s.id);
                if (s.id === 'city') return ['eco', 'plus'].includes(d.type);
                if (s.id === 'intercity') return ['suv', 'lux'].includes(d.type);
                if (s.id === 'airport') return true;
                return true;
            });

            let eta = 'N/A';
            if (availableDrivers.length > 0) {
                let minDist = Infinity;
                const pickup = pickupCoords || userLocation;
                availableDrivers.forEach(d => {
                    const dist = Math.sqrt(Math.pow(pickup.lat - d.location.lat, 2) + Math.pow(pickup.lng - d.location.lng, 2));
                    if (dist < minDist) minDist = dist;
                });
                const mins = Math.max(1, Math.round(minDist * 100 / 0.8));
                eta = `${mins} min`;
            }

            return { ...s, price, eta, available: availableDrivers.length > 0 };
        });

        return (
            <div className="absolute bottom-0 left-0 right-0 bg-white/98 dark:bg-zinc-950/98 backdrop-blur-2xl rounded-t-[40px] shadow-[0_-12px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_-12px_40px_rgba(0,0,0,0.8)] z-30 animate-slide-up flex flex-col max-h-[90vh] ring-1 ring-black/5 dark:ring-white/5">
                {/* Premium Drag Handle */}
                <div className="relative pt-6 pb-2">
                    <div className="w-16 h-1.5 bg-gradient-to-r from-zinc-300 via-zinc-400 to-zinc-300 dark:from-zinc-700 dark:via-zinc-600 dark:to-zinc-700 rounded-full mx-auto shadow-sm"></div>
                    <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/50 dark:from-zinc-950/50 to-transparent rounded-t-[40px]"></div>
                </div>

                {/* Header Section */}
                <div className="px-8 pb-6 border-b border-zinc-100/80 dark:border-zinc-800/80 shrink-0">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                            <h3 className="font-display font-black text-3xl text-zinc-900 dark:text-white tracking-tight mb-2">
                                {scheduledTime ? `Scheduled: ${scheduledTime.split(' ')[1]}` : 'Choose Your Ride'}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                    <span>To <span className="text-zinc-900 dark:text-white font-bold">{destination}</span></span>
                                </div>
                                <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600"></div>
                                <span className="text-zinc-400">{distKm.toFixed(1)} km • {Math.round(durMin)} min</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => setViewState('selecting')} 
                            className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all duration-300 shadow-sm hover:shadow-md"
                        >
                            <X size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                    
                    {/* Premium Status Indicators */}
                    <div className="flex items-center gap-3">
                        {/* Payment Method */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="text-xs font-bold text-green-700 dark:text-green-400">Cash Payment</span>
                        </div>
                        
                        {/* Subscription Badge */}
                        {isSubscribed && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25">
                                <Zap size={12} className="text-yellow-300" />
                                <span className="text-xs font-bold">Pass Active</span>
                            </div>
                        )}
                        
                        {/* Loyalty Points */}
                        {user?.loyaltyPoints && user.loyaltyPoints > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                                <Star size={12} className="text-amber-500 fill-amber-500" />
                                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{user.loyaltyPoints} pts</span>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Service Options */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 pb-40">
                    {services.map((service, index) => {
                        const isSelected = selectedService === service.id;
                        const isRecommended = index === 0 && service.available;
                        
                        return (
                            <div 
                                key={service.id}
                                onClick={() => service.available && handleSelectServiceFromCompare(service.id as ServiceType, service.price)}
                                className={`group relative overflow-hidden transition-all duration-500 cursor-pointer ${
                                    !service.available 
                                        ? 'opacity-40 cursor-not-allowed' 
                                        : isSelected 
                                            ? 'scale-[1.02]' 
                                            : 'hover:scale-[1.01]'
                                }`}
                            >
                                {/* Background Glow */}
                                {isSelected && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-xl"></div>
                                )}
                                
                                {/* Main Card */}
                                <div className={`relative p-6 rounded-3xl border-2 transition-all duration-500 ${
                                    !service.available
                                        ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50'
                                        : isSelected
                                            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 shadow-xl shadow-blue-500/20'
                                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg'
                                }`}>
                                    
                                    {/* Recommended Badge */}
                                    {isRecommended && (
                                        <div className="absolute -top-2 left-6 px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold rounded-full shadow-lg shadow-green-500/30">
                                            <div className="flex items-center gap-1">
                                                <Zap size={10} className="text-yellow-300" />
                                                Recommended
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-5">
                                        {/* Service Icon */}
                                        <div className={`relative w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 ${
                                            !service.available
                                                ? 'bg-zinc-200 dark:bg-zinc-800'
                                                : isSelected
                                                    ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30'
                                                    : 'bg-zinc-100 dark:bg-zinc-800 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10'
                                        }`}>
                                            {/* Icon Glow */}
                                            {isSelected && (
                                                <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-2xl blur-lg opacity-50"></div>
                                            )}
                                            
                                            <div className={`relative transition-all duration-500 ${
                                                !service.available
                                                    ? 'text-zinc-400 dark:text-zinc-600'
                                                    : isSelected
                                                        ? 'text-white scale-110'
                                                        : 'text-zinc-600 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:scale-105'
                                            }`}>
                                                {service.icon === 'plane' ? (
                                                    <Plane size={36} strokeWidth={2} />
                                                ) : service.icon === 'map-pin' ? (
                                                    <MapPin size={36} strokeWidth={2} />
                                                ) : (
                                                    <Car size={36} strokeWidth={2} />
                                                )}
                                            </div>
                                            
                                            {/* Premium Badge */}
                                            {service.id === 'airport' && (
                                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                                                    <Star size={12} className="text-white fill-white" />
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Service Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h4 className={`font-bold text-xl transition-colors duration-300 ${
                                                        !service.available
                                                            ? 'text-zinc-400 dark:text-zinc-600'
                                                            : 'text-zinc-900 dark:text-white'
                                                    }`}>
                                                        {service.name}
                                                    </h4>
                                                    <p className={`text-sm font-medium mt-1 ${
                                                        !service.available
                                                            ? 'text-zinc-400 dark:text-zinc-600'
                                                            : 'text-zinc-500 dark:text-zinc-400'
                                                    }`}>
                                                        {service.id === 'city' ? 'Affordable everyday rides' :
                                                         service.id === 'intercity' ? 'Comfortable long distance' :
                                                         service.id === 'airport' ? 'Premium airport service' : 'Standard service'}
                                                    </p>
                                                </div>
                                                
                                                {/* Price */}
                                                <div className="text-right">
                                                    <div className={`font-black text-2xl transition-colors duration-300 ${
                                                        !service.available
                                                            ? 'text-zinc-400 dark:text-zinc-600'
                                                            : isSelected
                                                                ? 'text-blue-600 dark:text-blue-400'
                                                                : 'text-zinc-900 dark:text-white'
                                                    }`}>
                                                        ؋{service.price}
                                                    </div>
                                                    {user?.loyaltyPoints && user.loyaltyPoints > 10 && (
                                                        <div className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">
                                                            {user.loyaltyPoints >= 50 ? '15%' : user.loyaltyPoints >= 30 ? '10%' : '5%'} off
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Service Stats */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    {/* ETA */}
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={14} className={`${
                                                            !service.available
                                                                ? 'text-zinc-400 dark:text-zinc-600'
                                                                : 'text-blue-500'
                                                        }`} />
                                                        <span className={`text-sm font-bold ${
                                                            !service.available
                                                                ? 'text-zinc-400 dark:text-zinc-600'
                                                                : service.available && service.eta !== 'N/A'
                                                                    ? 'text-green-600 dark:text-green-400'
                                                                    : 'text-red-500 dark:text-red-400'
                                                        }`}>
                                                            {service.available ? service.eta : 'Busy'}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Capacity */}
                                                    <div className="flex items-center gap-2">
                                                        <User size={14} className={`${
                                                            !service.available
                                                                ? 'text-zinc-400 dark:text-zinc-600'
                                                                : 'text-zinc-500 dark:text-zinc-400'
                                                        }`} />
                                                        <span className={`text-sm font-medium ${
                                                            !service.available
                                                                ? 'text-zinc-400 dark:text-zinc-600'
                                                                : 'text-zinc-500 dark:text-zinc-400'
                                                        }`}>
                                                            {service.id === 'intercity' ? '6' : '4'} seats
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                {/* Selection Indicator */}
                                                {isSelected && (
                                                    <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                                        <Check size={14} className="text-white" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom Action Area */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-zinc-950 dark:via-zinc-950/95 dark:to-transparent pt-16 pb-safe z-50">
                    {/* Fare Input */}
                    {showFareInput ? (
                        <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border-2 border-blue-500 shadow-xl shadow-blue-500/20 mb-4 animate-scale-up">
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Propose Your Fare</label>
                                <button 
                                    onClick={() => setShowFareInput(false)} 
                                    className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 rounded-2xl px-4 py-3 border border-zinc-200 dark:border-zinc-800">
                                <span className="text-2xl font-bold text-zinc-400 mr-3">؋</span>
                                <input
                                    type="number"
                                    value={proposedFare}
                                    onChange={(e) => setProposedFare(e.target.value)}
                                    placeholder="Enter amount"
                                    className="flex-1 bg-transparent text-2xl font-bold text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400"
                                />
                            </div>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setShowFareInput(true)} 
                            className="w-full p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-bold text-blue-600 dark:text-blue-400 transition-all duration-300 mb-4 border border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-600"
                        >
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-lg">💰</span>
                                <span>Negotiate Your Fare</span>
                            </div>
                        </button>
                    )}
                    
                    {/* Request Button */}
                    <Button 
                        size="lg" 
                        variant="gradient"
                        className="w-full h-16 text-xl font-black rounded-3xl shadow-2xl shadow-blue-500/30 hover:shadow-blue-500/40 transition-all duration-500 hover:scale-[1.02] active:scale-[0.98]" 
                        onClick={handleRequestRide} 
                        disabled={!proposedFare}
                    >
                        <div className="flex items-center justify-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                <Zap size={18} className="text-white" />
                            </div>
                            <span>Request {services.find(s => s.id === selectedService)?.name || 'Ride'}</span>
                            <div className="px-3 py-1 bg-white/20 rounded-full text-sm font-bold">
                                ؋{proposedFare}
                            </div>
                        </div>
                    </Button>
                </div>
            </div>
        );
    };