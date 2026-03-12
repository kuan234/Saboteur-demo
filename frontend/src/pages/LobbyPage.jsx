import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

export default function LobbyPage() {
    const { user, createRoom, joinRoom, roomId, players, playerCount, startGame, isHost, logout, matchQueue, joinMatchQueue, leaveMatchQueue, leaveRoom } = useSocket();
    const [joinId, setJoinId] = useState('');

    if (roomId) {
        return (
            <div className="w-full h-full flex flex-col items-center px-3 pt-8 md:pt-16"
                style={{ background: 'radial-gradient(ellipse at center, #1e1610 0%, #0a0705 100%)' }}>
                <div className="bg-stone-900/85 border border-stone-700/50 p-5 md:p-8 rounded-2xl shadow-2xl w-full max-w-xl text-center">
                    <h2 className="text-2xl md:text-3xl text-amber-500 font-bold mb-2 font-medieval break-all">房间：{roomId}</h2>
                    <p className="text-stone-400 mb-5">等待玩家加入... ({playerCount}/10)</p>

                    <div className="bg-stone-800/50 border border-stone-700 rounded-xl p-3 md:p-4 mb-6 min-h-[180px] flex flex-col gap-2">
                        {players.map((p, idx) => (
                            <div key={p.id} className="flex justify-between items-center bg-stone-800 p-3 rounded border border-stone-600/50">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-xl md:text-2xl">{p.avatar || '🧔'}</span>
                                    <span className="text-stone-200 font-bold truncate">{p.name || '玩家'}</span>
                                </div>
                                {idx === 0 && <span className="text-xs text-amber-500 bg-amber-900/40 px-2 py-1 rounded border border-amber-700/30">房主</span>}
                            </div>
                        ))}
                        {players.length === 0 && <div className="text-stone-500 italic py-8">正在获取玩家列表...</div>}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                        {isHost ? (
                            <button
                                onClick={startGame}
                                disabled={players.length < 2}
                                className="px-6 py-3 bg-gradient-to-b from-green-600 to-green-800 hover:from-green-500 hover:to-green-700 border border-green-500/50 rounded-xl text-white font-bold text-base md:text-lg shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ▶ 开始游戏
                            </button>
                        ) : (
                            <div className="px-6 py-3 text-amber-500 bg-amber-900/20 border border-amber-700/30 rounded-xl font-bold">
                                ⏳ 等待房主开始
                            </div>
                        )}
                        <button
                            onClick={leaveRoom}
                            className="px-6 py-3 bg-stone-800 hover:bg-stone-700 border border-stone-600 rounded-xl text-stone-300 font-bold transition-colors"
                        >
                            离开房间
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col relative overflow-y-auto"
            style={{ background: 'radial-gradient(ellipse at center, #1e1610 0%, #0a0705 100%)' }}>

            <div className="h-auto min-h-16 bg-stone-900/90 border-b border-stone-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 md:px-6 py-3 shadow-md z-10">
                <div className="text-xl md:text-2xl text-amber-500 font-bold font-medieval tracking-widest drop-shadow-md">
                    ⛏️ SABOTEUR
                </div>
                <div className="flex items-center gap-3 md:gap-4">
                    <span className="text-stone-300 text-sm md:text-base font-bold">欢迎, <span className="text-amber-400">{user?.nickname}</span></span>
                    <button onClick={logout} className="px-3 py-1.5 bg-red-900/60 hover:bg-red-800 border border-red-700/50 rounded-lg text-red-200 text-sm font-bold transition-colors">
                        注销
                    </button>
                </div>
            </div>

            <div className="flex-1 flex items-start md:items-center justify-center p-4 md:p-8 pb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 max-w-5xl w-full relative z-10">

                    <div className="bg-stone-800/80 backdrop-blur-sm border border-stone-600/50 rounded-2xl p-5 md:p-7 flex flex-col items-center text-center shadow-2xl">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-amber-600 to-amber-800 rounded-full flex items-center justify-center text-3xl md:text-4xl mb-5 shadow-lg border-2 border-amber-500/50">
                            👑
                        </div>
                        <h3 className="text-xl md:text-2xl text-stone-100 font-bold mb-2">私人房间</h3>
                        <p className="text-stone-400 mb-6 text-sm md:text-base">创建专属房间，邀请好友一起下矿冒险。</p>

                        <button
                            onClick={createRoom}
                            className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 rounded-xl text-white font-bold text-base md:text-lg shadow-lg border border-amber-500/50 transition-all active:scale-95"
                        >
                            创建房间
                        </button>

                        <div className="w-full border-t border-stone-700 my-6" />

                        <div className="w-full">
                            <h4 className="text-sm text-stone-400 mb-3 font-bold uppercase tracking-wider">加入已有房间</h4>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="text"
                                    placeholder="输入房间 ID"
                                    value={joinId}
                                    onChange={e => setJoinId(e.target.value)}
                                    className="flex-1 bg-stone-900 border border-stone-700 px-4 py-3 rounded-xl text-stone-200 focus:outline-none focus:border-stone-500"
                                />
                                <button
                                    onClick={() => joinId && joinRoom(joinId)}
                                    className="px-6 py-3 bg-stone-700 hover:bg-stone-600 rounded-xl text-stone-200 font-bold transition-colors border border-stone-600"
                                >
                                    加入
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-stone-800/80 backdrop-blur-sm border border-stone-600/50 rounded-2xl p-5 md:p-7 flex flex-col items-center text-center shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-blue-600" />

                        <div className={`w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-purple-600 to-blue-700 rounded-full flex items-center justify-center text-3xl md:text-4xl mb-5 shadow-lg border-2 border-purple-500/50 ${matchQueue.inQueue ? 'animate-pulse' : ''}`}>
                            🌍
                        </div>
                        <h3 className="text-xl md:text-2xl text-stone-100 font-bold mb-2">快速匹配</h3>
                        <p className="text-stone-400 mb-6 text-sm md:text-base">与其他在线矿工随机组局，体验未知挑战。</p>

                        {matchQueue.inQueue ? (
                            <div className="w-full flex items-center justify-between bg-stone-900 border border-stone-700 p-2 rounded-xl gap-2">
                                <div className="flex items-center gap-2 px-1">
                                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-purple-400 font-bold text-xs md:text-sm">匹配中... ({matchQueue.count}/2)</span>
                                </div>
                                <button
                                    onClick={leaveMatchQueue}
                                    className="px-3 py-2 bg-stone-800 hover:bg-stone-700 rounded-lg text-stone-400 font-bold transition-colors text-sm"
                                >
                                    取消
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={joinMatchQueue}
                                className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-700 hover:from-purple-500 hover:to-blue-600 rounded-xl text-white font-bold text-base md:text-lg shadow-lg border border-purple-500/50 transition-all active:scale-95"
                            >
                                开始匹配
                            </button>
                        )}
                        <div className="mt-5 text-stone-500 text-xs md:text-sm">
                            匹配模式下，满 2 人即自动开始游戏
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
