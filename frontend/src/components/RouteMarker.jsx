import React from 'react';

export default function RouteMarker({
    dirs = [],
    size = 28,
    deadEnd = false,
    className = '',
}) {
    const normalizedDirs = Array.isArray(dirs) && dirs.length === 4 ? dirs : [0, 0, 0, 0];
    const stroke = deadEnd ? '#fda4af' : '#fcd34d';
    const fill = deadEnd ? '#fb7185' : '#fde68a';
    const frame = deadEnd ? 'rgba(251,113,133,0.3)' : 'rgba(252,211,77,0.32)';
    const bg = deadEnd ? 'rgba(69,10,10,0.7)' : 'rgba(24,24,27,0.68)';

    return (
        <div
            className={`overflow-hidden rounded-full border shadow-[0_4px_10px_rgba(0,0,0,0.35)] ${className}`}
            style={{
                width: size,
                height: size,
                borderColor: frame,
                backgroundColor: bg,
            }}
        >
            <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
                {normalizedDirs[0] === 1 && (
                    <line x1="50" y1="12" x2="50" y2="50" stroke={stroke} strokeWidth="16" strokeLinecap="round" />
                )}
                {normalizedDirs[1] === 1 && (
                    <line x1="50" y1="50" x2="88" y2="50" stroke={stroke} strokeWidth="16" strokeLinecap="round" />
                )}
                {normalizedDirs[2] === 1 && (
                    <line x1="50" y1="50" x2="50" y2="88" stroke={stroke} strokeWidth="16" strokeLinecap="round" />
                )}
                {normalizedDirs[3] === 1 && (
                    <line x1="12" y1="50" x2="50" y2="50" stroke={stroke} strokeWidth="16" strokeLinecap="round" />
                )}
                <circle cx="50" cy="50" r="14" fill={fill} />
            </svg>
        </div>
    );
}
