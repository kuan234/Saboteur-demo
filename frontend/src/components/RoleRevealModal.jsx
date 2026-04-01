import React from 'react';

const ROLE_CONFIG = {
    'Gold Miner': {
        campLabel: '\u597d\u4eba\u9635\u8425',
        roleLabel: '\u6dd8\u91d1\u8005',
        headline: '\u4f60\u5c5e\u4e8e\u597d\u4eba\u9635\u8425',
        image: '/assets/role_miner_1772908551286.png',
        frameClass: 'border-amber-400/45 shadow-[0_24px_90px_rgba(245,158,11,0.24)]',
        imagePanelClass: 'from-amber-500/35 via-emerald-500/8 to-stone-950',
        campBadgeClass: 'border-emerald-300/40 bg-emerald-500/14 text-emerald-100',
        headlineClass: 'text-amber-200',
        hintClass: 'border-amber-400/18 bg-amber-500/10 text-amber-50',
        buttonClass: 'from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 border-amber-300/45',
        description: '\u548c\u961f\u53cb\u4e00\u8d77\u628a\u9053\u8def\u63a5\u5230\u91d1\u5757\uff0c\u5c0f\u5fc3\u6697\u4e2d\u7684\u7834\u574f\u8005\u3002',
        secret: '\u4f60\u7684\u4efb\u52a1\u662f\u4fdd\u62a4\u901a\u8def\uff0c\u8ba9\u961f\u53cb\u987a\u5229\u5230\u8fbe\u91d1\u5757\u3002',
        cta: '\u5f00\u59cb\u6316\u77ff',
    },
    Saboteur: {
        campLabel: '\u574f\u4eba\u9635\u8425',
        roleLabel: '\u7834\u574f\u8005',
        headline: '\u4f60\u5c5e\u4e8e\u574f\u4eba\u9635\u8425',
        image: '/assets/role_saboteur_1772908571074.png',
        frameClass: 'border-rose-400/45 shadow-[0_24px_90px_rgba(244,63,94,0.26)]',
        imagePanelClass: 'from-rose-500/35 via-red-500/10 to-stone-950',
        campBadgeClass: 'border-rose-300/40 bg-rose-500/14 text-rose-100',
        headlineClass: 'text-rose-200',
        hintClass: 'border-rose-400/18 bg-rose-500/10 text-rose-50',
        buttonClass: 'from-rose-500 to-red-700 hover:from-rose-400 hover:to-red-600 border-rose-300/45',
        description: '\u6697\u4e2d\u62d6\u6162\u961f\u4f0d\u8282\u594f\uff0c\u522b\u8ba9\u77ff\u5de5\u987a\u5229\u628a\u8def\u4fee\u5230\u91d1\u5757\u3002',
        secret: '\u4f60\u9700\u8981\u9002\u65f6\u51fa\u624b\u6405\u5c40\uff0c\u4f46\u4e0d\u8981\u592a\u65e9\u66b4\u9732\u81ea\u5df1\u3002',
        cta: '\u5f00\u59cb\u6405\u5c40',
    },
};

const UI_TEXT = {
    roundPrefix: '\u7b2c ',
    roundSuffix: ' \u8f6e',
    subtitle: 'Role Reveal',
    rolePrefix: '\u672c\u8f6e\u8eab\u4efd\uff1a',
    secretTitle: '\u53ea\u6709\u4f60\u81ea\u5df1\u770b\u5f97\u5230',
    autoCloseSuffix: 's \u540e\u81ea\u52a8\u5173\u95ed',
    ready: '\u51c6\u5907\u5f00\u5c40',
};

export default function RoleRevealModal({
    role,
    round = 1,
    countdown = 0,
    onClose,
}) {
    const config = ROLE_CONFIG[role];
    if (!config) return null;

    return (
        <div
            className="fixed inset-0 z-[96] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
            data-testid="role-reveal-modal"
            data-role={role}
        >
            <div className={`w-full max-w-4xl overflow-hidden rounded-[2rem] border bg-stone-950/96 ${config.frameClass}`}>
                <div className="grid min-h-[560px] md:min-h-0 md:grid-cols-[0.92fr_1.08fr]">
                    <div className={`relative min-h-[260px] overflow-hidden bg-gradient-to-br ${config.imagePanelClass} md:min-h-[520px]`}>
                        <img
                            src={config.image}
                            alt={config.roleLabel}
                            className="absolute inset-0 h-full w-full object-cover"
                            draggable={false}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/28 to-black/10" />

                        <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/45 px-3 py-1 text-xs font-bold tracking-[0.2em] text-stone-100 backdrop-blur-sm md:left-5 md:top-5">
                            {`${UI_TEXT.roundPrefix}${round}${UI_TEXT.roundSuffix}`}
                        </div>

                        <div className="absolute inset-x-4 bottom-4 rounded-[1.75rem] border border-white/12 bg-black/42 p-4 backdrop-blur-md md:inset-x-5 md:bottom-5 md:p-5">
                            <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-black tracking-[0.22em] ${config.campBadgeClass}`}>
                                {config.campLabel}
                            </div>
                            <div className="mt-3 text-3xl font-black tracking-tight text-white md:text-[2.35rem]">
                                {config.roleLabel}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col justify-between p-6 md:p-8">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.36em] text-stone-400">
                                {UI_TEXT.subtitle}
                            </p>
                            <h2 className={`mt-3 text-3xl font-black tracking-tight md:text-5xl ${config.headlineClass}`}>
                                {config.headline}
                            </h2>
                            <p className="mt-4 text-base text-stone-200 md:text-lg">
                                <span className="text-stone-400">{UI_TEXT.rolePrefix}</span>
                                <span className="font-bold text-white">{config.roleLabel}</span>
                            </p>
                            <p className="mt-4 text-sm leading-7 text-stone-300 md:text-base">
                                {config.description}
                            </p>
                            <div className={`mt-5 rounded-[1.5rem] border p-4 text-sm leading-7 ${config.hintClass}`}>
                                <div className="text-[11px] font-black uppercase tracking-[0.28em] text-white/75">
                                    {UI_TEXT.secretTitle}
                                </div>
                                <div className="mt-2">
                                    {config.secret}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="rounded-full border border-white/12 bg-black/32 px-4 py-2 text-sm font-bold text-stone-200">
                                {countdown > 0 ? `${countdown}${UI_TEXT.autoCloseSuffix}` : UI_TEXT.ready}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                data-testid="role-reveal-confirm"
                                className={`rounded-full border bg-gradient-to-r px-5 py-3 text-sm font-black tracking-[0.16em] text-white shadow-lg transition-all active:scale-[0.98] md:text-base ${config.buttonClass}`}
                            >
                                {config.cta}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
