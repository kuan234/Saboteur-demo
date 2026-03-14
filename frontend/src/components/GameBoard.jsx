import React, { useState, useRef } from 'react';

const GRID_COLS = 9;
const GRID_ROWS = 5;
const START_POS = { x: 0, y: 2 };
const GOAL_POSITIONS = [
    { x: 8, y: 0 },
    { x: 8, y: 2 },
    { x: 8, y: 4 },
];

// Path symbol rendering for placed cards
const PathSymbol = ({ name, rotated }) => {
    const symbols = {
        '╋': '╋', '┃': '┃', '━': '━',
        '┳': '┳', '┻': '┻', '┣': '┣', '┫': '┫',
        '┏': '┏', '┓': '┓', '┗': '┗', '┛': '┛',
        '直道': '┃', '十字路口': '╋',
    };
    return (
        <span className={`text-amber-400 text-2xl font-bold drop-shadow-[0_0_6px_rgba(245,158,11,0.8)] ${rotated ? 'rotate-180 inline-block' : ''}`}>
            {symbols[name] || name || '┃'}
        </span>
    );
};

const BoardCard = ({ data }) => {
    if (!data) return null;

    if (data.type === 'start') {
        const startImg = '/assets/card_start_ladder_1772908453714.png';
        return (
            <div className="w-full h-full rounded-md border-2 border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)] flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-cover bg-center opacity-90" style={{ backgroundImage: `url(${startImg})` }} />
                <span className="text-white text-[10px] font-bold tracking-wider relative z-10 drop-shadow-lg bg-black/50 px-1 rounded">起点</span>
            </div>
        );
    }

    if (data.type === 'goal' || data.isGoal) {
        const goalImg = data.revealed
            ? (data.isTreasure ? '/assets/card_goal_gold_1772908413444.png' : '/assets/card_goal_coal_1772908430784.png')
            : '/assets/card_back_default_1772908397043.png';

        return (
            <div className={`w-full h-full rounded-md border-2 relative overflow-hidden transition-all duration-500
        ${data.revealed
                    ? 'border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.8)]'
                    : 'border-stone-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                }`}>
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${goalImg})` }} />

                {/* Optional glow overlay if revealed */}
                {data.revealed && data.isTreasure && (
                    <div className="absolute inset-0 bg-yellow-500/20 mix-blend-overlay pointer-events-none animate-glow-pulse" />
                )}
            </div>
        );
    }

    // Normal path card using dirt texture
    const dirtImg = '/assets/texture_dirt_1772909600159.png';
    return (
        <div className="w-full h-full rounded-md border-2 border-amber-800/80 shadow-[0_2px_6px_rgba(0,0,0,0.6)] flex items-center justify-center relative overflow-hidden animate-card-stamp">
            <div className="absolute inset-0 bg-cover bg-center opacity-80" style={{ backgroundImage: `url(${dirtImg})` }} />
            <div className="absolute inset-0 bg-black/30 pointer-events-none" />
            <span className="relative z-10 text-amber-400 font-bold" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.9)' }}>
                <PathSymbol name={data.name} rotated={data.rotated} />
            </span>
        </div>
    );
};

export default function GameBoard({ draggingCard, draggingRotation, onDropCard, serverBoard }) {
    const [hoveredCell, setHoveredCell] = useState(null);
    const [mobileScale, setMobileScale] = useState(1);
    const pinchRef = useRef({ distance: 0, startScale: 1 });

    const clampScale = (value) => Math.max(0.85, Math.min(1.8, value));

    const getCellContent = (x, y) => {
        if (!serverBoard) return null;
        // Server Y = GameBoard Y - 2
        return serverBoard[`${x},${y - 2}`];
    };

    const isValidPlacement = (x, y) => {
        const cell = getCellContent(x, y);

        // If we are dragging an action card that acts on the board:
        if (draggingCard && draggingCard.type === 'action') {
            if (draggingCard.subType === 'map') {
                return cell && cell.type === 'goal'; // Can only drop Map on Goal
            }
            if (draggingCard.subType === 'rockfall') {
                return cell && cell.type === 'path'; // Can only drop rockfall on placed paths
            }
            return false; // Other action cards (sabotage/repair) drop on players
        }

        // Standard Path card logic
        if (cell) return false; // Cannot place a path where there is already a card
        return !!(getCellContent(x + 1, y) || getCellContent(x - 1, y) || getCellContent(x, y + 1) || getCellContent(x, y - 1));
    };

    const handleDragOver = (e, x, y) => {
        e.preventDefault();
        if (!draggingCard) return;
        if (hoveredCell?.x !== x || hoveredCell?.y !== y) setHoveredCell({ x, y });
    };
    const handleDragLeave = () => setHoveredCell(null);

    const handleDrop = (e, x, y) => {
        e.preventDefault();
        setHoveredCell(null);
        if (!draggingCard) return;
        if (isValidPlacement(x, y)) {
            // Let GamePage / Socket handle the real placement
            if (onDropCard) onDropCard(draggingCard, { x, y }, draggingRotation);
        }
    };


    const getTouchDistance = (touches) => {
        if (!touches || touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e) => {
        if (e.touches.length !== 2) return;
        const distance = getTouchDistance(e.touches);
        pinchRef.current = { distance, startScale: mobileScale };
    };

    const handleTouchMove = (e) => {
        if (e.touches.length !== 2 || !pinchRef.current.distance) return;
        e.preventDefault();
        const distance = getTouchDistance(e.touches);
        const ratio = distance / pinchRef.current.distance;
        setMobileScale(clampScale(pinchRef.current.startScale * ratio));
    };

    const cells = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const cellData = getCellContent(c, r);
            const isHov = hoveredCell?.x === c && hoveredCell?.y === r;
            const valid = isValidPlacement(c, r);

            let borderCls = 'border border-amber-900/20';
            let glowCls = '';

            if (isHov && draggingCard) {
                if (valid) {
                    borderCls = 'border-2 border-green-400 border-dashed';
                    glowCls = 'bg-green-500/15 shadow-[inset_0_0_15px_rgba(74,222,128,0.3)]';
                } else {
                    borderCls = 'border-2 border-red-500 border-dashed';
                    glowCls = 'bg-red-500/15 shadow-[inset_0_0_15px_rgba(239,68,68,0.3)]';
                }
            }

            cells.push(
                <div
                    key={`${c},${r}`}
                    className={`w-full h-full rounded-md transition-all duration-150 relative ${borderCls} ${glowCls}`}
                    data-testid={`board-cell-${c}-${r}`}
                    data-board-cell={`${c},${r - 2}`}
                    onDragOver={(e) => handleDragOver(e, c, r)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, c, r)}
                >
                    {cellData && <BoardCard data={cellData} />}
                    {!cellData && isHov && valid && draggingCard && (
                        <div className="absolute inset-0 rounded-md opacity-50 pointer-events-none">
                            <div className={`w-full h-full rounded-md bg-amber-800/40 border border-amber-500/50 flex items-center justify-center ${draggingRotation ? 'rotate-180' : ''}`}>
                                <span className="text-amber-400/60 text-xl">┃</span>
                            </div>
                        </div>
                    )}
                    {!cellData && isHov && !valid && draggingCard && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-red-500/80 text-xl">✖</span>
                        </div>
                    )}
                </div>
            );
        }
    }

    return (
        <div className="relative w-full h-full flex items-center justify-center" data-testid="game-board-shell">
            {/* Dirt / Earth textured board background */}
            <div
                className="relative w-[98%] sm:w-[94%] md:w-[80%] lg:w-[70%] max-w-[900px] aspect-[6/5] rounded-xl md:rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9),inset_0_0_80px_rgba(0,0,0,0.6)]"
                data-testid="game-board"
                style={{
                    background: 'radial-gradient(ellipse at center, #3d2b1a 0%, #1a120b 80%)',
                    border: '4px solid rgba(120,80,40,0.5)',
                    transform: `scale(${mobileScale})`,
                    transformOrigin: 'center center',
                    touchAction: 'none',
                    transition: 'transform 120ms ease-out',
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
            >
                {/* Inner dirt texture overlay */}
                <div className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ background: 'repeating-conic-gradient(#2a1f14 0% 25%, #1e1610 0% 50%) 0 0 / 30px 30px' }} />

                {/* The Grid */}
                <div className="absolute inset-2 sm:inset-4 md:inset-6 lg:inset-8 flex items-center justify-center">
                    <div className="grid gap-1.5 w-full h-full"
                        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))` }}>
                        {cells}
                    </div>
                </div>

                <div className="absolute top-2 right-2 z-20 flex gap-1 md:hidden">
                    <button onClick={() => setMobileScale((v) => clampScale(v - 0.1))} className="w-7 h-7 rounded bg-black/70 border border-stone-500 text-stone-200 text-sm">－</button>
                    <button onClick={() => setMobileScale(1)} className="px-2 h-7 rounded bg-black/70 border border-stone-500 text-stone-200 text-[10px] font-bold">100%</button>
                    <button onClick={() => setMobileScale((v) => clampScale(v + 0.1))} className="w-7 h-7 rounded bg-black/70 border border-stone-500 text-stone-200 text-sm">＋</button>
                </div>

                {/* Rotation hint */}
                {draggingCard && (
                    <div className="pointer-events-none absolute bottom-3 left-3 bg-black/70 text-amber-500 text-xs px-3 py-1.5 rounded-lg border border-amber-800/50 animate-glow-pulse font-bold">
                        当前选中卡牌 ({draggingRotation ? '已旋转' : '未旋转'})
                    </div>
                )}
            </div>
        </div>
    );
}
