import React from 'react';
import {
    getCardArt,
    getCompactCardName,
    getDisplayedDirs,
    getDisplayedDirsKey,
    getDirsKey,
    getTheme,
    inferCardKind,
} from '../components/handCardArt';
import RouteMarker from '../components/RouteMarker';

const PREVIEW_GROUPS = [
    {
        title: '普通路径牌',
        description: '这些是目前已经有明确图片映射的普通道路牌，以及还在用兜底图的牌型。',
        cards: [
            { id: 'path-cross', name: '十字路', type: 'path', dirs: [1, 1, 1, 1], previewGlyph: '十字' },
            { id: 'path-straight-v', name: '直路', type: 'path', dirs: [1, 0, 1, 0], previewGlyph: '直' },
            { id: 'path-straight-h', name: '横直路', type: 'path', dirs: [0, 1, 0, 1], previewGlyph: '横' },
            { id: 'path-tee-1101', name: '三叉 1101', type: 'path', dirs: [1, 1, 0, 1], previewGlyph: '三叉' },
            { id: 'path-tee-1110', name: '三叉 1110', type: 'path', dirs: [1, 1, 1, 0], previewGlyph: '三叉' },
            { id: 'path-tee-0111', name: '三叉 0111', type: 'path', dirs: [0, 1, 1, 1], previewGlyph: '三叉' },
            { id: 'path-tee-1011', name: '三叉 1011', type: 'path', dirs: [1, 0, 1, 1], previewGlyph: '三叉' },
            { id: 'path-corner-1100', name: '拐角 1100', type: 'path', dirs: [1, 1, 0, 0], previewGlyph: '拐' },
            { id: 'path-corner-0110', name: '拐角 0110', type: 'path', dirs: [0, 1, 1, 0], previewGlyph: '拐' },
        ],
    },
    {
        title: '堵路牌',
        description: '堵路牌里单出口和全堵死已有图，其余多出口堵路目前仍是复用或兜底方案。',
        cards: [
            { id: 'dead-0000', name: '全堵死', type: 'path', subType: 'dead-end', dirs: [0, 0, 0, 0], previewGlyph: '堵' },
            { id: 'dead-0010', name: '单出口 0010', type: 'path', subType: 'dead-end', dirs: [0, 0, 1, 0], previewGlyph: '堵1' },
            { id: 'dead-0001', name: '单出口 0001', type: 'path', subType: 'dead-end', dirs: [0, 0, 0, 1], previewGlyph: '堵1' },
            { id: 'dead-1000', name: '单出口 1000', type: 'path', subType: 'dead-end', dirs: [1, 0, 0, 0], previewGlyph: '堵1' },
            { id: 'dead-0100', name: '单出口 0100', type: 'path', subType: 'dead-end', dirs: [0, 1, 0, 0], previewGlyph: '堵1' },
            { id: 'dead-1010', name: '双通 1010', type: 'path', subType: 'dead-end', dirs: [1, 0, 1, 0], previewGlyph: '堵2' },
            { id: 'dead-0101', name: '双通 0101', type: 'path', subType: 'dead-end', dirs: [0, 1, 0, 1], previewGlyph: '堵2' },
            { id: 'dead-1101', name: '多出口 1101', type: 'path', subType: 'dead-end', dirs: [1, 1, 0, 1], previewGlyph: '堵三' },
        ],
    },
    {
        title: '行动牌',
        description: '行动牌已经全部直接使用现有 PNG，没有额外的兜底逻辑。',
        cards: [
            { id: 'action-break', name: '破坏', type: 'action', subType: 'sabotage' },
            { id: 'action-repair', name: '修理', type: 'action', subType: 'repair' },
            { id: 'action-map', name: '地图', type: 'action', subType: 'map' },
            { id: 'action-rockfall', name: '落石', type: 'action', subType: 'rockfall' },
        ],
    },
];

const MAPPING_MODE_LABELS = {
    direct: '直接使用',
    rotated: '旋转复用',
    fallback: '兜底方案',
};

