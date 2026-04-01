import React, { useRef, useState } from 'react';
import { getCardArt, inferCardKind } from './handCardArt';
import RouteMarker from './RouteMarker';

const GRID_COLS = 9;
const GRID_ROWS = 5;
const SERVER_START_POS = { x: 0, y: 0 };
const BOARD_MIN_X = 0;
const BOARD_MAX_X = GRID_COLS - 1;
const BOARD_MIN_Y = -2;
const BOARD_MAX_Y = 2;
const CARD_DIRECTIONS = [
    { dx: 0, dy: -1, from: 0, to: 2 },
    { dx: 1, dy: 0, from: 1, to: 3 },
    { dx: 0, dy: 1, from: 2, to: 0 },
    { dx: -1, dy: 0, from: 3, to: 1 },
];

const coordKey = (x, y) => `${x},${y}`;
const hasPathDirs = (card) => Array.isArray(card?.dirs) && card.dirs.length === 4;
const rotateDirs180 = (dirs = []) => (
    Array.isArray(dirs) && dirs.length === 4 ? [dirs[2], dirs[3], dirs[0], dirs[1]] : dirs
);
const isWithinBoardBounds = (x, y) => (
    Number.isInteger(x)
    && Number.isInteger(y)
    && x >= BOARD_MIN_X
    && x <= BOARD_MAX_X
    && y >= BOARD_MIN_Y
    && y <= BOARD_MAX_Y
);

const getReachablePathCoords = (board = {}) => {
    const visited = new Set();
    const startKey = coordKey(SERVER_START_POS.x, SERVER_START_POS.y);
    const startCard = board[startKey];
    if (!hasPathDirs(startCard)) {
        return visited;
    }

    const queue = [startKey];
    visited.add(startKey);

    while (queue.length > 0) {
        const currentKey = queue.shift();
        const [x, y] = currentKey.split(',').map(Number);
        const currentCard = board[currentKey];
        if (!hasPathDirs(currentCard)) continue;

        CARD_DIRECTIONS.forEach(({ dx, dy, from, to }) => {
            if (currentCard.dirs[from] !== 1) return;

            const nextKey = coordKey(x + dx, y + dy);
            const nextCard = board[nextKey];
            if (!hasPathDirs(nextCard) || nextCard.dirs[to] !== 1 || visited.has(nextKey)) {
                return;
            }

            visited.add(nextKey);
            queue.push(nextKey);
        });
    }

    return visited;
};

