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
        title: 'æ­¥éª¤ 1 / 3ï¼šæ‹–ç‰Œæ”¾ç½®',
        description: 'ä»Žä¸‹æ–¹æ‰‹ç‰Œæ‹–æ‹½åˆ°æ£‹ç›˜ç©ºä½ï¼Œå³å¯æ‰“å‡ºé“è·¯ç‰Œã€‚è¡ŒåŠ¨ç‰Œå¯æ‹–åˆ°çŽ©å®¶å¤´åƒã€‚',
    },
    {
        title: 'æ­¥éª¤ 2 / 3ï¼šæ—‹è½¬é“è·¯ç‰Œ',
        description: 'æ‰‹æœºç«¯å…ˆç‚¹é€‰å¡ç‰Œï¼Œå†ç”¨â€œæ—‹è½¬â€æŒ‰é’®æ“ä½œï¼ˆä¹Ÿæ”¯æŒåŒå‡»æ—‹è½¬ï¼‰ã€‚',
    },
    {
        title: 'æ­¥éª¤ 3 / 3ï¼šå¼ƒç‰Œè·³è¿‡',
        description: 'ä¸æƒ³å‡ºç‰Œæ—¶å¯ç‚¹é€‰å¡ç‰ŒåŽä½¿ç”¨â€œå¼ƒç‰Œâ€ï¼Œä¹Ÿå¯ç›´æŽ¥ç‚¹å‡»åº•éƒ¨â€œå¼ƒç‰Œâ€æŒ‰é’®ã€‚',
    },
];

const quickVoiceFallbackMessages = [
    'æˆ‘è¿™å›žåˆå…ˆæŽ¢è·¯',
    'æˆ‘è¢«å µäº†ï¼Œæ±‚ä¿®ç†',
    'æ³¨æ„è¿™ä¸ªäººå¯èƒ½æ˜¯ç ´åè€…',
    'æˆ‘æœ‰åœ°å›¾ç‰Œ',
];

