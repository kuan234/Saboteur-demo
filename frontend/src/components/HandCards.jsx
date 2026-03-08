import React, { useState } from 'react';

const calculateCardTransform = (index, totalCards) => {
    if (totalCards <= 1) return { rotation: 0, translateY: 0 };
    const maxRotation = totalCards <= 3 ? 8 : 12;
    const dropAmount = totalCards <= 3 ? 8 : 15;
    const normalizedIndex = (index - (totalCards - 1) / 2) / ((totalCards - 1) / 2 || 1);
    return { rotation: normalizedIndex * maxRotation, translateY: Math.pow(normalizedIndex, 2) * dropAmount };
};

// Card type icons and colors
const cardThemes = {
    'path': { bg: 'from-green-900 to-green-950', border: 'border-green-700', label: '路径牌', labelBg: 'bg-green-800/80', icon: '🛤️' },
    'break': { bg: 'from-red-900 to-red-950', border: 'border-red-700', label: '行动牌', labelBg: 'bg-red-800/80', icon: '🔨' },
    'repair': { bg: 'from-blue-900 to-blue-950', border: 'border-blue-700', label: '行动牌', labelBg: 'bg-blue-800/80', icon: '🔧' },
    'map': { bg: 'from-purple-900 to-purple-950', border: 'border-purple-700', label: '行动牌', labelBg: 'bg-purple-800/80', icon: '🗺️' },
    'rockfall': { bg: 'from-orange-900 to-orange-950', border: 'border-orange-700', label: '行动牌', labelBg: 'bg-orange-800/80', icon: '💥' },
};

const getAssetImage = (card) => {
    // Return relative public path depending on card type
    if (card.type === 'path') return '/assets/texture_dirt_1772909600159.png';
    if (card.subType === 'sabotage') return '/assets/action_sabotage_1772908474814.png';
    if (card.subType === 'repair') return '/assets/action_repair_1772908491143.png';
    if (card.subType === 'map') return '/assets/action_map_1772908508934.png';
    if (card.subType === 'rockfall') return '/assets/action_rockfall_1772908530135.png';
    return null; // fallback
};

const getTheme = (card) => {
    if (card.type === 'path') return cardThemes.path;
    if (card.actionType) return cardThemes[card.actionType] || cardThemes.break;
    if (card.subType) return cardThemes[card.subType] || cardThemes.break;
    return cardThemes.path;
};

const HandCard = ({ card, index, totalCards, hoveredIndex, setHoveredIndex, onDragStart, onDiscard, isRotated, toggleRotation }) => {
    const isHovered = hoveredIndex === index;
    const { rotation, translateY } = calculateCardTransform(index, totalCards);
    const theme = getTheme(card);
    const assetImg = getAssetImage(card);

    let pushX = 0;
    if (hoveredIndex !== null && !isHovered) {
        pushX = index < hoveredIndex ? -20 : 20;
    }

    // specific rendering for path vs action cards
    const isPath = card.type === 'path';

    return (
        <div
            className="relative flex justify-center items-end"
            style={{
                transform: `translateX(${pushX}px) rotate(${isHovered ? 0 : rotation}deg) translateY(${isHovered ? -50 : translateY}px) scale(${isHovered ? 1.2 : 1})`,
                zIndex: isHovered ? 50 : index,
                transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
            }}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => { setHoveredIndex(null); }}
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(e, card, isRotated); }}
            onDragEnd={() => setHoveredIndex(null)}
            onDoubleClick={() => { if (isPath) toggleRotation(card.id); }}
        >
            {/* Card Body */}
            <div className={`w-28 h-44 md:w-36 md:h-52 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing
        border-2
        shadow-[0_6px_20px_rgba(0,0,0,0.7)]
        ${isHovered ? 'shadow-[0_12px_35px_rgba(212,175,55,0.5)] border-amber-400' : theme.border}
        flex flex-col relative`}
                style={isPath && assetImg ? {
                    backgroundImage: `url(${assetImg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                } : { backgroundColor: '#1c1917' }}>

                {/* If it's not a path, and it has an action background, we can set that full bg too */}
                {!isPath && assetImg && (
                    <div className="absolute inset-0 opacity-80"
                        style={{
                            backgroundImage: `url(${assetImg})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        }} />
                )}

                {/* Optional dark overlay to make text readable */}
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />

                {/* Top region — Card Title + Close btn area */}
                <div className="relative px-2 pt-2 pb-1 z-10 flex justify-between">
                    <div
                        className="w-6 h-6 rounded-full bg-red-800/80 hover:bg-red-500 border border-red-500/80 flex items-center justify-center cursor-pointer transition-all hover:scale-110"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); if (onDiscard) onDiscard(card); }}
                        title="弃牌以跳过回合"
                    >
                        <span className="text-white text-[10px] font-bold">✕</span>
                    </div>
                </div>

                <div className="relative z-10 px-2 mt-1">
                    <h4 className="text-center text-white text-xs md:text-sm font-bold tracking-wide drop-shadow-md leading-tight"
                        style={{ fontFamily: 'Cinzel, serif', textShadow: '1px 1px 3px rgba(0,0,0,0.9)' }}>
                        {card.name}
                    </h4>
                </div>

                {/* Middle region — icon for paths or just empty for action cards relying on background */}
                <div className={`flex-1 mx-2 mb-1 flex items-center justify-center overflow-hidden z-10 transition-transform duration-300 ${isRotated ? 'rotate-180' : ''}`}>
                    {isPath && (
                        <span className="text-4xl md:text-5xl drop-shadow-lg text-amber-400 font-bold"
                            style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.9)' }}>
                            {card.name || '🛤️'} {/* Normally the path character would go here. the server provides card.name as the char */}
                        </span>
                    )}
                </div>

                {/* Bottom region — Type label + description */}
                <div className="px-2 pb-2 z-10 w-full bg-black/50">
                    <div className={`${theme.labelBg} rounded text-center py-0.5 mb-1 mt-1 mx-1`}>
                        <span className="text-[9px] text-white/80 font-bold tracking-widest uppercase">{theme.label}</span>
                    </div>
                    {isPath && (
                        <div className="bg-amber-800/80 rounded mx-1 mb-1 text-center py-0.5 border border-amber-500/30">
                            <span className="text-[8px] text-amber-200 font-bold tracking-widest leading-none">双击旋转</span>
                        </div>
                    )}
                    <p className="text-[9px] text-stone-200 text-center leading-tight line-clamp-2 px-1 pb-1" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.9)' }}>
                        {card.description || `放置 ${card.name}`}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default function HandCards({ cards, onDragStartCard, onDiscardCard }) {
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [rotations, setRotations] = useState({});

    const displayCards = cards && cards.length > 0 ? cards : [];

    const toggleRotation = (cardId) => {
        setRotations(prev => ({
            ...prev,
            [cardId]: !prev[cardId]
        }));
    };

    return (
        <div className="w-full relative flex justify-center items-end px-4"
            style={{ marginLeft: '-1rem', marginRight: '-1rem' }}>
            <div className="flex justify-center items-end" style={{ gap: '-2rem' }}>
                {displayCards.map((card, index) => (
                    <div key={card.id || index} style={{ marginLeft: index > 0 ? '-1.5rem' : '0' }}>
                        <HandCard
                            card={card}
                            index={index}
                            totalCards={displayCards.length}
                            hoveredIndex={hoveredIndex}
                            setHoveredIndex={setHoveredIndex}
                            onDragStart={onDragStartCard}
                            onDiscard={onDiscardCard}
                            isRotated={rotations[card.id] || false}
                            toggleRotation={toggleRotation}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
