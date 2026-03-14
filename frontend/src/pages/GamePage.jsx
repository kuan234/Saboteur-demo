import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import GameBoard from '../components/GameBoard';
import HandCards from '../components/HandCards';
import PlayerBar from '../components/PlayerBar';
import InfoPanel from '../components/InfoPanel';
import ChatBox from '../components/ChatBox';

const rotateDirs180 = (dirs = []) => {
    if (!Array.isArray(dirs) || dirs.length !== 4) return dirs;
    return [dirs[2], dirs[3], dirs[0], dirs[1]];
};

const tutorialSteps = [
    {
        title: '步骤 1 / 3：拖牌放置',
        description: '从下方手牌拖拽到棋盘空位，即可打出道路牌。行动牌可拖到玩家头像。',
    },
    {
        title: '步骤 2 / 3：旋转道路牌',
        description: '手机端先点选卡牌，再用“旋转”按钮操作（也支持双击旋转）。',
    },
    {
        title: '步骤 3 / 3：弃牌跳过',
        description: '不想出牌时可点选卡牌后使用“弃牌”，也可直接点击底部“弃牌”按钮。',
    },
];

const quickVoiceFallbackMessages = [
    '我这回合先探路',
    '我被堵了，求修理',
    '注意这个人可能是破坏者',
    '我有地图牌',
];

const quickEmojiMessages = [
    '怀疑你是破坏者 👀',
    '干得漂亮 👍',
    '救我一下 🙏',
    '这条路可疑 🤨',
];

