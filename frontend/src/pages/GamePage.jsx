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
        description: '从下方手牌拖到棋盘空位，即可打出道路牌。行动牌可以拖到玩家头像上。',
    },
    {
        title: '步骤 2 / 3：旋转道路牌',
        description: '手机端先点选卡牌，再用“旋转”按钮操作，也支持双击旋转。',
    },
    {
        title: '步骤 3 / 3：弃牌跳过',
        description: '不想出牌时，可先选中卡牌再点击“弃牌”，也可以直接点底部“弃牌”按钮。',
    },
];

const quickVoiceFallbackMessages = [
    '我这回合先探路',
    '我被堵了，求修理',
    '注意，这个人可能是破坏者',
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
        speakerEnabled, micEnabled, voiceError, toggleSpeaker, toggleMic,
        isHost, requestRematch, round
    } = useSocket();

    const [draggingCard, setDraggingCard] = useState(null);
    const [draggingRotation, setDraggingRotation] = useState(false);
    const [mobilePanel, setMobilePanel] = useState('info');
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState(null);
    const [rotatedCardIds, setRotatedCardIds] = useState({});
    const [showMyTurnHint, setShowMyTurnHint] = useState(false);
    const [turnSecondsLeft, setTurnSecondsLeft] = useState(20);
    const [tutorialOpen, setTutorialOpen] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
    const [eventBanner, setEventBanner] = useState('');
    const [actionPulse, setActionPulse] = useState(false);
    const [showAllMobileLogs, setShowAllMobileLogs] = useState(false);
    const [rematchPending, setRematchPending] = useState(false);
    const prevTurnRef = useRef(null);

    const safePlayers = players || [];
    const safeHand = hand || [];
    const currentPlayer = safePlayers.find(p => p.id === currentTurnId);
    const selectedCard = safeHand.find(card => card.id === selectedCardId) || null;
    const isMyTurn = currentTurnId === socketId;
    const roleLabel = myRole === 'Gold Miner' ? '淘金者' : '破坏者';
    const actionPrompt = `身份: ${roleLabel}`;
    const actionHint = draggingCard
        ? '拖放道路到网格，破坏/修复牌拖到玩家头像'
        : '选择一张手牌开始行动';
    const speakerLabel = speakerEnabled ? '🔊 听筒开' : '🔈 听筒关';
    const micLabel = micEnabled ? '🎙️ 麦克风开' : '🎤 麦克风关';

    const openMobilePanel = (panel) => {
        setMobilePanel(panel);
        setMobileDrawerOpen(true);
    };
    const reopenTutorial = () => {
        setTutorialStep(0);
        setTutorialOpen(true);
        setMobileDrawerOpen(false);
    };

    const toggleCardRotation = (cardId) => {
        if (!cardId) return;
        setRotatedCardIds(prev => ({ ...prev, [cardId]: !prev[cardId] }));
    };

    const clearCardTransientState = (cardId) => {
        if (!cardId) return;
        setSelectedCardId(prev => (prev === cardId ? null : prev));
        setRotatedCardIds(prev => {
            if (!Object.prototype.hasOwnProperty.call(prev, cardId)) return prev;
            const next = { ...prev };
            delete next[cardId];
            return next;
        });
        if (draggingCard?.id === cardId) {
            setDraggingCard(null);
            setDraggingRotation(false);
        }
    };

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

    useEffect(() => {
        const handIds = new Set(safeHand.map(card => card.id));

        setSelectedCardId(prev => (prev && handIds.has(prev) ? prev : null));
        setRotatedCardIds(prev => {
            let changed = false;
            const next = {};
            Object.entries(prev).forEach(([cardId, rotated]) => {
                if (handIds.has(cardId)) {
                    next[cardId] = rotated;
                } else {
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
        setDraggingCard(prev => {
            if (!prev || handIds.has(prev.id)) return prev;
            setDraggingRotation(false);
            return null;
        });
    }, [safeHand]);

    const handleDragStartCard = (e, card) => {
        setDraggingCard(card);
        setDraggingRotation(Boolean(card?.id && rotatedCardIds[card.id]));
        setSelectedCardId(card?.id || null);
    };

    const handleDropCardOnBoard = (card, position, rotated) => {
        const targetX = position.x;
        const targetY = position.y - 2;
        const isRotated = typeof rotated === 'boolean' ? rotated : Boolean(card?.id && rotatedCardIds[card.id]);
        const finalCard = {
            ...card,
            rotation: isRotated ? 180 : 0,
            dirs: isRotated ? rotateDirs180(card.dirs) : card.dirs,
        };
        playCard(finalCard, targetX, targetY);
        triggerActionFeedback();
        clearCardTransientState(card?.id);
        return false;
    };

    const handleDropOnPlayer = (card, targetPlayerId) => {
        const finalCard = { ...card, rotation: 0 };
        playCard(finalCard, null, null, targetPlayerId);
        triggerActionFeedback();
        clearCardTransientState(card?.id);
    };

    const handleDiscardCard = (card) => {
        if (!card) return;
        discardCard(card);
        triggerActionFeedback();
        clearCardTransientState(card.id);
    };

    const handleMobileDiscard = () => {
        if (selectedCard) {
            handleDiscardCard(selectedCard);
            return;
        }
        if (safeHand.length > 0) {
            handleDiscardCard(safeHand[0]);
        }
    };

    const sendQuickMessage = (message) => {
        sendChat(message);
        setMobileDrawerOpen(false);
    };

    const handleSelectCard = (card) => {
        const cardId = card?.id;
        if (!cardId) return;
        setSelectedCardId(prev => (prev === cardId ? null : cardId));
    };

    const triggerActionFeedback = () => {
        setActionPulse(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(35);
        setTimeout(() => setActionPulse(false), 280);
    };

    useEffect(() => {
        if (!logs || logs.length === 0) return;
        const latest = logs[logs.length - 1]?.message;
        if (!latest) return;
        setEventBanner(latest);
        const t = setTimeout(() => setEventBanner(''), 2400);
        return () => clearTimeout(t);
    }, [logs]);

    useEffect(() => {
        if (!gameOverResult) {
            setRematchPending(false);
        }
    }, [gameOverResult]);

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative" data-testid="game-page" data-current-round={String(round || 1)}
            style={{ background: 'radial-gradient(ellipse at 50% 40%, #1e1610 0%, #0a0705 100%)' }}>

            <div className="absolute top-0 left-0 w-64 h-64 pointer-events-none opacity-30"
                style={{ background: 'radial-gradient(circle, rgba(255,180,50,0.3) 0%, transparent 70%)' }} />
            <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none opacity-20"
                style={{ background: 'radial-gradient(circle, rgba(255,180,50,0.2) 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-40 pointer-events-none opacity-20"
                style={{ background: 'radial-gradient(ellipse, rgba(255,160,40,0.3) 0%, transparent 80%)' }} />


            {showMyTurnHint && (
                <div className="pointer-events-none fixed left-1/2 top-24 z-[90] -translate-x-1/2 rounded-full border border-amber-300/60 bg-amber-600/80 px-4 py-2 text-xs font-bold text-amber-50 shadow-lg md:text-sm" data-testid="turn-hint">
                    轮到你行动了！
                </div>
            )}

            {eventBanner && (
                <div className="pointer-events-none fixed left-1/2 top-36 z-[89] w-[88vw] max-w-md -translate-x-1/2 rounded-xl border border-blue-400/40 bg-stone-900/90 px-3 py-2 text-center text-xs text-blue-100 shadow-lg md:text-sm" data-testid="event-banner">
                    {eventBanner}
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
                    data-testid="desktop-toggle-speaker"
                    className={`px-3 py-2 rounded-xl border text-xs md:text-sm font-bold shadow-md transition-all ${speakerEnabled
                        ? 'bg-emerald-800/70 border-emerald-400 text-emerald-100'
                        : 'bg-stone-900/70 border-stone-600 text-stone-200 hover:bg-stone-800/80'}`}
                >
                    {speakerLabel}
                </button>
                <button
                    onClick={toggleMic}
                    data-testid="desktop-toggle-mic"
                    className={`px-3 py-2 rounded-xl border text-xs md:text-sm font-bold shadow-md transition-all ${micEnabled
                        ? 'bg-amber-700/80 border-amber-400 text-amber-100'
                        : 'bg-stone-900/70 border-stone-600 text-stone-200 hover:bg-stone-800/80'}`}
                >
                    {micLabel}
                </button>
            </div>

            <div className="lg:hidden fixed right-3 top-3 z-[82]">
                <button
                    onClick={() => openMobilePanel('info')}
                    data-testid="mobile-menu-button"
                    className="px-3 py-2 rounded-xl bg-stone-900/85 border border-stone-600 text-stone-200 text-xs font-bold"
                >
                    菜单
                </button>
            </div>

            {voiceError && (
                <div className="pointer-events-none fixed right-3 top-28 md:top-16 md:right-4 z-[80] max-w-xs rounded border border-red-500 bg-red-900/75 px-3 py-2 text-xs text-red-100" data-testid="voice-error-banner">
                    <div>{voiceError}</div>
                    <div className="mt-1 text-[11px] text-amber-200">语音不可用，可改用快捷消息。</div>
                </div>
            )}

            {false && voiceError && (
                <div className="fixed left-3 right-3 top-36 z-[81] md:hidden rounded-xl border border-amber-500/40 bg-stone-950/95 p-3">
                    <p className="text-[11px] text-amber-300 mb-2">语音不可用，已切换到快捷消息。</p>
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

            <div className="lg:hidden fixed left-3 top-16 z-[79] rounded-xl border border-amber-500/40 bg-stone-950/90 px-3 py-2 text-[11px] text-stone-200 max-w-[80vw]" data-testid="mobile-hud">
                <div className="flex items-center justify-between gap-3">
                    <span>当前回合：<span className="text-amber-300 font-bold">{currentPlayer?.name || '等待中'}</span></span>
                    {isMyTurn ? <span className="text-emerald-300 font-bold">可行动</span> : <span className="text-stone-400">等待</span>}
                </div>
                {isMyTurn && (
                    <div className="mt-2">
                        <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden">
                            <div className="h-full bg-amber-500 transition-all" style={{ width: `${(turnSecondsLeft / 20) * 100}%` }} />
                        </div>
                        <div className="mt-1 text-[10px] text-amber-200">建议在 {turnSecondsLeft}s 内完成行动</div>
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
                        actionPrompt={actionPrompt}
                        hints={actionHint}
                    />
                </div>
            </div>

            <div className="lg:hidden fixed left-3 bottom-[168px] z-[65] flex gap-2">
                <button
                    onClick={() => openMobilePanel('info')}
                    data-testid="mobile-info-button"
                    className="px-3 py-2 rounded-xl bg-stone-900/85 border border-amber-500/40 text-amber-200 text-xs font-bold"
                >
                    📜 战况
                </button>
                <button
                    onClick={() => openMobilePanel('chat')}
                    data-testid="mobile-chat-button"
                    className="px-3 py-2 rounded-xl bg-stone-900/85 border border-blue-500/40 text-blue-200 text-xs font-bold"
                >
                    💬 聊天
                </button>
                {voiceError && (
                    <button
                        onClick={() => openMobilePanel('chat')}
                        data-testid="voice-fallback-entry"
                        className="px-3 py-2 rounded-xl bg-stone-900/85 border border-amber-500/50 text-amber-200 text-xs font-bold"
                    >
                        快捷消息
                    </button>
                )}
                <button
                    onClick={handleMobileDiscard}
                    data-testid="mobile-discard-button"
                    className="px-3 py-2 rounded-xl bg-stone-900/85 border border-red-500/40 text-red-200 text-xs font-bold"
                >
                    🗑️ 弃牌
                </button>
            </div>

            {mobileDrawerOpen && (
                <div className="lg:hidden fixed inset-x-0 bottom-[148px] z-[76] px-3" data-testid="mobile-drawer">
                    <div className="rounded-2xl border border-stone-600 bg-stone-950/95 backdrop-blur-md shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 border-b border-stone-700">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMobilePanel('info')}
                                    data-testid="drawer-tab-info"
                                    className={`px-3 py-1.5 text-xs rounded-lg font-bold ${mobilePanel === 'info' ? 'bg-amber-700/80 text-white' : 'bg-stone-800 text-stone-300'}`}
                                >
                                    事件
                                </button>
                                <button
                                    onClick={() => setMobilePanel('chat')}
                                    data-testid="drawer-tab-chat"
                                    className={`px-3 py-1.5 text-xs rounded-lg font-bold ${mobilePanel === 'chat' ? 'bg-blue-700/80 text-white' : 'bg-stone-800 text-stone-300'}`}
                                >
                                    聊天
                                </button>
                                <button
                                    onClick={() => setMobilePanel('voice')}
                                    data-testid="drawer-tab-voice"
                                    className={`px-3 py-1.5 text-xs rounded-lg font-bold ${mobilePanel === 'voice' ? 'bg-emerald-700/80 text-white' : 'bg-stone-800 text-stone-300'}`}
                                >
                                    语音
                                </button>
                            </div>
                            <button onClick={() => setMobileDrawerOpen(false)} data-testid="close-mobile-drawer" className="text-stone-400">✕</button>
                        </div>

                        <div className="h-52">
                            {mobilePanel === 'info' && (
                                <div className="h-full p-3 flex flex-col gap-2" data-testid="mobile-info-panel">
                                    <div className="flex items-center justify-between gap-2">
                                        <button
                                            type="button"
                                            data-testid="toggle-mobile-log-scope"
                                            onClick={() => setShowAllMobileLogs(prev => !prev)}
                                            className="rounded-lg border border-amber-500/30 bg-stone-900 px-2.5 py-1.5 text-[11px] font-bold text-amber-200"
                                        >
                                            {showAllMobileLogs ? '仅看最近 3 条' : `查看全部 (${logs?.length || 0})`}
                                        </button>
                                        <button
                                            type="button"
                                            data-testid="reopen-tutorial"
                                            onClick={reopenTutorial}
                                            className="rounded-lg border border-blue-500/30 bg-stone-900 px-2.5 py-1.5 text-[11px] font-bold text-blue-200"
                                        >
                                            重看引导
                                        </button>
                                    </div>
                                    <div className="min-h-0 flex-1">
                                    <InfoPanel
                                        logs={showAllMobileLogs ? logs : (logs || []).slice(-3)}
                                        currentPlayerName={currentPlayer?.name}
                                        actionPrompt={actionPrompt}
                                        hints={actionHint}
                                        variant="mobile"
                                    />
                                    </div>
                                </div>
                            )}

                            {mobilePanel === 'chat' && (
                                <div className="h-full p-3 text-stone-300 text-sm overflow-y-auto custom-scrollbar space-y-2" data-testid="mobile-chat-panel">
                                    {voiceError && (
                                        <div className="rounded-lg border border-amber-500/30 bg-amber-950/40 p-2" data-testid="voice-fallback-panel">
                                            <div className="mb-2 text-[11px] font-bold text-amber-300">语音不可用，已启用快捷消息。</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {quickVoiceFallbackMessages.map((msg, index) => (
                                                    <button
                                                        key={msg}
                                                        onClick={() => sendQuickMessage(msg)}
                                                        data-testid={`voice-fallback-message-${index}`}
                                                        className="rounded-md border border-amber-500/30 bg-stone-900 px-2 py-1 text-[11px]"
                                                    >
                                                        {msg}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-2">
                                        {quickEmojiMessages.map((msg, index) => (
                                            <button
                                                key={msg}
                                                onClick={() => sendQuickMessage(msg)}
                                                data-testid={`quick-emoji-message-${index}`}
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
                                        data-testid="mobile-chat-form"
                                    >
                                        <input name="mobileChat" data-testid="mobile-chat-input" className="flex-1 bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm" placeholder="发送消息..." />
                                        <button type="submit" data-testid="mobile-chat-submit" className="px-3 py-2 rounded bg-amber-700 text-white text-sm font-bold">发送</button>
                                    </form>
                                </div>
                            )}

                            {mobilePanel === 'voice' && (
                                <div className="h-full p-3 space-y-3" data-testid="mobile-voice-panel">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={toggleSpeaker}
                                            data-testid="mobile-toggle-speaker"
                                            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold ${speakerEnabled ? 'bg-emerald-800/70 border-emerald-400 text-emerald-100' : 'bg-stone-900 border-stone-600 text-stone-200'}`}
                                        >
                                            {speakerLabel}
                                        </button>
                                        <button
                                            onClick={toggleMic}
                                            data-testid="mobile-toggle-mic"
                                            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold ${micEnabled ? 'bg-amber-700/80 border-amber-400 text-amber-100' : 'bg-stone-900 border-stone-600 text-stone-200'}`}
                                        >
                                            {micLabel}
                                        </button>
                                    </div>
                                    <div className="text-[11px] text-stone-400">
                                        已优先开启回声消除与语音优化；如果双方都开外放，仍建议佩戴耳机以减少串音。
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

            <div className={`fixed bottom-0 left-0 right-0 z-[62] pointer-events-none flex justify-center items-end overflow-visible pb-2 md:pb-4 pt-1 md:pt-2 ${actionPulse ? 'scale-[1.01]' : 'scale-100'}`} data-testid="hand-zone"
                style={{
                    minHeight: '164px',
                    paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))',
                    background: 'linear-gradient(to top, rgba(10,7,5,0.82) 0%, rgba(10,7,5,0.28) 55%, transparent 100%)',
                    transition: 'transform 0.2s ease',
                }}>
                <div className="pointer-events-auto w-full flex justify-center">
                    <HandCards
                        cards={safeHand}
                        onDragStartCard={handleDragStartCard}
                        onDiscardCard={handleDiscardCard}
                        selectedCardId={selectedCardId}
                        onSelectCard={handleSelectCard}
                        rotatedCardIds={rotatedCardIds}
                        onToggleRotation={toggleCardRotation}
                    />
                </div>
            </div>

            {tutorialOpen && (
                <div className="fixed inset-0 z-[95] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" data-testid="tutorial-modal">
                    <div className="w-full max-w-sm rounded-2xl border border-amber-500/50 bg-stone-900 p-4">
                        <h3 className="text-amber-400 font-bold text-lg mb-1">新手引导</h3>
                        <h4 className="text-stone-100 font-bold text-sm mb-2" data-testid="tutorial-step-title">{tutorialSteps[tutorialStep].title}</h4>
                        <p className="text-stone-300 text-sm leading-relaxed">{tutorialSteps[tutorialStep].description}</p>
                        <div className="mt-4 flex items-center justify-between">
                            <button
                                onClick={() => {
                                    setTutorialOpen(false);
                                    setTutorialStep(0);
                                }}
                                data-testid="tutorial-skip"
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
                                data-testid="tutorial-next"
                                className="px-4 py-2 text-xs rounded-lg bg-amber-700 text-white font-bold"
                            >
                                {tutorialStep >= tutorialSteps.length - 1 ? '开始游戏' : '下一步'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {mapResult && (
                <div className="fixed inset-0 z-[88] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" data-testid="map-result-modal">
                    <div className="bg-stone-900 border-2 border-amber-500 rounded-xl p-6 text-center max-w-sm w-full">
                        <h2 className="text-2xl text-amber-500 font-bold mb-4 font-medieval">地图探秘</h2>
                        <div className="text-6xl mb-4">{mapResult.isTreasure ? '💎' : '🪨'}</div>
                        <p className="text-stone-300 text-sm md:text-base">
                            你查看了终点卡 ({mapResult.coord})：<br />
                            <span className="text-xl font-bold text-white">{mapResult.isTreasure ? '这里是金块！' : '这里只是石头。'}</span>
                        </p>
                    </div>
                </div>
            )}

            {roundResult && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" data-testid="round-result-modal">
                    <div className="bg-stone-900 border-2 border-amber-500 rounded-xl p-5 md:p-8 text-center max-w-lg w-full">
                        <h2 className="text-2xl md:text-3xl text-amber-500 font-bold mb-6 font-medieval">回合结束</h2>
                        <p className="text-stone-200 text-base md:text-lg mb-6">{roundResult.msg}</p>
                        <ul className="text-left text-stone-300 mb-8 max-h-40 overflow-y-auto space-y-2" data-testid="round-score-list">
                            {roundResult.players?.map((p, i) => {
                                const gain = roundResult.delta && roundResult.delta[p.playerKey] ? `(+${roundResult.delta[p.playerKey]})` : '';
                                return (
                                    <li key={i} className="flex justify-between border-b border-stone-800 pb-1 text-sm md:text-base" data-testid={`round-score-row-${i}`} data-score-value={String(roundResult.scores[p.playerKey] || 0)}>
                                        <span>{p.name} ({p.role === 'Gold Miner' ? '矿工' : '破坏者'})</span>
                                        <span className="text-amber-400 font-bold">{roundResult.scores[p.playerKey] || 0} {gain}</span>
                                    </li>
                                );
                            })}
                        </ul>
                        <button
                            onClick={clearRoundResult}
                            data-testid="round-continue-button"
                            className="px-6 py-3 bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 rounded-lg text-white font-bold border border-amber-500/50"
                        >
                            继续下一轮
                        </button>
                    </div>
                </div>
            )}

            {gameOverResult && (
                <div className="fixed inset-0 z-[91] flex items-center justify-center bg-black/90 backdrop-blur-md p-4" data-testid="game-over-modal">
                    <div className="bg-stone-900 border-2 border-red-500 rounded-xl p-5 md:p-8 text-center max-w-lg w-full">
                        <h2 className="text-3xl md:text-4xl text-red-500 font-bold mb-6 font-medieval">游戏结束</h2>
                        <p className="text-stone-200 text-base md:text-lg mb-6">{gameOverResult.msg}</p>
                        <h3 className="text-amber-500 font-bold mb-2">最终得分：</h3>
                        <ul className="text-left text-stone-300 mb-8 max-h-40 overflow-y-auto space-y-2 bg-stone-950 p-4 rounded" data-testid="final-score-list">
                            {(gameOverResult.players || []).sort((a, b) => (gameOverResult.scores[b.playerKey] || 0) - (gameOverResult.scores[a.playerKey] || 0)).map((p, i) => (
                                <li key={i} className="flex justify-between border-b border-stone-800 pb-1 text-sm md:text-base" data-testid={`final-score-row-${i}`} data-score-value={String(gameOverResult.scores[p.playerKey] || 0)}>
                                    <span>#{i + 1} {p.name} ({p.role === 'Gold Miner' ? '矿工' : '破坏者'})</span>
                                    <span className="text-amber-400 font-bold text-lg md:text-xl">{gameOverResult.scores[p.playerKey] || 0}</span>
                                </li>
                            ))}
                        </ul>
                        {isHost ? (
                            <button
                                onClick={() => {
                                    setRematchPending(true);
                                    requestRematch();
                                }}
                                disabled={rematchPending}
                                data-testid="rematch-button"
                                className="mb-3 w-full px-6 py-3 bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 rounded-lg text-white font-bold border border-emerald-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {rematchPending ? '正在开启新对局...' : '再来一局'}
                            </button>
                        ) : (
                            <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-200" data-testid="rematch-waiting">
                                等待房主发起再来一局，原房间成员会直接进入新对局。
                            </div>
                        )}
                        <button
                            onClick={clearGameOver}
                            className="w-full px-6 py-3 bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 rounded-lg text-white font-bold border border-red-500/50"
                        >
                            返回大厅
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

