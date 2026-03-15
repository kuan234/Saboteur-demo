import React, { useState, useEffect, useRef } from 'react';

const calculateCardTransform = (index, totalCards) => {
    if (totalCards <= 1) return { rotation: 0 };
    const maxRotation = totalCards <= 3 ? 8 : 12;
    const normalizedIndex = (index - (totalCards - 1) / 2) / ((totalCards - 1) / 2 || 1);
    return { rotation: normalizedIndex * maxRotation };
};

const cardThemes = {
    path: { border: 'border-green-700', label: '路径牌', labelBg: 'bg-green-800/80' },
    'dead-end': { border: 'border-rose-700', label: '堵路牌', labelBg: 'bg-rose-800/80' },
    break: { border: 'border-red-700', label: '行动牌', labelBg: 'bg-red-800/80' },
    repair: { border: 'border-blue-700', label: '行动牌', labelBg: 'bg-blue-800/80' },
    map: { border: 'border-purple-700', label: '行动牌', labelBg: 'bg-purple-800/80' },
    rockfall: { border: 'border-orange-700', label: '行动牌', labelBg: 'bg-orange-800/80' },
};

const inferCardKind = (card) => {
    const name = String(card?.name || '').toLowerCase();
    const desc = String(card?.description || '').toLowerCase();
    const subType = String(card?.subType || card?.actionType || '').toLowerCase();

    if (card?.type === 'path' && (card?.subType === 'dead-end' || name.includes('堵路'))) return 'dead-end';
    if (card?.type === 'path') return 'path';
    if (subType.includes('sabotage') || subType.includes('break') || name.includes('破坏')) return 'break';
    if (subType.includes('repair') || name.includes('修理') || desc.includes('修理')) return 'repair';
    if (subType.includes('map') || name.includes('地图')) return 'map';
    if (subType.includes('rockfall') || name.includes('落石')) return 'rockfall';
    return 'break';
};

const getAssetImage = (card) => {
    const kind = inferCardKind(card);
    if (kind === 'dead-end') return '/assets/path_dead_end_custom.svg';
    if (kind === 'path') return '/assets/texture_dirt_1772909600159.png';
    if (kind === 'break') return '/assets/action_sabotage_1772908474814.png';
    if (kind === 'repair') return '/assets/action_repair_custom.svg';
    if (kind === 'map') return '/assets/action_map_custom.svg';
    if (kind === 'rockfall') return '/assets/action_rockfall_1772908530135.png';
    return null;
};

const getTheme = (card) => cardThemes[inferCardKind(card)] || cardThemes.break;