export default function GamePage() {
    const {
        players, currentTurnId, socketId,
        board, hand, playCard, discardCard, leaveRoom,
        logs, chatMessages, sendChat, myRole,
        mapResult, roundResult, gameOverResult, clearRoundResult, clearGameOver,
        speakerEnabled, micEnabled, voiceError, toggleSpeaker, toggleMic
    } = useSocket();

    const [draggingCard, setDraggingCard] = useState(null);
    const [draggingRotation, setDraggingRotation] = useState(false);
    const [mobilePanel, setMobilePanel] = useState('info');
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [selectedCard, setSelectedCard] = useState(null);
    const [showMyTurnHint, setShowMyTurnHint] = useState(false);
    const [turnSecondsLeft, setTurnSecondsLeft] = useState(20);
    const [tutorialOpen, setTutorialOpen] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
    const prevTurnRef = useRef(null);

    const safePlayers = players || [];
    const currentPlayer = safePlayers.find(p => p.id === currentTurnId);
    const isMyTurn = currentTurnId === socketId;

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const currentCount = Number(localStorage.getItem('saboteur_tutorial_seen_count') || 0);
        if (currentCount < 3) {
            setTutorialOpen(true);
            localStorage.setItem('saboteur_tutorial_seen_count', String(currentCount + 1));
        }
    }, []);

    useEffect(() => {
        if (!socketId) return;
        const changed = prevTurnRef.current !== currentTurnId;
        if (isMyTurn && changed) {
            setShowMyTurnHint(true);
            setTurnSecondsLeft(20);
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([120, 80, 120]);
            const t = setTimeout(() => setShowMyTurnHint(false), 2400);
            prevTurnRef.current = currentTurnId;
            return () => clearTimeout(t);
        }
        prevTurnRef.current = currentTurnId;
    }, [currentTurnId, socketId, isMyTurn]);

    useEffect(() => {
        if (!isMyTurn) return undefined;
        const timer = setInterval(() => {
            setTurnSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [isMyTurn, currentTurnId]);
    const prevTurnRef = useRef(null);

    const handleDragStartCard = (e, card, isRotated) => {
        setDraggingCard(card);
        setDraggingRotation(isRotated || false);
    };

    const handleDropCardOnBoard = (card, position, rotated) => {
        const targetX = position.x;
        const targetY = position.y - 2;
        const finalCard = {
            ...card,
            rotation: rotated ? 180 : 0,
            dirs: rotated ? rotateDirs180(card.dirs) : card.dirs,
        };
        playCard(finalCard, targetX, targetY);
        setSelectedCard(null);
        return false;
    };

    const handleDropOnPlayer = (card, targetPlayerId) => {
        const finalCard = { ...card, rotation: 0 };
        playCard(finalCard, null, null, targetPlayerId);
        setSelectedCard(null);
    };

    const handleMobileDiscard = () => {
        if (selectedCard) {
            discardCard(selectedCard);
            setSelectedCard(null);
            return;
        }
        if (hand && hand.length > 0) {
            discardCard(hand[0]);
        }
    };

    const sendQuickMessage = (message) => {
        sendChat(message);
        setMobileDrawerOpen(false);
    };

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative"
            style={{ background: 'radial-gradient(ellipse at 50% 40%, #1e1610 0%, #0a0705 100%)' }}>

            <div className="absolute top-0 left-0 w-64 h-64 pointer-events-none opacity-30"
                style={{ background: 'radial-gradient(circle, rgba(255,180,50,0.3) 0%, transparent 70%)' }} />
            <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none opacity-20"
                style={{ background: 'radial-gradient(circle, rgba(255,180,50,0.2) 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-40 pointer-events-none opacity-20"
                style={{ background: 'radial-gradient(ellipse, rgba(255,160,40,0.3) 0%, transparent 80%)' }} />


            {showMyTurnHint && (
                <div className="fixed left-1/2 top-24 z-[90] -translate-x-1/2 rounded-full border border-amber-300/60 bg-amber-600/80 px-4 py-2 text-xs font-bold text-amber-50 shadow-lg md:text-sm">
                    轮到你行动了！
                </div>
            )}

            <div className="absolute top-3 left-3 md:top-4 md:left-4 z-50">
                <button
                    onClick={() => {
                        if (window.confirm('确定要退出正在进行的对局吗？')) {
                            leaveRoom();
                        }
                    }}
                    className="px-3 py-2 bg-red-900/50 hover:bg-red-800/70 border border-red-500/50 rounded-xl text-red-200 text-xs md:text-sm font-bold shadow-md transition-all flex items-center gap-1"
                >
                    <span>🚪</span> 退出
                </button>
            </div>

            <div className="hidden md:flex fixed right-3 top-3 md:top-4 md:right-4 z-[80] flex-col md:flex-row items-end md:items-center gap-2">
                <button
                    onClick={toggleSpeaker}
                    className={`px-3 py-2 rounded-xl border text-xs md:text-sm font-bold shadow-md transition-all ${speakerEnabled
                        ? 'bg-emerald-800/70 border-emerald-400 text-emerald-100'
                        : 'bg-stone-900/70 border-stone-600 text-stone-200 hover:bg-stone-800/80'}`}
                >
                    {speakerEnabled ? '🔊 听筒开' : '🔈 听筒关'}
                </button>
                <button
                    onClick={toggleMic}
                    className={`px-3 py-2 rounded-xl border text-xs md:text-sm font-bold shadow-md transition-all ${micEnabled
                        ? 'bg-amber-700/80 border-amber-400 text-amber-100'
                        : 'bg-stone-900/70 border-stone-600 text-stone-200 hover:bg-stone-800/80'}`}
                >
                    {micEnabled ? '🎙️ 麦克风开' : '🎤 麦克风关'}
                </button>
            </div>

            <div className="lg:hidden fixed right-3 top-3 z-[82]">
                <button
                    onClick={() => {
                        setMobileDrawerOpen(true);
                        setMobilePanel('info');
                    }}
                    className="px-3 py-2 rounded-xl bg-stone-900/85 border border-stone-600 text-stone-200 text-xs font-bold"
                >
                    菜单
                </button>
            </div>

            {voiceError && (
                <div className="fixed right-3 top-28 md:top-16 md:right-4 z-[80] px-3 py-2 rounded bg-red-900/70 border border-red-500 text-red-100 text-xs max-w-xs">
                    {voiceError}
                </div>
            )}

            {voiceError && (
                <div className="fixed left-3 right-3 top-36 z-[81] md:hidden rounded-xl border border-amber-500/40 bg-stone-950/95 p-3">
                    <p className="text-[11px] text-amber-300 mb-2">语音不可用，已切换快捷消息</p>
                    <div className="grid grid-cols-2 gap-2">
                        {quickVoiceFallbackMessages.map((msg) => (
                            <button
                                key={msg}
                                onClick={() => sendQuickMessage(msg)}
                                className="rounded-lg border border-stone-600 bg-stone-900 px-2 py-1.5 text-[11px] text-stone-200"
                            >
                                {msg}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="lg:hidden fixed left-3 top-16 z-[79] rounded-xl border border-amber-500/40 bg-stone-950/90 px-3 py-2 text-[11px] text-stone-200 max-w-[80vw]">
                <div className="flex items-center justify-between gap-3">
                    <span>当前回合：<span className="text-amber-300 font-bold">{currentPlayer?.name || '等待中'}</span></span>
                    {isMyTurn ? <span className="text-emerald-300 font-bold">可行动</span> : <span className="text-stone-400">等待</span>}
                </div>
                {isMyTurn && (
                    <div className="mt-2">
                        <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden">
                            <div className="h-full bg-amber-500 transition-all" style={{ width: `${(turnSecondsLeft / 20) * 100}%` }} />
                        </div>
                        <div className="mt-1 text-[10px] text-amber-200">建议 {turnSecondsLeft}s 内完成行动</div>
                    </div>
                )}
            </div>

            <PlayerBar
                players={safePlayers}
                currentTurnId={currentTurnId}
                myPlayerId={socketId}
                draggingCard={draggingCard}
                onDropOnPlayer={handleDropOnPlayer}
            />

            <div className="flex-1 min-h-0 relative flex items-center justify-center pt-20 pb-36 md:pb-56 px-2 md:px-4">
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

            <div className="lg:hidden fixed left-3 bottom-[168px] z-[75] flex gap-2">
                <button
                    onClick={() => {
                        setMobileDrawerOpen(true);
                        setMobilePanel('info');
                    }}
                    className="px-3 py-2 rounded-xl bg-stone-900/85 border border-amber-500/40 text-amber-200 text-xs font-bold"
                >
                    📜 战况
                </button>
                <button
                    onClick={() => {
                        setMobileDrawerOpen(true);
                        setMobilePanel('chat');
                    }}
                    className="px-3 py-2 rounded-xl bg-stone-900/85 border border-blue-500/40 text-blue-200 text-xs font-bold"
                >
                    💬 聊天
                </button>
                <button
                    onClick={handleMobileDiscard}
                    className="px-3 py-2 rounded-xl bg-stone-900/85 border border-red-500/40 text-red-200 text-xs font-bold"
                >
                    🗑️ 弃牌
                </button>
            </div>

            {mobileDrawerOpen && (
                <div className="lg:hidden fixed inset-x-0 bottom-[148px] z-[76] px-3">
                    <div className="rounded-2xl border border-stone-600 bg-stone-950/95 backdrop-blur-md shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-stone-700">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMobilePanel('info')}
                                    className={`px-3 py-1.5 text-xs rounded-lg font-bold ${mobilePanel === 'info' ? 'bg-amber-700/80 text-white' : 'bg-stone-800 text-stone-300'}`}
                                >
                                    事件
                                </button>
                                <button
                                    onClick={() => setMobilePanel('chat')}
                                    className={`px-3 py-1.5 text-xs rounded-lg font-bold ${mobilePanel === 'chat' ? 'bg-blue-700/80 text-white' : 'bg-stone-800 text-stone-300'}`}
                                >
                                    聊天
                                </button>
                                <button
                                    onClick={() => setMobilePanel('voice')}
                                    className={`px-3 py-1.5 text-xs rounded-lg font-bold ${mobilePanel === 'voice' ? 'bg-emerald-700/80 text-white' : 'bg-stone-800 text-stone-300'}`}
                                >
                                    语音
                                </button>
                            </div>
                            <button onClick={() => setMobileDrawerOpen(false)} className="text-stone-400">✕</button>
                        </div>

                        <div className="h-52">
                            {mobilePanel === 'info' && (
                                <div className="h-full scale-[0.88] origin-top">
                                    <InfoPanel
                                        logs={logs}
                                        currentPlayerName={currentPlayer?.name}
                                        actionPrompt={`身份: ${myRole === 'Gold Miner' ? '淘金者' : '破坏者'}`}
                                        hints={draggingCard ? '拖放道路到网格，破坏/修复拖至玩家头像' : '选择一张手牌开始行动'}
                                    />
                                </div>
                            )}

                            {mobilePanel === 'chat' && (
                                <div className="h-full p-3 text-stone-300 text-sm overflow-y-auto custom-scrollbar space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        {quickEmojiMessages.map((msg) => (
                                            <button
                                                key={msg}
                                                onClick={() => sendQuickMessage(msg)}
                                                className="rounded-md border border-stone-700 bg-stone-900 px-2 py-1 text-[11px]"
                                            >
                                                {msg}
                                            </button>
                                        ))}
                                    </div>
                                    {(chatMessages || []).length > 0 ? chatMessages.map((m, i) => (
                                        <div key={i} className="bg-stone-900 p-2 rounded-lg border border-stone-700">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-amber-400 font-bold">{m.name}</span>
                                                <span className="text-stone-500">{m.time}</span>
                                            </div>
                                            <div className="text-stone-200 break-words">{m.message}</div>
                                        </div>
                                    )) : <p className="text-stone-500 text-center py-4">暂无聊天记录</p>}
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            const input = e.target.mobileChat?.value?.trim();
                                            if (input) {
                                                sendChat(input);
                                                e.target.reset();
                                            }
                                        }}
                                        className="sticky bottom-0 bg-stone-950 pt-2 flex gap-2"
                                    >
                                        <input name="mobileChat" className="flex-1 bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm" placeholder="发消息..." />
                                        <button type="submit" className="px-3 py-2 rounded bg-amber-700 text-white text-sm font-bold">发送</button>
                                    </form>
                                </div>
                            )}

                            {mobilePanel === 'voice' && (
                                <div className="h-full p-3 space-y-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={toggleSpeaker}
                                            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold ${speakerEnabled ? 'bg-emerald-800/70 border-emerald-400 text-emerald-100' : 'bg-stone-900 border-stone-600 text-stone-200'}`}
                                        >
                                            {speakerEnabled ? '🔊 听筒开' : '🔈 听筒关'}
                                        </button>
                                        <button
                                            onClick={toggleMic}
                                            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold ${micEnabled ? 'bg-amber-700/80 border-amber-400 text-amber-100' : 'bg-stone-900 border-stone-600 text-stone-200'}`}
                                        >
                                            {micEnabled ? '🎙️ 麦克风开' : '🎤 麦克风关'}
                                        </button>
                                    </div>
                                    <div className="text-[11px] text-stone-400">
                                        弱网时建议使用聊天页快捷语句，避免语音中断影响协作。
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="hidden md:block">
                <ChatBox messages={chatMessages || []} onSendMessage={sendChat} />
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-[70] flex justify-center items-end pb-2 md:pb-4 pt-1 md:pt-2"
                style={{
                    minHeight: '132px',
                    paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))',
                    background: 'linear-gradient(to top, rgba(10,7,5,0.96) 0%, rgba(10,7,5,0.55) 60%, transparent 100%)',
                }}>
                <HandCards
                    cards={hand || []}
                    onDragStartCard={handleDragStartCard}
                    onDiscardCard={(c) => { discardCard(c); if (selectedCard?.id === c?.id) setSelectedCard(null); }}
                    selectedCardId={selectedCard?.id}
                    onSelectCard={(card) => setSelectedCard(card)}
                />
            </div>

            {tutorialOpen && (
                <div className="fixed inset-0 z-[95] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-sm rounded-2xl border border-amber-500/50 bg-stone-900 p-4">
                        <h3 className="text-amber-400 font-bold text-lg mb-1">新手引导</h3>
                        <h4 className="text-stone-100 font-bold text-sm mb-2">{tutorialSteps[tutorialStep].title}</h4>
                        <p className="text-stone-300 text-sm leading-relaxed">{tutorialSteps[tutorialStep].description}</p>
                        <div className="mt-4 flex items-center justify-between">
                            <button
                                onClick={() => setTutorialOpen(false)}
                                className="px-3 py-2 text-xs rounded-lg border border-stone-600 text-stone-300"
                            >
                                跳过
                            </button>
                            <button
                                onClick={() => {
                                    if (tutorialStep >= tutorialSteps.length - 1) {
                                        setTutorialOpen(false);
                                        setTutorialStep(0);
                                        return;
                                    }
                                    setTutorialStep(prev => prev + 1);
                                }}
                                className="px-4 py-2 text-xs rounded-lg bg-amber-700 text-white font-bold"
                            >
                                {tutorialStep >= tutorialSteps.length - 1 ? '开始游戏' : '下一步'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {mapResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-stone-900 border-2 border-amber-500 rounded-xl p-6 text-center max-w-sm w-full">
                        <h2 className="text-2xl text-amber-500 font-bold mb-4 font-medieval">地图探秘</h2>
                        <div className="text-6xl mb-4">{mapResult.isTreasure ? '💎' : '🪨'}</div>
                        <p className="text-stone-300 text-sm md:text-base">
                            你查看了终点卡({mapResult.coord})：<br />
                            <span className="text-xl font-bold text-white">{mapResult.isTreasure ? '这是金块！' : '这是石头。'}</span>
                        </p>
                    </div>
                </div>
            )}

            {roundResult && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="bg-stone-900 border-2 border-amber-500 rounded-xl p-5 md:p-8 text-center max-w-lg w-full">
                        <h2 className="text-2xl md:text-3xl text-amber-500 font-bold mb-6 font-medieval">回合结束</h2>
                        <p className="text-stone-200 text-base md:text-lg mb-6">{roundResult.msg}</p>
                        <ul className="text-left text-stone-300 mb-8 max-h-40 overflow-y-auto space-y-2">
                            {roundResult.players?.map((p, i) => {
                                const gain = roundResult.delta && roundResult.delta[p.playerKey] ? `(+${roundResult.delta[p.playerKey]})` : '';
                                return (
                                    <li key={i} className="flex justify-between border-b border-stone-800 pb-1 text-sm md:text-base">
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

            {gameOverResult && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="bg-stone-900 border-2 border-red-500 rounded-xl p-5 md:p-8 text-center max-w-lg w-full">
                        <h2 className="text-3xl md:text-4xl text-red-500 font-bold mb-6 font-medieval">游戏结束</h2>
                        <p className="text-stone-200 text-base md:text-lg mb-6">{gameOverResult.msg}</p>
                        <h3 className="text-amber-500 font-bold mb-2">最终得分：</h3>
                        <ul className="text-left text-stone-300 mb-8 max-h-40 overflow-y-auto space-y-2 bg-stone-950 p-4 rounded">
                            {(gameOverResult.players || []).sort((a, b) => (gameOverResult.scores[b.playerKey] || 0) - (gameOverResult.scores[a.playerKey] || 0)).map((p, i) => (
                                <li key={i} className="flex justify-between border-b border-stone-800 pb-1 text-sm md:text-base">
                                    <span>#{i + 1} {p.name} ({p.role === 'Gold Miner' ? '矿工' : '破坏者'})</span>
                                    <span className="text-amber-400 font-bold text-lg md:text-xl">{gameOverResult.scores[p.playerKey] || 0}</span>
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
