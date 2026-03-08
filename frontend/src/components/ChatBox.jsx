import React, { useState, useRef, useEffect } from 'react';

export default function ChatBox({ messages, onSendMessage }) {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isOpen]);

    if (!isOpen) {
        return (
            <div
                onClick={() => setIsOpen(true)}
                className="absolute bottom-4 left-4 z-40 bg-stone-800/80 hover:bg-stone-700/80 border border-stone-600 rounded-full w-12 h-12 flex items-center justify-center cursor-pointer shadow-lg transition-all"
            >
                <span className="text-xl">💬</span>
                {messages && messages.length > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold border-2 border-stone-800">
                        {messages.length}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="absolute bottom-4 left-4 z-40 w-72 h-80 bg-stone-900/95 border border-stone-600 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in"
            style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)' }}>

            {/* Header */}
            <div className="bg-stone-800 flex justify-between items-center px-3 py-2 border-b border-stone-700">
                <span className="text-stone-300 font-bold text-sm flex items-center gap-2">
                    <span className="text-amber-500">💬</span> 队伍频道
                </span>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-stone-400 hover:text-white transition-colors"
                >
                    ✖
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar list-none" ref={scrollRef}>
                {messages && messages.length > 0 ? messages.map((m, i) => (
                    <div key={i} className="text-sm">
                        <div className="flex justify-between items-baseline mb-0.5">
                            <span className="font-bold text-amber-500 text-xs">{m.name}</span>
                            <span className="text-[9px] text-stone-500">{m.time}</span>
                        </div>
                        <div className="bg-stone-800 text-stone-200 rounded-md rounded-tl-none p-2 w-fit max-w-xs shadow-inner whitespace-pre-wrap word-break">
                            {m.message}
                        </div>
                    </div>
                )) : (
                    <div className="text-stone-500 text-xs italic text-center pt-8">
                        暂无聊天记录
                    </div>
                )}
            </div>

            {/* Input form */}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (input.trim() && onSendMessage) {
                        onSendMessage(input.trim());
                        setInput('');
                    }
                }}
                className="p-2 border-t border-stone-700 bg-stone-950 flex gap-2"
            >
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="输入消息..."
                    className="flex-1 bg-stone-800 text-stone-200 text-sm px-3 py-1.5 rounded outline-none border border-stone-600 focus:border-amber-500 transition-colors"
                />
                <button
                    type="submit"
                    disabled={!input.trim()}
                    className="bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white px-3 rounded font-bold text-sm transition-colors"
                >
                    发送
                </button>
            </form>
        </div>
    );
}
