import React from 'react';

export const TOOL_LABELS = {
    pickaxe: '\u9550\u5b50',
    lantern: '\u6cb9\u706f',
    cart: '\u77ff\u8f66',
};

const TOOL_ORDER = ['pickaxe', 'lantern', 'cart'];

const BADGE_TONES = {
    sabotage: {
        badge: 'border-red-300/60 bg-red-950/88 text-red-50 shadow-[0_0_18px_rgba(239,68,68,0.34)]',
        iconWrap: 'border-red-200/35 bg-red-500/15 text-red-50',
    },
    repair: {
        badge: 'border-cyan-300/60 bg-cyan-950/88 text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.28)]',
        iconWrap: 'border-cyan-200/35 bg-cyan-400/15 text-cyan-50',
    },
};

const uniq = (items) => Array.from(new Set(items.filter(Boolean)));

export const getActionTools = (card) => {
    const subType = String(card?.subType || card?.actionType || '').toLowerCase();
    if (subType === 'sabotage') {
        return uniq([card?.tool]).sort((left, right) => TOOL_ORDER.indexOf(left) - TOOL_ORDER.indexOf(right));
    }
    if (subType === 'repair') {
        const repairTools = Array.isArray(card?.tools) ? card.tools : [card?.tool];
        return uniq(repairTools).sort((left, right) => TOOL_ORDER.indexOf(left) - TOOL_ORDER.indexOf(right));
    }
    return [];
};

export const getActionToolLabel = (card) => (
    getActionTools(card).map((tool) => TOOL_LABELS[tool] || tool).join(' / ')
);

const getBadgeTone = (card) => {
    const subType = String(card?.subType || card?.actionType || '').toLowerCase();
    if (subType === 'sabotage') return 'sabotage';
    if (subType === 'repair') return 'repair';
    return null;
};

export function ToolGlyph({ type, className = '' }) {
    if (type === 'pickaxe') {
        return (
            <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
                <path
                    d="M18 23c7-7 19-11 29-8 5 2 9 5 12 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                />
                <path
                    d="M38 28L23 43"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                />
                <path
                    d="M25 41l14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                />
            </svg>
        );
    }

    if (type === 'lantern') {
        return (
            <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
                <path
                    d="M24 18c0-5 4-9 8-9s8 4 8 9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                />
                <rect
                    x="18"
                    y="18"
                    width="28"
                    height="32"
                    rx="9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4.5"
                />
                <path
                    d="M32 25c4 5 7 8 7 13 0 4-3 8-7 8s-7-4-7-8c0-5 3-8 7-13Z"
                    fill="currentColor"
                />
            </svg>
        );
    }

    return (
        <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
            <path
                d="M16 20h36l-5 22H21Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="4.5"
                strokeLinejoin="round"
            />
            <path
                d="M14 20h8"
                fill="none"
                stroke="currentColor"
                strokeWidth="4.5"
                strokeLinecap="round"
            />
            <circle cx="27" cy="50" r="4" fill="currentColor" />
            <circle cx="43" cy="50" r="4" fill="currentColor" />
        </svg>
    );
}

export default function ActionToolBadge({ card, className = '', ...props }) {
    const tools = getActionTools(card);
    const tone = getBadgeTone(card);

    if (!tone || tools.length === 0) return null;

    const styles = BADGE_TONES[tone];
    const label = `${tone === 'sabotage' ? '\u7834\u574f\u76ee\u6807' : '\u4fee\u7406\u76ee\u6807'}: ${getActionToolLabel(card)}`;

    return (
        <div
            className={`flex items-center gap-1 rounded-full border px-1.5 py-1 backdrop-blur-sm ${styles.badge} ${className}`}
            title={label}
            {...props}
        >
            {tools.map((tool) => (
                <span
                    key={tool}
                    className={`flex h-5 w-5 items-center justify-center rounded-full border ${styles.iconWrap}`}
                >
                    <ToolGlyph type={tool} className="h-3.5 w-3.5" />
                </span>
            ))}
        </div>
    );
}
