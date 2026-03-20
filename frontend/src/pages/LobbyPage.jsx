import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function LobbyPage() {
    const {
        user,
        createRoom,
        joinRoom,
        roomId,
        players,
        playerCount,
        startGame,
        isHost,
        logout,
        matchQueue,
        joinMatchQueue,
        leaveMatchQueue,
        leaveRoom
    } = useSocket();
    const [joinId, setJoinId] = useState('');

    if (roomId) {
        return (
            <div
                className="w-full h-full flex flex-col items-center px-3 pt-8 md:pt-16"
                data-testid="room-lobby"
                style={{ background: 'radial-gradient(ellipse at center, #1e1610 0%, #0a0705 100%)' }}
            >
                <div className="bg-stone-900/85 border border-stone-700/50 p-5 md:p-8 rounded-2xl shadow-2xl w-full max-w-xl text-center">
                    <h2 className="text-2xl md:text-3xl text-amber-500 font-bold mb-2 font-medieval break-all" data-testid="room-id-value">
                        æˆ¿é—´ï¼š{roomId}
                    </h2>
                    <p className="text-stone-400 mb-5">ç­‰å¾…çŽ©å®¶åŠ å…¥... ({playerCount}/10)</p>

                    <div className="bg-stone-800/50 border border-stone-700 rounded-xl p-3 md:p-4 mb-6 min-h-[180px] flex flex-col gap-2">
                        {players.map((player) => (
                            <div key={player.playerKey || player.id} className="flex justify-between items-center bg-stone-800 p-3 rounded border border-stone-600/50">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-xl md:text-2xl">{player.avatar || 'ðŸ§”'}</span>
                                    <span className="text-stone-200 font-bold truncate">{player.name || 'çŽ©å®¶'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {player.disconnected && (
                                        <span className="text-xs text-red-300 bg-red-900/40 px-2 py-1 rounded border border-red-700/30">
                                            å·²æ–­çº¿
                                        </span>
                                    )}
                                    {player.isHost && (
                                        <span className="text-xs text-amber-500 bg-amber-900/40 px-2 py-1 rounded border border-amber-700/30">
                                            æˆ¿ä¸»
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                        {players.length === 0 && <div className="text-stone-500 italic py-8">æ­£åœ¨èŽ·å–çŽ©å®¶åˆ—è¡¨...</div>}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                        {isHost ? (
                            <button
                                onClick={startGame}
                                disabled={players.length < 2}
                                data-testid="start-game-button"
                                className="px-6 py-3 bg-gradient-to-b from-green-600 to-green-800 hover:from-green-500 hover:to-green-700 border border-green-500/50 rounded-xl text-white font-bold text-base md:text-lg shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                â–¶ å¼€å§‹æ¸¸æˆ
                            </button>
                        ) : (
                            <div className="px-6 py-3 text-amber-500 bg-amber-900/20 border border-amber-700/30 rounded-xl font-bold">
                                â³ ç­‰å¾…æˆ¿ä¸»å¼€å§‹
                            </div>
                        )}
                        <button
                            onClick={leaveRoom}
                            className="px-6 py-3 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-xl text-stone-300 font-bold transition-colors"
                        >
                            ç¦»å¼€æˆ¿é—´
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="w-full h-full flex flex-col relative overflow-y-auto"
            data-testid="lobby-page"
            style={{ background: 'radial-gradient(ellipse at center, #1e1610 0%, #0a0705 100%)' }}
        >
            <div className="h-auto min-h-16 bg-stone-900/90 border-b border-stone-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 md:px-6 py-3 shadow-md z-10">
                <div className="text-xl md:text-2xl text-amber-500 font-bold font-medieval tracking-widest drop-shadow-md">
                    â›ï¸ SABOTEUR
                </div>
                <div className="flex items-center gap-3 md:gap-4">
                    <span className="text-stone-300 text-sm md:text-base font-bold">
                        æ¬¢è¿Ž, <span className="text-amber-400">{user?.nickname}</span>
                    </span>
                    <button
                        onClick={logout}
                        className="px-3 py-1.5 bg-red-900/60 hover:bg-red-800 border border-red-700/50 rounded-lg text-red-200 text-sm font-bold transition-colors"
                    >
                        æ›´æ¢æ˜µç§°
                    </button>
                </div>
            </div>

            <div className="flex-1 flex items-start md:items-center justify-center p-4 md:p-8 pb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 max-w-5xl w-full relative z-10">
                    <div className="bg-stone-800/80 backdrop-blur-sm border border-stone-600/50 rounded-2xl p-5 md:p-7 flex flex-col items-center text-center shadow-2xl">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-amber-600 to-amber-800 rounded-full flex items-center justify-center text-3xl md:text-4xl mb-5 shadow-lg border-2 border-amber-500/50">
                            ðŸ‘‘
                        </div>
                        <h3 className="text-xl md:text-2xl text-stone-100 font-bold mb-2">ç§äººæˆ¿é—´</h3>
                        <p className="text-stone-400 mb-6 text-sm md:text-base">åˆ›å»ºä¸“å±žæˆ¿é—´ï¼Œé‚€è¯·å¥½å‹ä¸€èµ·ä¸‹çŸ¿å†’é™©ã€‚</p>

                        <button
                            onClick={createRoom}
                            data-testid="create-room-button"
                            className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 rounded-xl text-white font-bold text-base md:text-lg shadow-lg border border-amber-500/50 transition-all active:scale-95"
                        >
                            åˆ›å»ºæˆ¿é—´
                        </button>

                        <div className="w-full border-t border-stone-700 my-6" />

                        <div className="w-full">
                            <h4 className="text-sm text-stone-400 mb-3 font-bold uppercase tracking-wider">åŠ å…¥å·²æœ‰æˆ¿é—´</h4>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="text"
                                    placeholder="è¾“å…¥æˆ¿é—´ ID"
                                    value={joinId}
                                    onChange={event => setJoinId(event.target.value)}
                                    data-testid="join-room-input"
                                    className="flex-1 bg-stone-900 border border-stone-700 px-4 py-3 rounded-xl text-stone-200 focus:outline-none focus:border-stone-500"
                                />
                                <button
                                    onClick={() => joinId && joinRoom(joinId)}
                                    data-testid="join-room-button"
                                    className="px-6 py-3 bg-stone-700 hover:bg-stone-600 rounded-xl text-stone-200 font-bold transition-colors border border-stone-600"
                                >
                                    åŠ å…¥
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-stone-800/80 backdrop-blur-sm border border-stone-600/50 rounded-2xl p-5 md:p-7 flex flex-col items-center text-center shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-blue-600" />

                        <div className={`w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-purple-600 to-blue-700 rounded-full flex items-center justify-center text-3xl md:text-4xl mb-5 shadow-lg border-2 border-purple-500/50 ${matchQueue.inQueue ? 'animate-pulse' : ''}`}>
                            ðŸŒ
                        </div>
                        <h3 className="text-xl md:text-2xl text-stone-100 font-bold mb-2">å¿«é€ŸåŒ¹é…</h3>
                        <p className="text-stone-400 mb-6 text-sm md:text-base">ä¸Žå…¶ä»–åœ¨çº¿çŸ¿å·¥éšæœºç»„å±€ï¼Œä½“éªŒæœªçŸ¥æŒ‘æˆ˜ã€‚</p>

                        {matchQueue.inQueue ? (
                            <div className="w-full flex items-center justify-between bg-stone-900 border border-stone-700 p-2 rounded-xl gap-2">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-purple-400 font-bold text-xs md:text-sm">åŒ¹é…ä¸­... ({matchQueue.count}/2)</span>
                                </div>
                                <button
                                    onClick={leaveMatchQueue}
                                    className="px-3 py-2 bg-stone-800 hover:bg-stone-700 rounded-lg text-stone-400 font-bold transition-colors text-sm"
                                >
                                    å–æ¶ˆ
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={joinMatchQueue}
                                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-700 hover:from-purple-500 hover:to-blue-600 rounded-xl text-white font-bold text-base md:text-lg shadow-lg border border-purple-500/50 transition-all active:scale-95"
                            >
                                å¼€å§‹åŒ¹é…
                            </button>
                        )}
                        <div className="mt-5 text-stone-500 text-xs md:text-sm">
                            åŒ¹é…æ¨¡å¼ä¸‹ï¼Œæ»¡ 2 äººå³è‡ªåŠ¨å¼€å§‹æ¸¸æˆ
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