const PathCardFace = ({ card, isPreview = false }) => {
    if (!hasPathDirs(card)) return null;

    const cardKind = inferCardKind(card);
    const cardArt = getCardArt(card);
    const cardImageRotation = cardArt.rotation || 0;

    return (
        <div className={`relative h-full w-full overflow-hidden rounded-md ${isPreview ? 'border border-amber-500/50 bg-amber-900/20' : 'border-2 border-amber-800/80 shadow-[0_2px_6px_rgba(0,0,0,0.6)] animate-card-stamp'}`}>
            <div className="absolute inset-[0.16rem] overflow-hidden rounded-[0.42rem] border border-white/10 bg-stone-900/75">
                <img
                    src={cardArt.src}
                    alt={String(card.name || 'path')}
                    className="h-full w-full select-none object-cover pointer-events-none"
                    draggable={false}
                    style={{
                        transform: `rotate(${cardImageRotation}deg) scale(${cardArt.showLargeGlyph ? 1.02 : 1.08})`,
                        transition: 'transform 0.28s ease, opacity 0.18s ease',
                    }}
                />

                {cardArt.showLargeGlyph && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <RouteMarker
                            dirs={card.dirs}
                            deadEnd={cardKind === 'dead-end'}
                            size={42}
                            className="bg-black/55 backdrop-blur-sm"
                        />
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/35 pointer-events-none" />
            </div>
        </div>
    );
};

const BoardCard = ({ data }) => {
    if (!data) return null;

    const rotation = Number(data.rotation) || 0;
    const isRotated = Boolean(data.rotated) || (Math.abs(rotation) % 360 === 180);

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
            <div
                className={`w-full h-full rounded-md border-2 relative overflow-hidden transition-all duration-500 ${data.revealed
                    ? 'border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.8)]'
                    : 'border-stone-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                    }`}
            >
                <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${goalImg})` }} />

                {data.revealed && data.isTreasure && (
                    <div className="absolute inset-0 bg-yellow-500/20 mix-blend-overlay pointer-events-none animate-glow-pulse" />
                )}
            </div>
        );
    }

    return (
        <div
            className="w-full h-full"
            data-board-rotated={isRotated ? 'true' : 'false'}
            data-board-rotation={String(rotation)}
        >
            <PathCardFace card={data} />
        </div>
    );
};

export default function GameBoard({ draggingCard, draggingRotation, onDropCard, serverBoard }) {
    const [hoveredCell, setHoveredCell] = useState(null);
    const [mobileScale, setMobileScale] = useState(1);
    const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 });
    const boardViewportRef = useRef(null);
    const scaleRef = useRef(1);
    const offsetRef = useRef({ x: 0, y: 0 });
    const gestureRef = useRef({
        mode: null,
        distance: 0,
        startScale: 1,
        startOffset: { x: 0, y: 0 },
        startPoint: null,
    });

    const clampScale = (value) => Math.max(0.85, Math.min(1.8, value));
    const resetGesture = () => {
        gestureRef.current = {
            mode: null,
            distance: 0,
            startScale: scaleRef.current,
            startOffset: offsetRef.current,
            startPoint: null,
        };
    };
    const clampOffset = (nextOffset, scale = scaleRef.current) => {
        const viewport = boardViewportRef.current;
        if (!viewport) return nextOffset;

        const width = viewport.clientWidth || viewport.getBoundingClientRect().width;
        const height = viewport.clientHeight || viewport.getBoundingClientRect().height;
        const maxX = Math.max(0, ((scale - 1) * width) / 2);
        const maxY = Math.max(0, ((scale - 1) * height) / 2);

        return {
            x: Math.max(-maxX, Math.min(maxX, nextOffset.x)),
            y: Math.max(-maxY, Math.min(maxY, nextOffset.y)),
        };
    };
    const applyScale = (nextScale) => {
        const clampedScale = clampScale(nextScale);
        scaleRef.current = clampedScale;
        setMobileScale(clampedScale);

        const nextOffset = clampedScale <= 1
            ? { x: 0, y: 0 }
            : clampOffset(offsetRef.current, clampedScale);
        offsetRef.current = nextOffset;
        setBoardOffset(nextOffset);
    };
    const applyOffset = (nextOffset, scale = scaleRef.current) => {
        const clampedOffset = scale <= 1 ? { x: 0, y: 0 } : clampOffset(nextOffset, scale);
        offsetRef.current = clampedOffset;
        setBoardOffset(clampedOffset);
    };

    const getCellContent = (x, y) => {
        if (!serverBoard) return null;
        return serverBoard[`${x},${y - 2}`];
    };

    const isValidPlacement = (x, y) => {
        const cell = getCellContent(x, y);
        const targetServerY = y - 2;

        if (draggingCard && draggingCard.type === 'action') {
            if (draggingCard.subType === 'map') {
                return cell && cell.type === 'goal';
            }
            if (draggingCard.subType === 'rockfall') {
                return cell && cell.type === 'path';
            }
            return false;
        }

        if (cell) return false;
        if (!draggingCard?.dirs || !isWithinBoardBounds(x, targetServerY)) return false;

        const targetDirs = draggingRotation ? rotateDirs180(draggingCard.dirs) : draggingCard.dirs;
        const reachable = getReachablePathCoords(serverBoard);
        let hasNeighbor = false;
        let validMatch = true;
        let connectsToReachablePath = false;

        CARD_DIRECTIONS.forEach(({ dx, dy, from, to }) => {
            const neighborKey = coordKey(x + dx, targetServerY + dy);
            const neighbor = serverBoard?.[neighborKey];

            if (!hasPathDirs(neighbor)) return;

            hasNeighbor = true;
            if (neighbor.dirs[to] !== targetDirs[from]) {
                validMatch = false;
                return;
            }

            if (neighbor.dirs[to] === 1 && targetDirs[from] === 1 && reachable.has(neighborKey)) {
                connectsToReachablePath = true;
            }
        });

        return hasNeighbor && validMatch && connectsToReachablePath;
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
            if (onDropCard) onDropCard(draggingCard, { x, y }, draggingRotation);
        }
    };

    const getTouchDistance = (touches) => {
        if (!touches || touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };
    const getTouchPoint = (touch) => ({
        x: touch?.clientX || 0,
        y: touch?.clientY || 0,
    });

    const handleTouchStart = (e) => {
        if (e.touches.length === 2) {
            const distance = getTouchDistance(e.touches);
            gestureRef.current = {
                mode: 'pinch',
                distance,
                startScale: scaleRef.current,
                startOffset: offsetRef.current,
                startPoint: null,
            };
            return;
        }

        if (e.touches.length === 1 && scaleRef.current > 1.01) {
            gestureRef.current = {
                mode: 'pan',
                distance: 0,
                startScale: scaleRef.current,
                startOffset: offsetRef.current,
                startPoint: getTouchPoint(e.touches[0]),
            };
        }
    };

    const handleTouchMove = (e) => {
        if (e.touches.length === 2 && gestureRef.current.mode === 'pinch' && gestureRef.current.distance) {
            e.preventDefault();
            const distance = getTouchDistance(e.touches);
            const ratio = distance / gestureRef.current.distance;
            const nextScale = clampScale(gestureRef.current.startScale * ratio);

            scaleRef.current = nextScale;
            setMobileScale(nextScale);
            applyOffset(gestureRef.current.startOffset, nextScale);
            return;
        }

        if (e.touches.length === 1 && gestureRef.current.mode === 'pan' && scaleRef.current > 1.01) {
            e.preventDefault();
            const point = getTouchPoint(e.touches[0]);
            const dx = point.x - gestureRef.current.startPoint.x;
            const dy = point.y - gestureRef.current.startPoint.y;
            applyOffset({
                x: gestureRef.current.startOffset.x + dx,
                y: gestureRef.current.startOffset.y + dy,
            });
        }
    };

    const handleTouchEnd = (e) => {
        if (e.touches.length === 1 && scaleRef.current > 1.01) {
            gestureRef.current = {
                mode: 'pan',
                distance: 0,
                startScale: scaleRef.current,
                startOffset: offsetRef.current,
                startPoint: getTouchPoint(e.touches[0]),
            };
            return;
        }

        resetGesture();
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
                    {!cellData && isHov && valid && draggingCard?.type === 'path' && (
                        <div className="absolute inset-0 rounded-md opacity-55 pointer-events-none">
                            <PathCardFace
                                card={draggingRotation ? { ...draggingCard, dirs: rotateDirs180(draggingCard.dirs) } : draggingCard}
                                isPreview
                            />
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
            <div
                ref={boardViewportRef}
                className="relative w-[98%] sm:w-[94%] md:w-[80%] lg:w-[70%] max-w-[900px] aspect-[6/5] rounded-xl md:rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.9),inset_0_0_80px_rgba(0,0,0,0.6)]"
                data-testid="game-board"
                style={{
                    background: 'radial-gradient(ellipse at center, #3d2b1a 0%, #1a120b 80%)',
                    border: '4px solid rgba(120,80,40,0.5)',
                    touchAction: 'none',
                    cursor: mobileScale > 1.01 ? 'grab' : 'default',
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
            >
                <div
                    className="absolute inset-0"
                    style={{
                        transform: `translate(${boardOffset.x}px, ${boardOffset.y}px) scale(${mobileScale})`,
                        transformOrigin: 'center center',
                        transition: gestureRef.current.mode ? 'none' : 'transform 120ms ease-out',
                    }}
                >
                    <div
                        className="absolute inset-0 opacity-20 pointer-events-none"
                        style={{ background: 'repeating-conic-gradient(#2a1f14 0% 25%, #1e1610 0% 50%) 0 0 / 30px 30px' }}
                    />

                    <div className="absolute inset-2 sm:inset-4 md:inset-6 lg:inset-8 flex items-center justify-center">
                        <div
                            className="grid gap-1.5 w-full h-full"
                            style={{
                                gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
                                gridTemplateRows: `repeat(${GRID_ROWS}, minmax(0, 1fr))`,
                            }}
                        >
                            {cells}
                        </div>
                    </div>
                </div>

                <div className="absolute top-2 right-2 z-20 flex gap-1 md:hidden">
                    <button onClick={() => applyScale(scaleRef.current - 0.1)} className="w-7 h-7 rounded bg-black/70 border border-stone-500 text-stone-200 text-sm">-</button>
                    <button onClick={() => { applyScale(1); applyOffset({ x: 0, y: 0 }, 1); }} className="px-2 h-7 rounded bg-black/70 border border-stone-500 text-stone-200 text-[10px] font-bold">100%</button>
                    <button onClick={() => applyScale(scaleRef.current + 0.1)} className="w-7 h-7 rounded bg-black/70 border border-stone-500 text-stone-200 text-sm">+</button>
                </div>

                {mobileScale > 1.01 && !draggingCard && (
                    <div className="pointer-events-none absolute top-2 left-2 z-20 rounded bg-black/70 px-2 py-1 text-[10px] font-bold text-stone-200 md:hidden">
                        单指拖动查看地图
                    </div>
                )}

                {draggingCard && (
                    <div className="pointer-events-none absolute bottom-3 left-3 bg-black/70 text-amber-500 text-xs px-3 py-1.5 rounded-lg border border-amber-800/50 animate-glow-pulse font-bold">
                        当前选中卡牌 ({draggingRotation ? '已旋转' : '未旋转'})
                    </div>
                )}
            </div>
        </div>
    );
}
