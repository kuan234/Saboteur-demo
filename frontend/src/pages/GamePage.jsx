import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import GameBoard from '../components/GameBoard';
import HandCards from '../components/HandCards';
import PlayerBar from '../components/PlayerBar';
import InfoPanel from '../components/InfoPanel';
import ChatBox from '../components/ChatBox';

export default function GamePage() {
    const {
        players, currentTurnId, socketId,
        board, hand, playCard, discardCard, leaveRoom,
        logs, chatMessages, sendChat, myRole, round, scores,
        mapResult, roundResult, gameOverResult, clearRoundResult, clearGameOver,
        speakerEnabled, micEnabled, voiceError, toggleSpeaker, toggleMic
    } = useSocket();

    const [draggingCard, setDraggingCard] = useState(null);
    const [draggingRotation, setDraggingRotation] = useState(false);

    const handleDragStartCard = (e, card, isRotated) => {
        setDraggingCard(card);
        setDraggingRotation(isRotated || false);
    };

    const handleDropCardOnBoard = (card, position, rotated) => {
        // GameBoard grid: Start is 0,2. Server: Start is 0,0.
        // Server Y = GameBoard Y - 2
        const targetX = position.x;
        const targetY = position.y - 2;

        const finalCard = { ...card, rotation: rotated ? 180 : 0 };
        playCard(finalCard, targetX, targetY);
        return false; // Server controls board updates
    };

    const handleDropOnPlayer = (card, targetPlayerId) => {
        const finalCard = { ...card, rotation: 0 };
        playCard(finalCard, null, null, targetPlayerId);
    };

    const safePlayers = players || [];
    const currentPlayer = safePlayers.find(p => p.id === currentTurnId);

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative"
            style={{ background: 'radial-gradient(ellipse at 50% 40%, #1e1610 0%, #0a0705 100%)' }}>

            {/* === Ambient Decoration === */}
            <div className="absolute top-0 left-0 w-64 h-64 pointer-events-none opacity-30"
                style={{ background: 'radial-gradient(circle, rgba(255,180,50,0.3) 0%, transparent 70%)' }} />
            <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none opacity-20"
                style={{ background: 'radial-gradient(circle, rgba(255,180,50,0.2) 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-40 pointer-events-none opacity-20"
                style={{ background: 'radial-gradient(ellipse, rgba(255,160,40,0.3) 0%, transparent 80%)' }} />

            {/* === Exit Game Button === */}
            <div className="absolute top-4 left-4 z-50">
                <button
                    onClick={() => {
                        if (window.confirm("确定要退出正在进行的对局吗？")) {
                            leaveRoom();
                        }
                    }}
                    className="px-3 py-1.5 bg-red-900/40 hover:bg-red-800/60 border border-red-500/50 rounded text-red-200 text-sm font-bold shadow-md transition-all flex items-center gap-1"
                >
                    <span>🚪</span> 退出
                </button>
            </div>



            {/* === Voice Controls === */}
            <div className="fixed right-3 bottom-40 md:top-4 md:bottom-auto md:right-4 z-[80] flex items-center gap-2">
                <button
                    onClick={toggleSpeaker}
                    className={`px-3 py-1.5 rounded border text-sm font-bold shadow-md transition-all ${speakerEnabled
                        ? 'bg-emerald-800/70 border-emerald-400 text-emerald-100'
                        : 'bg-stone-900/60 border-stone-600 text-stone-200 hover:bg-stone-800/80'}`}
                >
                    {speakerEnabled ? '🔊 听筒开' : '🔈 听筒关'}
                </button>
                <button
                    onClick={toggleMic}
                    className={`px-3 py-1.5 rounded border text-sm font-bold shadow-md transition-all ${micEnabled
                        ? 'bg-amber-700/80 border-amber-400 text-amber-100'
                        : 'bg-stone-900/60 border-stone-600 text-stone-200 hover:bg-stone-800/80'}`}
                >
                    {micEnabled ? '🎙️ 麦克风开' : '🎤 麦克风关'}
                </button>
            </div>

            {voiceError && (
                <div className="fixed right-3 bottom-28 md:top-16 md:bottom-auto md:right-4 z-[80] px-3 py-2 rounded bg-red-900/70 border border-red-500 text-red-100 text-xs max-w-xs">
                    {voiceError}
                </div>
            )}

            {/* === Top Player Avatars === */}
            <PlayerBar
                players={safePlayers}
                currentTurnId={currentTurnId}
                myPlayerId={socketId}
                draggingCard={draggingCard}
                onDropOnPlayer={handleDropOnPlayer}
            />

            {/* === Center Board + Info Panel === */}
            <div className="flex-1 min-h-0 relative flex items-center justify-center pt-20 md:pt-20 pb-36 md:pb-56 px-2 md:px-4">
                <GameBoard
                    draggingCard={draggingCard}
                    draggingRotation={draggingRotation}
                    onDropCard={handleDropCardOnBoard}
                    serverBoard={board}
                />
                <div className="hidden lg:block">
                    <InfoPanel
                        logs={logs}
                        currentPlayerName={currentPlayer?.name}
                        actionPrompt={`身份: ${myRole === 'Gold Miner' ? '淘金者' : '破坏者'}`}
                        hints={draggingCard ? '拖放道路到网格，破坏/修复拖至玩家头像' : '选择一张手牌开始行动'}
                    />
                </div>
            </div>

            {/* === Bottom Chat & Actions === */}
            <div className="hidden md:block">
                <ChatBox messages={chatMessages || []} onSendMessage={sendChat} />
            </div>

            {/* === Bottom Hand Cards === */}
            <div className="fixed bottom-0 left-0 right-0 z-[70] flex justify-center items-end pb-2 md:pb-4 pt-1 md:pt-2"
                style={{
                    minHeight: '150px',
                    background: 'linear-gradient(to top, rgba(10,7,5,0.95) 0%, rgba(10,7,5,0.5) 60%, transparent 100%)',
                }}>
                <HandCards
                    cards={hand || []}
                    onDragStartCard={handleDragStartCard}
                    onDiscardCard={(c) => discardCard(c)}
                />
            </div>

            {/* === Map Result Modal === */}
            {mapResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <div className="bg-stone-900 border-2 border-amber-500 rounded-xl p-8 text-center max-w-sm">
                        <h2 className="text-2xl text-amber-500 font-bold mb-4 font-medieval">地图探秘</h2>
                        <div className="text-6xl mb-4">{mapResult.isTreasure ? '💎' : '🪨'}</div>
                        <p className="text-stone-300">
                            你查看了终点卡({mapResult.coord})：<br />
                            <span className="text-xl font-bold text-white">{mapResult.isTreasure ? '这是金块！' : '这是石头。'}</span>
                        </p>
                    </div>
                </div>
            )}

            {/* === Round Result Modal === */}
            {roundResult && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md">
                    <div className="bg-stone-900 border-2 border-amber-500 rounded-xl p-8 text-center max-w-lg w-full">
                        <h2 className="text-3xl text-amber-500 font-bold mb-6 font-medieval">回合结束</h2>
                        <p className="text-stone-200 text-lg mb-6">{roundResult.msg}</p>
                        <ul className="text-left text-stone-300 mb-8 max-h-40 overflow-y-auto space-y-2">
                            {roundResult.players?.map((p, i) => {
                                const gain = roundResult.delta && roundResult.delta[p.playerKey] ? `(+${roundResult.delta[p.playerKey]})` : '';
                                return (
                                    <li key={i} className="flex justify-between border-b border-stone-800 pb-1">
                                        <span>{p.name} ({p.role === 'Gold Miner' ? '矿工' : '破坏者'})</span>
                                        <span className="text-amber-400 font-bold">{roundResult.scores[p.playerKey] || 0} {gain}</span>
                                    </li>
                                );
                            })}
                        </ul>
                        <button
                            onClick={clearRoundResult}
                            className="px-6 py-3 bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 rounded-lg text-white font-bold border border-amber-500/50"
                        >
                            继续下一轮
                        </button>
                    </div>
                </div>
            )}

            {/* === Final Game Over Modal === */}
            {gameOverResult && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md">
                    <div className="bg-stone-900 border-2 border-red-500 rounded-xl p-8 text-center max-w-lg w-full">
                        <h2 className="text-4xl text-red-500 font-bold mb-6 font-medieval">游戏结束</h2>
                        <p className="text-stone-200 text-lg mb-6">{gameOverResult.msg}</p>
                        <h3 className="text-amber-500 font-bold mb-2">最终得分：</h3>
                        <ul className="text-left text-stone-300 mb-8 max-h-40 overflow-y-auto space-y-2 bg-stone-950 p-4 rounded">
                            {(gameOverResult.players || []).sort((a, b) => (gameOverResult.scores[b.playerKey] || 0) - (gameOverResult.scores[a.playerKey] || 0)).map((p, i) => (
                                <li key={i} className="flex justify-between border-b border-stone-800 pb-1">
                                    <span>#{i + 1} {p.name} ({p.role === 'Gold Miner' ? '矿工' : '破坏者'})</span>
                                    <span className="text-amber-400 font-bold text-xl">{gameOverResult.scores[p.playerKey] || 0}</span>
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={clearGameOver}
                            className="px-6 py-3 bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 rounded-lg text-white font-bold border border-red-500/50"
                        >
                            返回大厅
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
}