const quickEmojiMessages = [
    'æ€€ç–‘ä½ æ˜¯ç ´åè€… ðŸ‘€',
    'å¹²å¾—æ¼‚äº® ðŸ‘',
    'æ•‘æˆ‘ä¸€ä¸‹ ðŸ™',
    'è¿™æ¡è·¯å¯ç–‘ ðŸ¤¨',
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
    const [selectedCardId, setSelectedCardId] = useState(null);
    const [rotatedCardIds, setRotatedCardIds] = useState({});
    const [showMyTurnHint, setShowMyTurnHint] = useState(false);
    const [turnSecondsLeft, setTurnSecondsLeft] = useState(20);
    const [tutorialOpen, setTutorialOpen] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
    const [eventBanner, setEventBanner] = useState('');
    const [actionPulse, setActionPulse] = useState(false);
    const prevTurnRef = useRef(null);

    const safePlayers = players || [];
    const safeHand = hand || [];
    const currentPlayer = safePlayers.find(p => p.id === currentTurnId);
    const selectedCard = safeHand.find(card => card.id === selectedCardId) || null;
    const isMyTurn = currentTurnId === socketId;

    const openMobilePanel = (panel) => {
        setMobilePanel(panel);
        setMobileDrawerOpen(true);
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

    return (
        <div className="w-full h-full flex flex-col overflow-hidden relative" data-testid="game-page"
            style={{ background: 'radial-gradient(ellipse at 50% 40%, #1e1610 0%, #0a0705 100%)' }}>

            <div className="absolute top-0 left-0 w-64 h-64 pointer-events-none opacity-30"
                style={{ background: 'radial-gradient(circle, rgba(255,180,50,0.3) 0%, transparent 70%)' }} />
            <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none opacity-20"
                style={{ background: 'radial-gradient(circle, rgba(255,180,50,0.2) 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-40 pointer-events-none opacity-20"
                style={{ background: 'radial-gradient(ellipse, rgba(255,160,40,0.3) 0%, transparent 80%)' }} />


            {showMyTurnHint && (
                <div className="pointer-events-none fixed left-1/2 top-24 z-[90] -translate-x-1/2 rounded-full border border-amber-300/60 bg-amber-600/80 px-4 py-2 text-xs font-bold text-amber-50 shadow-lg md:text-sm" data-testid="turn-hint">
                    è½®åˆ°ä½ è¡ŒåŠ¨äº†ï¼
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
                        if (window.confirm('ç¡®å®šè¦é€€å‡ºæ­£åœ¨è¿›è¡Œçš„å¯¹å±€å—ï¼Ÿ')) {
                            leaveRoom();
                        }
                    }}
                    className="px-3 py-2 bg-red-900/50 hover:bg-red-800/70 border border-red-500/50 rounded-xl text-red-200 text-xs md:text-sm font-bold shadow-md transition-all flex items-center gap-1"
                >
                    <span>ðŸšª</span> é€€å‡º
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
                    {speakerEnabled ? 'ðŸ”Š å¬ç­’å¼€' : 'ðŸ”ˆ å¬ç­’å…³'}
                </button>
                <button
                    onClick={toggleMic}
                    data-testid="desktop-toggle-mic"
                    className={`px-3 py-2 rounded-xl border text-xs md:text-sm font-bold shadow-md transition-all ${micEnabled
                        ? 'bg-amber-700/80 border-amber-400 text-amber-100'
                        : 'bg-stone-900/70 border-stone-600 text-stone-200 hover:bg-stone-800/80'}`}
                >
                    {micEnabled ? 'ðŸŽ™ï¸ éº¦å…‹é£Žå¼€' : 'ðŸŽ¤ éº¦å…‹é£Žå…³'}
                </button>
            </div>

            <div className="lg:hidden fixed right-3 top-3 z-[82]">
                <button
                    onClick={() => openMobilePanel('info')}
                    data-testid="mobile-menu-button"
                    className="px-3 py-2 rounded-xl bg-stone-900/85 border border-stone-600 text-stone-200 text-xs font-bold"
                >
                    èœå•
                </button>
            </div>

            {voiceError && (
                <div className="pointer-events-none fixed right-3 top-28 md:top-16 md:right-4 z-[80] max-w-xs rounded border border-red-500 bg-red-900/75 px-3 py-2 text-xs text-red-100" data-testid="voice-error-banner">
                    <div>{voiceError}</div>
                    <div className="mt-1 text-[11px] text-amber-200">Voice unavailable. Use quick messages.</div>
                </div>
            )}

            {false && voiceError && (
                <div className="fixed left-3 right-3 top-36 z-[81] md:hidden rounded-xl border border-amber-500/40 bg-stone-950/95 p-3">
                    <p className="text-[11px] text-amber-300 mb-2">è¯­éŸ³ä¸å¯ç”¨ï¼Œå·²åˆ‡æ¢å¿«æ·æ¶ˆæ¯</p>
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
                    <span>å½“å‰å›žåˆï¼š<span className="text-amber-300 font-bold">{currentPlayer?.name || 'ç­‰å¾…ä¸­'}</span></span>
                    {isMyTurn ? <span className="text-emerald-300 font-bold">å¯è¡ŒåŠ¨</span> : <span className="text-stone-400">ç­‰å¾…</span>}
                </div>
                {isMyTurn && (
                    <div className="mt-2">
                        <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden">
                            <div className="h-full bg-amber-500 transition-all" style={{ width: `${(turnSecondsLeft / 20) * 100}%` }} />
                        </div>
                        <div className="mt-1 text-[10px] text-amber-200">å»ºè®® {turnSecondsLeft}s å†…å®Œæˆè¡ŒåŠ¨</div>
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
                        actionPrompt={`èº«ä»½: ${myRole === 'Gold Miner' ? 'æ·˜é‡‘è€…' : 'ç ´åè€…'}`}
                        hints={draggingCard ? 'æ‹–æ”¾é“è·¯åˆ°ç½‘æ ¼ï¼Œç ´å/ä¿®å¤æ‹–è‡³çŽ©å®¶å¤´åƒ' : 'é€‰æ‹©ä¸€å¼ æ‰‹ç‰Œå¼€å§‹è¡ŒåŠ¨'}
                    />
                </div>
            </div>

            <div className="lg:hidden fixed left-3 bottom-[168px] z-[75] flex gap-2">
                <button
                    onClick={() => openMobilePanel('info')}
                    data-testid="mobile-info-button"
                    className="px-3 py-2 rounded-xl bg-stone-900/85 border border-amber-500/40 text-amber-200 text-xs font-bold"
                >
                    ðŸ“œ æˆ˜å†µ
                </button>
                <button
                    onClick={() => openMobilePanel('chat')}
                    data-testid="mobile-chat-button"
                    className="px-3 py-2 rounded-xl bg-stone-900/85 border border-blue-500/40 text-blue-200 text-xs font-bold"
                >
                    ðŸ’¬ èŠå¤©
                </button>
                {voiceError && (
                    <button
                        onClick={() => openMobilePanel('chat')}
                        data-testid="voice-fallback-entry"
                        className="px-3 py-2 rounded-xl bg-stone-900/85 border border-amber-500/50 text-amber-200 text-xs font-bold"
                    >
                        Quick Msg
                    </button>
                )}
                <button
                    onClick={handleMobileDiscard}
                    data-testid="mobile-discard-button"
                    className="px-3 py-2 rounded-xl bg-stone-900/85 border border-red-500/40 text-red-200 text-xs font-bold"
                >
                    ðŸ—‘ï¸ å¼ƒç‰Œ
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
                                    äº‹ä»¶
                                </button>
                                <button
                                    onClick={() => setMobilePanel('chat')}
                                    data-testid="drawer-tab-chat"
                                    className={`px-3 py-1.5 text-xs rounded-lg font-bold ${mobilePanel === 'chat' ? 'bg-blue-700/80 text-white' : 'bg-stone-800 text-stone-300'}`}
                                >
                                    èŠå¤©
                                </button>
                                <button
                                    onClick={() => setMobilePanel('voice')}
                                    data-testid="drawer-tab-voice"
                                    className={`px-3 py-1.5 text-xs rounded-lg font-bold ${mobilePanel === 'voice' ? 'bg-emerald-700/80 text-white' : 'bg-stone-800 text-stone-300'}`}
                                >
                                    è¯­éŸ³
                                </button>
                            </div>
                            <button onClick={() => setMobileDrawerOpen(false)} data-testid="close-mobile-drawer" className="text-stone-400">âœ•</button>
                        </div>

                        <div className="h-52">
                            {mobilePanel === 'info' && (
                                <div className="h-full scale-[0.88] origin-top">
                                    <InfoPanel
                                        logs={logs}
                                        currentPlayerName={currentPlayer?.name}
                                        actionPrompt={`èº«ä»½: ${myRole === 'Gold Miner' ? 'æ·˜é‡‘è€…' : 'ç ´åè€…'}`}
                                        hints={draggingCard ? 'æ‹–æ”¾é“è·¯åˆ°ç½‘æ ¼ï¼Œç ´å/ä¿®å¤æ‹–è‡³çŽ©å®¶å¤´åƒ' : 'é€‰æ‹©ä¸€å¼ æ‰‹ç‰Œå¼€å§‹è¡ŒåŠ¨'}
                                    />
                                </div>
                            )}

                            {mobilePanel === 'chat' && (
                                <div className="h-full p-3 text-stone-300 text-sm overflow-y-auto custom-scrollbar space-y-2" data-testid="mobile-chat-panel">
                                    {voiceError && (
                                        <div className="rounded-lg border border-amber-500/30 bg-amber-950/40 p-2" data-testid="voice-fallback-panel">
                                            <div className="mb-2 text-[11px] font-bold text-amber-300">Voice unavailable. Quick messages enabled.</div>
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
                                    )) : <p className="text-stone-500 text-center py-4">æš‚æ— èŠå¤©è®°å½•</p>}
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
                                        <input name="mobileChat" data-testid="mobile-chat-input" className="flex-1 bg-stone-800 border border-stone-700 rounded px-3 py-2 text-sm" placeholder="å‘æ¶ˆæ¯..." />
                                        <button type="submit" data-testid="mobile-chat-submit" className="px-3 py-2 rounded bg-amber-700 text-white text-sm font-bold">å‘é€</button>
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
                                            {speakerEnabled ? 'ðŸ”Š å¬ç­’å¼€' : 'ðŸ”ˆ å¬ç­’å…³'}
                                        </button>
                                        <button
                                            onClick={toggleMic}
                                            data-testid="mobile-toggle-mic"
                                            className={`flex-1 px-3 py-2 rounded-lg border text-xs font-bold ${micEnabled ? 'bg-amber-700/80 border-amber-400 text-amber-100' : 'bg-stone-900 border-stone-600 text-stone-200'}`}
                                        >
                                            {micEnabled ? 'ðŸŽ™ï¸ éº¦å…‹é£Žå¼€' : 'ðŸŽ¤ éº¦å…‹é£Žå…³'}
                                        </button>
                                    </div>
                                    <div className="text-[11px] text-stone-400">
                                        å¼±ç½‘æ—¶å»ºè®®ä½¿ç”¨èŠå¤©é¡µå¿«æ·è¯­å¥ï¼Œé¿å…è¯­éŸ³ä¸­æ–­å½±å“åä½œã€‚
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

            <div className={`fixed bottom-0 left-0 right-0 z-[70] flex justify-center items-end pb-2 md:pb-4 pt-1 md:pt-2 ${actionPulse ? 'scale-[1.01]' : 'scale-100'}`} data-testid="hand-zone"
                style={{
                    minHeight: '132px',
                    paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))',
                    background: 'linear-gradient(to top, rgba(10,7,5,0.96) 0%, rgba(10,7,5,0.55) 60%, transparent 100%)',
                    transition: 'transform 0.2s ease',
                }}>
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

            {tutorialOpen && (
                <div className="fixed inset-0 z-[95] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" data-testid="tutorial-modal">
                    <div className="w-full max-w-sm rounded-2xl border border-amber-500/50 bg-stone-900 p-4">
                        <h3 className="text-amber-400 font-bold text-lg mb-1">æ–°æ‰‹å¼•å¯¼</h3>
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
                                è·³è¿‡
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
                                {tutorialStep >= tutorialSteps.length - 1 ? 'å¼€å§‹æ¸¸æˆ' : 'ä¸‹ä¸€æ­¥'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {mapResult && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-stone-900 border-2 border-amber-500 rounded-xl p-6 text-center max-w-sm w-full">
                        <h2 className="text-2xl text-amber-500 font-bold mb-4 font-medieval">åœ°å›¾æŽ¢ç§˜</h2>
                        <div className="text-6xl mb-4">{mapResult.isTreasure ? 'ðŸ’Ž' : 'ðŸª¨'}</div>
                        <p className="text-stone-300 text-sm md:text-base">
                            ä½ æŸ¥çœ‹äº†ç»ˆç‚¹å¡({mapResult.coord})ï¼š<br />
                            <span className="text-xl font-bold text-white">{mapResult.isTreasure ? 'è¿™æ˜¯é‡‘å—ï¼' : 'è¿™æ˜¯çŸ³å¤´ã€‚'}</span>
                        </p>
                    </div>
                </div>
            )}

            {roundResult && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="bg-stone-900 border-2 border-amber-500 rounded-xl p-5 md:p-8 text-center max-w-lg w-full">
                        <h2 className="text-2xl md:text-3xl text-amber-500 font-bold mb-6 font-medieval">å›žåˆç»“æŸ</h2>
                        <p className="text-stone-200 text-base md:text-lg mb-6">{roundResult.msg}</p>
                        <ul className="text-left text-stone-300 mb-8 max-h-40 overflow-y-auto space-y-2">
                            {roundResult.players?.map((p, i) => {
                                const gain = roundResult.delta && roundResult.delta[p.playerKey] ? `(+${roundResult.delta[p.playerKey]})` : '';
                                return (
                                    <li key={i} className="flex justify-between border-b border-stone-800 pb-1 text-sm md:text-base">
                                        <span>{p.name} ({p.role === 'Gold Miner' ? 'çŸ¿å·¥' : 'ç ´åè€…'})</span>
                                        <span className="text-amber-400 font-bold">{roundResult.scores[p.playerKey] || 0} {gain}</span>
                                    </li>
                                );
                            })}
                        </ul>
                        <button
                            onClick={clearRoundResult}
                            className="px-6 py-3 bg-gradient-to-b from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 rounded-lg text-white font-bold border border-amber-500/50"
                        >
                            ç»§ç»­ä¸‹ä¸€è½®
                        </button>
                    </div>
                </div>
            )}

            {gameOverResult && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="bg-stone-900 border-2 border-red-500 rounded-xl p-5 md:p-8 text-center max-w-lg w-full">
                        <h2 className="text-3xl md:text-4xl text-red-500 font-bold mb-6 font-medieval">æ¸¸æˆç»“æŸ</h2>
                        <p className="text-stone-200 text-base md:text-lg mb-6">{gameOverResult.msg}</p>
                        <h3 className="text-amber-500 font-bold mb-2">æœ€ç»ˆå¾—åˆ†ï¼š</h3>
                        <ul className="text-left text-stone-300 mb-8 max-h-40 overflow-y-auto space-y-2 bg-stone-950 p-4 rounded">
                            {(gameOverResult.players || []).sort((a, b) => (gameOverResult.scores[b.playerKey] || 0) - (gameOverResult.scores[a.playerKey] || 0)).map((p, i) => (
                                <li key={i} className="flex justify-between border-b border-stone-800 pb-1 text-sm md:text-base">
                                    <span>#{i + 1} {p.name} ({p.role === 'Gold Miner' ? 'çŸ¿å·¥' : 'ç ´åè€…'})</span>
                                    <span className="text-amber-400 font-bold text-lg md:text-xl">{gameOverResult.scores[p.playerKey] || 0}</span>
                                </li>
                            ))}
                        </ul>
                        <button
                            onClick={clearGameOver}
                            className="px-6 py-3 bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 rounded-lg text-white font-bold border border-red-500/50"
                        >
                            è¿”å›žå¤§åŽ…
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

