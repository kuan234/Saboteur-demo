import React, { useEffect, useRef, useState } from 'react';
import {
    getCardArt,
    getCardHint,
    getDirsKey,
    getTheme,
    inferCardKind,
} from './handCardArt';

const calculateCardTransform = (index, totalCards) => {
    if (totalCards <= 1) return { rotation: 0 };
    const maxRotation = totalCards <= 3 ? 8 : 12;
    const normalizedIndex = (index - (totalCards - 1) / 2) / ((totalCards - 1) / 2 || 1);
    return { rotation: normalizedIndex * maxRotation };
};

const HandCard = ({
    card,
    index,
    totalCards,
    hoveredIndex,
    setHoveredIndex,
    onDragStart,
    isRotated,
    onToggleRotation,
    isMobile,
    selected,
    onSelect,
    onDiscard,
}) => {
    const isHovered = !isMobile && hoveredIndex === index;
    const { rotation } = calculateCardTransform(index, totalCards);
    const cardKind = inferCardKind(card);
    const theme = getTheme(cardKind);
    const cardArt = getCardArt(card);
    const isPath = card.type === 'path';
    const cardId = card.id || `card-${index}`;
    const glyph = card.name || '🛤️';
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

    const cardImageRotation = (cardArt.rotation || 0) + (isPath && isRotated ? 180 : 0);

    return (
        <div
            className="relative flex justify-center items-end"
            data-testid={`hand-card-${cardId}`}
            data-card-type={card.type || 'unknown'}
            data-card-kind={cardKind}
            data-card-name={String(card.name || '')}
            data-card-dirs={getDirsKey(card)}
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
            onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                onDragStart(event, card);
            }}
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
                            onClick={(event) => {
                                event.stopPropagation();
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
                        onClick={(event) => {
                            event.stopPropagation();
                            onDiscard?.(card);
                        }}
                    >
                        🗑️ 弃牌
                    </button>
                </div>
            )}

            <div
                className={`w-20 h-32 sm:w-24 sm:h-36 md:w-32 md:h-48 lg:w-36 lg:h-52 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing border-2 shadow-[0_6px_20px_rgba(0,0,0,0.7)] ${selected ? 'border-amber-300 shadow-[0_0_22px_rgba(251,191,36,0.6)]' : (isHovered ? 'border-amber-400' : theme.border)} flex flex-col relative bg-stone-950`}
                data-testid={`hand-card-face-${cardId}`}
            >
                <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/15 via-transparent to-black/40 pointer-events-none" />

                {isPath && isRotated && (
                    <div className="absolute right-1.5 top-1.5 z-20 rounded-full border border-amber-300/60 bg-amber-600/90 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-white shadow-lg">
                        已旋转
                    </div>
                )}

                {!isMobile && (
                    <div className="relative z-20 flex justify-between px-2 pb-1 pt-2">
                        <button
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-red-500/80 bg-red-800/85 text-white transition-all active:bg-red-600"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                                event.stopPropagation();
                                onDiscard?.(card);
                            }}
                            title="弃牌以跳过回合"
                        >
                            <span className="text-[10px] font-bold">✕</span>
                        </button>
                    </div>
                )}

                <div className="relative z-20 mt-1 px-2">
                    <h4 className="text-center text-xs font-bold leading-tight text-white md:text-sm" style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.9)' }}>
                        {card.name}
                    </h4>
                </div>

                <div className="relative z-10 mx-1.5 mb-1 mt-1 flex-1 overflow-hidden rounded-lg border border-white/10 bg-stone-900/70">
                    <img
                        src={cardArt.src}
                        alt={String(card.name || 'card')}
                        className="h-full w-full select-none object-cover pointer-events-none"
                        draggable={false}
                        style={{
                            transform: `rotate(${cardImageRotation}deg) scale(${cardArt.showLargeGlyph ? 1.06 : 1.14})`,
                            transition: 'transform 0.36s cubic-bezier(0.2, 0.8, 0.2, 1), filter 0.22s ease',
                            filter: rotationFlash ? 'brightness(1.2) drop-shadow(0 0 10px rgba(251,191,36,0.45))' : 'none',
                        }}
                    />

                    {isPath && cardArt.showLargeGlyph && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span
                                className="text-[3.2rem] font-black leading-none text-amber-300 sm:text-[3.6rem] md:text-5xl"
                                style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.9)' }}
                            >
                                {glyph}
                            </span>
                        </div>
                    )}

                    {isPath && !cardArt.showLargeGlyph && (
                        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-sm font-black text-amber-200 shadow-lg">
                            {glyph}
                        </div>
                    )}
                </div>

                <div className="z-20 w-full bg-black/45 px-2 pb-2">
                    <div className={`${theme.labelBg} mx-1 mb-1 mt-1 rounded py-0.5 text-center`}>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-white/80">{theme.label}</span>
                    </div>
                    {isPath && (
                        <div className="mx-1 mb-1 rounded border border-amber-500/30 bg-amber-800/80 py-0.5 text-center">
                            <span className="text-[8px] font-bold leading-none tracking-widest text-amber-200">双击或按按钮旋转</span>
                        </div>
                    )}
                    <p className="line-clamp-2 px-1 text-center text-[9px] leading-tight text-stone-200">
                        {getCardHint(card, cardKind)}
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
    onToggleRotation,
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
        <div className="relative w-full overflow-visible" data-testid="hand-cards">
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
                <div className="flex min-w-max items-end justify-start gap-2 px-1 md:justify-center md:gap-1 md:px-0">
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