function MappingChip({ mode }) {
    const styles = {
        direct: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
        rotated: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
        fallback: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
    };

    return (
        <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${styles[mode] || styles.direct}`}>
            {MAPPING_MODE_LABELS[mode] || mode}
        </span>
    );
}

function PreviewCard({ card }) {
    const cardKind = inferCardKind(card);
    const theme = getTheme(cardKind);
    const art = getCardArt(card);
    const isPath = card.type === 'path';
    const dirsKey = getDirsKey(card);
    const displayedDirs = getDisplayedDirs(card);
    const displayedDirsKey = getDisplayedDirsKey(card);
    const compactName = getCompactCardName(card);

    return (
        <div className="rounded-3xl border border-amber-400/20 bg-stone-950/80 p-4 shadow-[0_15px_45px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div className="flex flex-col gap-4 sm:flex-row">
                <div className={`relative h-48 w-32 shrink-0 overflow-hidden rounded-2xl border-2 bg-stone-950 shadow-[0_10px_24px_rgba(0,0,0,0.45)] ${theme.border}`}>
                    <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/15 via-transparent to-black/40 pointer-events-none" />
                    <div className="absolute left-2 top-2 z-20 max-w-[72%] rounded-full border border-white/10 bg-black/70 px-2 py-1 shadow-lg backdrop-blur-sm">
                        <div className="truncate text-[10px] font-bold tracking-[0.08em] text-stone-100">
                            {compactName}
                        </div>
                        <div className="truncate text-[9px] text-stone-300">
                            {card.name}
                        </div>
                    </div>

                    <div className="absolute inset-[0.32rem] z-10 overflow-hidden rounded-[0.9rem] border border-white/10 bg-stone-900/70">
                        <img
                            src={art.src}
                            alt={card.name}
                            className="h-full w-full object-cover"
                            style={{
                                transform: `rotate(${art.rotation || 0}deg) scale(${art.showLargeGlyph ? 1.02 : 1.08})`,
                            }}
                        />

                        {isPath && art.showLargeGlyph && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <RouteMarker
                                    dirs={displayedDirs}
                                    deadEnd={cardKind === 'dead-end'}
                                    size={62}
                                    className="bg-black/55 backdrop-blur-sm"
                                />
                            </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/88 via-black/48 to-transparent px-2 pb-2 pt-8">
                            <div className="flex items-end justify-between gap-2">
                                {isPath ? (
                                    <div className="rounded-2xl border border-white/10 bg-black/70 px-1.5 py-1 shadow-lg backdrop-blur-sm">
                                        <div className="flex items-center gap-1.5">
                                            <RouteMarker
                                                dirs={displayedDirs}
                                                deadEnd={cardKind === 'dead-end'}
                                                size={24}
                                            />
                                            <div className="min-w-0">
                                                <div className="truncate text-[8px] font-bold tracking-[0.12em] text-amber-100">
                                                    真实路线
                                                </div>
                                                <div className="font-mono text-[8px] text-stone-300">
                                                    {displayedDirsKey || '----'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[8px] font-bold tracking-[0.12em] text-stone-100 shadow-lg backdrop-blur-sm">
                                        {card.name}
                                    </div>
                                )}

                                <div className={`${theme.labelBg} rounded-full border border-white/10 px-2 py-1 text-[8px] font-bold tracking-[0.14em] text-white/90 shadow-lg`}>
                                    {theme.label}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <MappingChip mode={art.mappingMode} />
                        {art.rotation ? (
                            <span className="rounded-full border border-sky-400/35 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-200">
                                旋转 {art.rotation}°
                            </span>
                        ) : null}
                        {art.showLargeGlyph ? (
                            <span className="rounded-full border border-fuchsia-400/35 bg-fuchsia-500/10 px-2.5 py-1 text-xs font-bold text-fuchsia-200">
                                叠加大符号
                            </span>
                        ) : null}
                    </div>

                    <div className="grid gap-3 text-sm text-stone-200 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <div className="text-xs uppercase tracking-[0.25em] text-stone-400">Dirs</div>
                            <div className="mt-1 break-all font-mono text-base text-amber-200">{dirsKey || '-'}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <div className="text-xs uppercase tracking-[0.25em] text-stone-400">Shown</div>
                            <div className="mt-1 break-all font-mono text-base text-emerald-200">{displayedDirsKey || '-'}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <div className="text-xs uppercase tracking-[0.25em] text-stone-400">Image</div>
                            <div className="mt-1 break-all text-sm text-sky-200">{art.assetName}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/25 p-3 md:col-span-2">
                            <div className="text-xs uppercase tracking-[0.25em] text-stone-400">Path</div>
                            <div className="mt-1 break-all font-mono text-xs text-stone-300">{art.src}</div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-3 text-sm leading-6 text-amber-50">
                        {art.note}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function HandCardPreviewPage() {
    return (
        <div
            className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(120,53,15,0.32),_transparent_35%),linear-gradient(180deg,_#140d08_0%,_#0a0705_100%)] text-white"
            data-testid="hand-card-preview-page"
        >
            <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
                <header className="rounded-[2rem] border border-amber-400/20 bg-black/25 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                    <div className="max-w-3xl space-y-4">
                        <p className="text-xs font-bold uppercase tracking-[0.35em] text-amber-300/80">Hand Card Preview</p>
                        <h1 className="text-3xl font-black tracking-tight text-amber-50 sm:text-4xl">
                            当前手牌图片映射总览
                        </h1>
                        <p className="text-sm leading-7 text-stone-300 sm:text-base">
                            这个页面会直接复用和正式手牌相同的映射规则，所以你在这里看到的图片、旋转角度和兜底逻辑，就是游戏里现在实际在用的版本。
                        </p>
                        <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-stone-200">
                            打开方式：在本地服务地址后面加上
                            {' '}
                            <span className="font-mono text-amber-200">?preview=hand-cards</span>
                        </div>
                    </div>
                </header>

                {PREVIEW_GROUPS.map((group) => (
                    <section key={group.title} className="space-y-4" data-testid={`preview-group-${group.title}`}>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-amber-100">{group.title}</h2>
                            <p className="max-w-3xl text-sm leading-7 text-stone-300">{group.description}</p>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            {group.cards.map((card) => (
                                <PreviewCard key={card.id} card={card} />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
