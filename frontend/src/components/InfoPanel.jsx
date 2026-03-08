import React, { useRef, useEffect } from 'react';

export default function InfoPanel({ logs, actionPrompt, hints, currentPlayerName }) {
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [logs]);

    return (
        <div className="absolute right-3 top-[100px] bottom-[240px] w-52 xl:w-60 z-20 pointer-events-none hidden md:flex flex-col">
            <div className="h-full rounded-xl overflow-hidden pointer-events-auto flex flex-col"
                style={{
                    background: 'linear-gradient(160deg, rgba(60,40,25,0.95) 0%, rgba(30,20,12,0.98) 100%)',
                    border: '2px solid rgba(120,80,40,0.5)',
                    boxShadow: '0 0 30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}>

                {/* PLAYER Section */}
                <div className="px-4 pt-4 pb-2 border-b border-amber-900/30">
                    <h3 className="text-amber-600 font-bold text-[11px] tracking-[0.2em] uppercase mb-1"
                        style={{ fontFamily: 'Cinzel, serif' }}>玩家</h3>
                    <p className="text-amber-400 text-sm font-bold">{currentPlayerName || '—'}的回合</p>
                </div>

                {/* OBJECTIVE Section */}
                <div className="px-4 pt-3 pb-2 border-b border-amber-900/30">
                    <h3 className="text-amber-600 font-bold text-[11px] tracking-[0.2em] uppercase mb-1"
                        style={{ fontFamily: 'Cinzel, serif' }}>目标</h3>
                    <p className="text-stone-300 text-xs">{actionPrompt || '连接通向金块的隧道！'}</p>
                </div>

                {/* RECENT EVENTS Section */}
                <div className="flex-1 px-4 pt-3 pb-2 border-b border-amber-900/30 overflow-hidden flex flex-col">
                    <h3 className="text-amber-600 font-bold text-[11px] tracking-[0.2em] uppercase mb-2"
                        style={{ fontFamily: 'Cinzel, serif' }}>最近事件</h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar" ref={scrollRef}>
                        <ul className="space-y-1.5 text-xs text-stone-400">
                            {logs && logs.length > 0 ? logs.map((log, i) => (
                                <li key={i} className="leading-snug animate-float-up">
                                    <span dangerouslySetInnerHTML={{ __html: log.message }} />
                                </li>
                            )) : (
                                <li className="italic text-stone-600">暂无事件</li>
                            )}
                        </ul>
                    </div>
                </div>

                {/* HELP/HINT Section */}
                <div className="px-4 pt-3 pb-4">
                    <h3 className="text-amber-600 font-bold text-[11px] tracking-[0.2em] uppercase mb-1"
                        style={{ fontFamily: 'Cinzel, serif' }}>提示</h3>
                    <p className="text-stone-500 text-[11px] italic leading-snug">{hints || '从起点连接路径到终点卡牌'}</p>
                </div>
            </div>
        </div>
    );
}
