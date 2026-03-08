import React, { useState } from 'react';

// ===== Tool Status Icon — shows specific tool emoji with OK/broken state =====
const ToolIcon = ({ type, isOkay }) => {
    const icons = { pickaxe: '⛏️', lantern: '💡', cart: '🛒' };
    const labels = { pickaxe: '镐子', lantern: '油灯', cart: '矿车' };

    return (
        <div className="relative group/tool" title={`${labels[type]}: ${isOkay ? '正常' : '已损坏'}`}>
            <div className={`w-7 h-7 rounded-md flex items-center justify-center transition-all duration-300
        ${isOkay
                    ? 'bg-stone-700/60 border border-stone-600/50'
                    : 'bg-red-950/60 border border-red-800/60'
                }`}>
                <span className={`text-sm transition-all ${isOkay ? 'drop-shadow-[0_0_4px_rgba(74,222,128,0.6)]' : 'opacity-30 grayscale'}`}>
                    {icons[type]}
                </span>
                {!isOkay && (
                    <span className="absolute inset-0 flex items-center justify-center">
                        <span className="text-red-500 text-base font-bold drop-shadow-md">✖</span>
                    </span>
                )}
            </div>
        </div>
    );
};

// ===== Individual Player Card =====
const PlayerCard = ({ player, isCurrentTurn, isMe, draggingCard, onDropOnPlayer }) => {
    const [isHovered, setIsHovered] = useState(false);

    const isActionCard = draggingCard && draggingCard.type === 'action' && (draggingCard.subType === 'sabotage' || draggingCard.subType === 'repair');

    // Check if the drop action is valid (e.g. sabotage needs unbroken tool, repair needs broken tool)
    const isValidTarget = isActionCard && (() => {
        if (draggingCard.subType === 'sabotage') {
            return player.tools && player.tools[draggingCard.tool] === true;
        } else if (draggingCard.subType === 'repair') {
            return player.tools && draggingCard.tools.some(t => player.tools[t] === false);
        }
        return false;
    })();

    const handleDragOver = (e) => {
        if (!isActionCard) return;
        e.preventDefault();
        setIsHovered(true);
    };

    const handleDragLeave = () => {
        setIsHovered(false);
    };

    const handleDrop = (e) => {
        if (!isActionCard) return;
        e.preventDefault();
        setIsHovered(false);
        if (isValidTarget && onDropOnPlayer) {
            onDropOnPlayer(draggingCard, player.id);
        }
    };

    return (
        <div
            className={`flex flex-col items-center mx-1.5 cursor-pointer transition-all duration-300
      ${isCurrentTurn ? '' : 'opacity-50'} relative ${isHovered && isActionCard ? (isValidTarget ? 'scale-110 drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]' : 'scale-110 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]') : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >

            {/* "你" badge for self */}
            {isMe && (
                <span className="text-[9px] text-amber-500 font-bold mb-0.5 tracking-widest uppercase bg-amber-900/40 px-2 rounded-full border border-amber-700/30">
                    你
                </span>
            )}

            {/* Circular Avatar with ornate gold border */}
            <div className={`relative w-14 h-14 md:w-16 md:h-16 rounded-full border-[3px] flex items-center justify-center
        ${isCurrentTurn
                    ? 'border-amber-400 shadow-[0_0_18px_rgba(212,175,55,0.8)] animate-breathe-gold'
                    : 'border-stone-600 shadow-md'
                }
        bg-gradient-to-b from-stone-700 to-stone-900 overflow-hidden`}>
                <span className="text-2xl md:text-3xl drop-shadow-lg select-none">{player.avatar || '🧔'}</span>
                {/* Inner gold ring ornament */}
                <div className="absolute inset-0 rounded-full border-2 border-amber-700/20 pointer-events-none" />
                {/* Active turn glow ring */}
                {isCurrentTurn && (
                    <div className="absolute -inset-1 rounded-full border border-amber-400/40 pointer-events-none animate-glow-pulse" />
                )}
            </div>

            {/* Player Name */}
            <span className={`mt-1 text-[11px] font-bold tracking-wide max-w-[80px] truncate
        ${isCurrentTurn ? 'text-amber-400 drop-shadow-[0_0_6px_rgba(212,175,55,0.5)]' : 'text-stone-500'}`}>
                {player.name}
            </span>

            {/* Tool Status Row */}
            <div className="flex space-x-0.5 mt-1">
                <ToolIcon type="pickaxe" isOkay={player.tools?.pickaxe !== false} />
                <ToolIcon type="lantern" isOkay={player.tools?.lantern !== false} />
                <ToolIcon type="cart" isOkay={player.tools?.cart !== false} />
            </div>

            {/* Card Count Badge */}
            <div className={`mt-1 flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold
        ${isCurrentTurn ? 'bg-amber-900/50 text-amber-400 border border-amber-700/40' : 'bg-stone-800/60 text-stone-500 border border-stone-700/30'}`}>
                <span>🃏</span>
                <span>{player.cardCount ?? '?'}</span>
            </div>
        </div>
    );
};

// ===== Main PlayerBar Component =====
export default function PlayerBar({ players, currentTurnId, myPlayerId, draggingCard, onDropOnPlayer }) {
    if (!players || players.length === 0) return null;

    return (
        <div className="absolute top-0 left-0 right-0 z-30 flex justify-center items-start pt-2 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, rgba(10,7,5,0.95) 0%, rgba(10,7,5,0.4) 75%, transparent 100%)' }}>
            <div className="flex items-end space-x-1 md:space-x-2 pointer-events-auto px-4 pt-1 pb-2">
                {players.map(p => (
                    <PlayerCard
                        key={p.id}
                        player={p}
                        isCurrentTurn={p.id === currentTurnId}
                        isMe={p.id === myPlayerId}
                        draggingCard={draggingCard}
                        onDropOnPlayer={onDropOnPlayer}
                    />
                ))}
            </div>
        </div>
    );
}