const HandCard = ({
    card, index, totalCards, hoveredIndex, setHoveredIndex,
    onDragStart, isRotated, onToggleRotation, isMobile,
    selected, onSelect, onDiscard
}) => {
    const isHovered = !isMobile && hoveredIndex === index;
    const { rotation } = calculateCardTransform(index, totalCards);
    const cardKind = inferCardKind(card);
    const theme = cardThemes[cardKind] || cardThemes.break;
    const assetImg = getAssetImage(card);
    const isPath = card.type === 'path';
    const cardId = card.id || `card-${index}`;
    const [rotationFlash, setRotationFlash] = useState(false);
    const didMountRef = useRef(false);

    useEffect(() => {
        if (!isPath) return undefined;
        if (!didMountRef.current) {
            didMountRef.current = true;
            return undefined;
        }
        setRotationFlash(true);
        const timer = window.setTimeout(() => setRotationFlash(false), 260);
        return () => window.clearTimeout(timer);
    }, [isPath, isRotated]);

    return (
        <div
            className="relative flex justify-center items-end"
            data-testid={`hand-card-${cardId}`}
            data-card-type={card.type || 'unknown'}
            data-card-kind={cardKind}
            data-card-name={String(card.name || '')}
            data-card-dirs={Array.isArray(card.dirs) ? card.dirs.join('') : ''}
            data-card-rotated={isRotated ? 'true' : 'false'}
            style={{
                transform: `rotate(${isMobile ? 0 : (isHovered ? 0 : rotation)}deg) translateY(${selected ? -10 : (isHovered ? -10 : 0)}px)`,
                zIndex: selected ? 80 : (isHovered ? 60 : index),
                transition: 'transform 0.22s ease, filter 0.22s ease',
                filter: rotationFlash ? 'drop-shadow(0 0 14px rgba(251,191,36,0.5))' : 'none',
            }}
            onMouseEnter={() => { if (!isMobile) setHoveredIndex(index); }}
            onMouseLeave={() => { if (!isMobile) setHoveredIndex(null); }}
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(e, card); }}
            onDragEnd={() => setHoveredIndex(null)}
            onDoubleClick={() => { if (isPath) onToggleRotation?.(cardId); }}
            onClick={() => onSelect?.(card)}
        >
            {isMobile && selected && (
                <div className="pointer-events-none absolute -top-[3.35rem] left-1/2 z-[90] flex -translate-x-1/2 gap-2">
                    {isPath && (
                        <button
                            type="button"
                            data-testid={`rotate-card-${cardId}`}
                            className="pointer-events-auto min-h-11 rounded-full border border-amber-400 bg-amber-700/90 px-3 py-1 text-[11px] font-bold text-white shadow-lg"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleRotation?.(cardId);
                            }}
                        >
                            🔁 旋转
                        </button>
                    )}
                    <button
                        type="button"
                        data-testid={`discard-card-${cardId}`}
                        className="pointer-events-auto min-h-11 rounded-full border border-red-400 bg-red-700/90 px-3 py-1 text-[11px] font-bold text-white shadow-lg"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDiscard?.(card);
                        }}
                    >
                        🗑️ 弃牌
                    </button>
                </div>
            )}

            <div
                className={`w-20 h-32 sm:w-24 sm:h-36 md:w-32 md:h-48 lg:w-36 lg:h-52 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing border-2 shadow-[0_6px_20px_rgba(0,0,0,0.7)] ${selected ? 'border-amber-300 shadow-[0_0_22px_rgba(251,191,36,0.6)]' : (isHovered ? 'border-amber-400' : theme.border)} flex flex-col relative`}
                data-testid={`hand-card-face-${cardId}`}
                style={assetImg ? {
                    backgroundImage: `url(${assetImg})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundColor: '#1c1917',
                } : { backgroundColor: '#1c1917' }}
            >
                <div className="absolute inset-0 bg-black/35 pointer-events-none" />
                {isPath && isRotated && (
                    <div className="absolute right-1.5 top-1.5 z-20 rounded-full border border-amber-300/60 bg-amber-600/90 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-white shadow-lg">
                        已旋转
                    </div>
                )}

                {!isMobile && (
                    <div className="relative px-2 pt-2 pb-1 z-10 flex justify-between">
                        <button
                            className="w-7 h-7 rounded-full bg-red-800/85 active:bg-red-600 border border-red-500/80 flex items-center justify-center transition-all"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); onDiscard?.(card); }}
                            title="弃牌以跳过回合"
                        >
                            <span className="text-white text-[10px] font-bold">✕</span>
                        </button>
                    </div>
                )}

                <div className="relative z-10 px-2 mt-1">
                    <h4 className="text-center text-white text-xs md:text-sm font-bold leading-tight" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.9)' }}>
                        {card.name}
                    </h4>
                </div>

                <div
                    className="flex-1 mx-1.5 mb-1 flex items-center justify-center overflow-hidden z-10"
                    style={{
                        transition: 'transform 0.36s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.22s ease',
                        transform: `rotate(${isRotated ? 180 : 0}deg) scale(${isMobile ? (isRotated ? 1.2 : 1.16) : (isRotated ? 1.08 : 1.02)})`,
                        filter: rotationFlash ? 'brightness(1.2) drop-shadow(0 0 10px rgba(251,191,36,0.45))' : 'none',
                    }}
                >
                    {isPath && (
                        <span
                            className="text-[3.5rem] sm:text-[3.8rem] md:text-5xl text-amber-300 font-black leading-none"
                            style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.9)' }}
                        >
                            {card.name || '🛤️'}
                        </span>
                    )}
                </div>

                <div className="px-2 pb-2 z-10 w-full bg-black/45">
                    <div className={`${theme.labelBg} rounded text-center py-0.5 mb-1 mt-1 mx-1`}>
                        <span className="text-[9px] text-white/80 font-bold tracking-widest uppercase">{theme.label}</span>
                    </div>
                    {isPath && (
                        <div className="bg-amber-800/80 rounded mx-1 mb-1 text-center py-0.5 border border-amber-500/30">
                            <span className="text-[8px] text-amber-200 font-bold tracking-widest leading-none">双击或按钮旋转</span>
                        </div>
                    )}
                    <p className="text-[9px] text-stone-200 text-center leading-tight line-clamp-2 px-1">
                        {card.description || `放置 ${card.name}`}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default function HandCards({
    cards,
    onDragStartCard,
    onDiscardCard,
    selectedCardId,
    onSelectCard,
    rotatedCardIds = {},
    onToggleRotation
}) {
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const displayCards = cards || [];

    return (
        <div className="w-full relative overflow-visible" data-testid="hand-cards">
            <div
                className="overflow-x-auto overflow-y-hidden pb-1"
                style={{
                    paddingTop: isMobile ? '4.35rem' : '0.25rem',
                    paddingLeft: isMobile ? '1.5rem' : '0',
                    paddingRight: isMobile ? '1.5rem' : '0',
                    scrollPaddingLeft: isMobile ? '1.5rem' : '0',
                    scrollPaddingRight: isMobile ? '1.5rem' : '0',
                }}
            >
            <div className="flex justify-start md:justify-center items-end min-w-max px-1 md:px-0" style={{ gap: isMobile ? '0.5rem' : '0.25rem' }}>
                {displayCards.map((card, index) => (
                    <div
                        key={card.id || index}
                        style={{
                            marginLeft: isMobile ? '0' : (index > 0 ? '-1.1rem' : '0'),
                            paddingLeft: isMobile && index === 0 ? '0.25rem' : '0',
                            paddingRight: isMobile && index === displayCards.length - 1 ? '0.25rem' : '0',
                        }}
                    >
                        <HandCard
                            card={card}
                            index={index}
                            totalCards={displayCards.length}
                            hoveredIndex={hoveredIndex}
                            setHoveredIndex={setHoveredIndex}
                            onDragStart={onDragStartCard}
                            onDiscard={onDiscardCard}
                            isRotated={!!rotatedCardIds[card.id || `card-${index}`]}
                            onToggleRotation={onToggleRotation}
                            isMobile={isMobile}
                            selected={selectedCardId === (card.id || `card-${index}`)}
                            onSelect={onSelectCard}
                        />
                    </div>
                ))}
            </div>
            </div>
        </div>
    );
}
