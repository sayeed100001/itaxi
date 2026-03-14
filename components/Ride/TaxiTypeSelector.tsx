import React from 'react';
import { TAXI_TYPES, TaxiType, calculateFare } from '../../services/taxiTypes';

interface TaxiTypeSelectorProps {
    selectedType: string;
    onTypeSelect: (type: TaxiType) => void;
    distance?: number;
    duration?: number;
    surgeMultiplier?: number;
}

export const TaxiTypeSelector: React.FC<TaxiTypeSelectorProps> = ({
    selectedType,
    onTypeSelect,
    distance = 5,
    duration = 15,
    surgeMultiplier = 1
}) => {
    return (
        <div className="space-y-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-4">
                انتخاب نوع تاکسی
            </h3>
            
            {Object.values(TAXI_TYPES).map((taxiType) => {
                const estimatedFare = calculateFare(taxiType, distance, duration, surgeMultiplier);
                const isSelected = selectedType === taxiType.id;
                
                return (
                    <div
                        key={taxiType.id}
                        onClick={() => onTypeSelect(taxiType)}
                        className={`
                            flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
                            ${isSelected 
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }
                        `}
                    >
                        <div className="flex items-center space-x-4 rtl:space-x-reverse">
                            {/* تصویر تاکسی */}
                            <div className="relative">
                                <img 
                                    src={taxiType.imagePath} 
                                    alt={taxiType.nameFa}
                                    className="w-12 h-12 object-contain rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                                    draggable={false}
                                />
                                {isSelected && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            
                            {/* اطلاعات تاکسی */}
                            <div className="flex-1">
                                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                                    <h4 className="font-bold text-gray-900 dark:text-white">
                                        {taxiType.nameFa}
                                    </h4>
                                    <span 
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: taxiType.color }}
                                    ></span>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {taxiType.descriptionFa}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {taxiType.featuresFa.slice(0, 3).map((feature, index) => (
                                        <span 
                                            key={index}
                                            className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full"
                                        >
                                            {feature}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        {/* قیمت تخمینی */}
                        <div className="text-left rtl:text-right">
                            <div className="text-lg font-bold text-gray-900 dark:text-white">
                                {estimatedFare.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                افغانی
                            </div>
                            {surgeMultiplier > 1 && (
                                <div className="text-xs text-orange-500 mt-1">
                                    {surgeMultiplier}x افزایش تقاضا
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            
            {/* اطلاعات اضافی */}
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    <div className="flex justify-between items-center mb-2">
                        <span>مسافت تخمینی:</span>
                        <span className="font-medium">{distance} کیلومتر</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>زمان تخمینی:</span>
                        <span className="font-medium">{duration} دقیقه</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
