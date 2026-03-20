import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

const RTC_CONFIG = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function getSupportedAudioConstraints() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getSupportedConstraints) {
        return {};
    }

    return navigator.mediaDevices.getSupportedConstraints();
}

function buildPreferredMicConstraints() {
    const supported = getSupportedAudioConstraints();
    const audio = {};

    if (supported.echoCancellation) {
        audio.echoCancellation = { ideal: true };
    }
    if (supported.noiseSuppression) {
        audio.noiseSuppression = { ideal: true };
    }
    if (supported.autoGainControl) {
        audio.autoGainControl = { ideal: true };
    }
    if (supported.channelCount) {
        audio.channelCount = { ideal: 1 };
    }
    if (supported.sampleRate) {
        audio.sampleRate = { ideal: 48000 };
    }
    if (supported.sampleSize) {
        audio.sampleSize = { ideal: 16 };
    }
    if (supported.latency) {
        audio.latency = { ideal: 0.02 };
    }
    if (supported.voiceIsolation) {
        audio.voiceIsolation = true;
    }

    if (!Object.keys(audio).length) {
        audio.echoCancellation = true;
        audio.noiseSuppression = true;
        audio.autoGainControl = true;
    }

    return { audio, video: false };
}

async function getPreferredMicrophoneStream() {
    const preferredConstraints = buildPreferredMicConstraints();

    try {
        return await navigator.mediaDevices.getUserMedia(preferredConstraints);
    } catch (error) {
        if (preferredConstraints.audio === true) {
            throw error;
        }

        return navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
}

async function optimizeMicrophoneTrack(stream) {
    const [track] = stream?.getAudioTracks?.() || [];
    if (!track) return stream;

    if ('contentHint' in track) {
        track.contentHint = 'speech';
    }

    if (typeof track.applyConstraints === 'function') {
        const supported = getSupportedAudioConstraints();
        const trackConstraints = {};

        if (supported.echoCancellation) {
            trackConstraints.echoCancellation = true;
        }
        if (supported.noiseSuppression) {
            trackConstraints.noiseSuppression = true;
        }
        if (supported.autoGainControl) {
            trackConstraints.autoGainControl = true;
        }
        if (supported.voiceIsolation) {
            trackConstraints.voiceIsolation = true;
        }

        if (Object.keys(trackConstraints).length) {
            try {
                await track.applyConstraints(trackConstraints);
            } catch {
                // Ignore browsers that expose the API but reject voice-processing toggles.
            }
        }
    }

    return stream;
}

const STORAGE_KEYS = {
    username: 'saboteur_username',
    roomId: 'saboteur_room_id',
    playerKey: 'saboteur_player_key',
    lastJoinMode: 'saboteur_last_join_mode',
    legacyUser: 'saboteur_user',
    legacyToken: 'saboteur_token',
    legacyRoomId: 'saboteur_roomId',
    legacyPlayerKey: 'saboteur_playerKey'
};

function createLocalUser(username) {
    const cleanName = String(username || '').trim();
    if (!cleanName) return null;
    return {
        id: `guest:${cleanName}`,
        username: cleanName,
        nickname: cleanName
    };
}

function readStoredUsername() {
    if (typeof window === 'undefined') return '';

    const storedUsername = localStorage.getItem(STORAGE_KEYS.username);
    if (storedUsername) {
        return storedUsername;
    }

    const legacyUser = localStorage.getItem(STORAGE_KEYS.legacyUser);
    if (!legacyUser) {
        return '';
    }

    try {
        const parsedUser = JSON.parse(legacyUser);
        return String(parsedUser?.nickname || parsedUser?.username || '').trim();
    } catch {
        return '';
    }
}

function readStoredRoomSession() {
    if (typeof window === 'undefined') {
        return { roomId: '', playerKey: '', lastJoinMode: '' };
    }

    return {
        roomId: localStorage.getItem(STORAGE_KEYS.roomId) || localStorage.getItem(STORAGE_KEYS.legacyRoomId) || '',
        playerKey: localStorage.getItem(STORAGE_KEYS.playerKey) || localStorage.getItem(STORAGE_KEYS.legacyPlayerKey) || '',
        lastJoinMode: localStorage.getItem(STORAGE_KEYS.lastJoinMode) || ''
    };
}

function saveStoredUsername(username) {
    if (typeof window === 'undefined') return;

    const cleanName = String(username || '').trim();
    if (!cleanName) return;

    localStorage.setItem(STORAGE_KEYS.username, cleanName);
    localStorage.removeItem(STORAGE_KEYS.legacyUser);
    localStorage.removeItem(STORAGE_KEYS.legacyToken);
}

function saveStoredRoomSession({ roomId, playerKey, lastJoinMode }) {
    if (typeof window === 'undefined') return;

    if (roomId) {
        localStorage.setItem(STORAGE_KEYS.roomId, roomId);
    }
    if (playerKey) {
        localStorage.setItem(STORAGE_KEYS.playerKey, playerKey);
    }
    if (lastJoinMode) {
        localStorage.setItem(STORAGE_KEYS.lastJoinMode, lastJoinMode);
    }

    localStorage.removeItem(STORAGE_KEYS.legacyRoomId);
    localStorage.removeItem(STORAGE_KEYS.legacyPlayerKey);
}

function clearStoredRoomSession() {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(STORAGE_KEYS.roomId);
    localStorage.removeItem(STORAGE_KEYS.playerKey);
    localStorage.removeItem(STORAGE_KEYS.lastJoinMode);
    localStorage.removeItem(STORAGE_KEYS.legacyRoomId);
    localStorage.removeItem(STORAGE_KEYS.legacyPlayerKey);
}

function clearStoredProfile() {
    if (typeof window === 'undefined') return;

    clearStoredRoomSession();
    localStorage.removeItem(STORAGE_KEYS.username);
    localStorage.removeItem(STORAGE_KEYS.legacyUser);
    localStorage.removeItem(STORAGE_KEYS.legacyToken);
}

function now() {
    return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function SocketProvider({ children }) {
    const socketRef = useRef(null);
    const peerConnectionsRef = useRef(new Map());
    const remoteAudiosRef = useRef(new Map());
    const localStreamRef = useRef(null);
    const speakerEnabledRef = useRef(false);
    const micEnabledRef = useRef(false);
    const roomIdRef = useRef(null);
    const playerKeyRef = useRef(readStoredRoomSession().playerKey || null);
    const errorTimerRef = useRef(null);

    const initialUsername = readStoredUsername();

    const [user, setUser] = useState(() => createLocalUser(initialUsername));
    const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(initialUsername));

    const [roomId, setRoomId] = useState(null);
    const [playerKey, setPlayerKey] = useState(() => readStoredRoomSession().playerKey || null);
    const [isHost, setIsHost] = useState(false);
    const [players, setPlayers] = useState([]);
    const [playerCount, setPlayerCount] = useState(0);
    const [matchQueue, setMatchQueue] = useState({ inQueue: false, count: 0 });

    const [gameActive, setGameActive] = useState(false);
    const [myRole, setMyRole] = useState(null);
    const [hand, setHand] = useState([]);
    const [board, setBoard] = useState({});
    const [currentTurnId, setCurrentTurnId] = useState(null);
    const [round, setRound] = useState(1);
    const [scores, setScores] = useState({});

    const [speakerEnabled, setSpeakerEnabled] = useState(false);
    const [micEnabled, setMicEnabled] = useState(false);
    const [voiceError, setVoiceError] = useState('');

    const [logs, setLogs] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [errorMsg, setErrorMsg] = useState(null);
    const [roundResult, setRoundResult] = useState(null);
    const [gameOverResult, setGameOverResult] = useState(null);
    const [mapResult, setMapResult] = useState(null);

    const showError = useCallback((message) => {
        if (!message) return;
        setErrorMsg(message);
        if (errorTimerRef.current) {
            clearTimeout(errorTimerRef.current);
        }
        errorTimerRef.current = setTimeout(() => {
            setErrorMsg(null);
            errorTimerRef.current = null;
        }, 4000);
    }, []);

    const stopLocalMicTracks = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }
    }, []);

    const closeAllVoiceConnections = useCallback(() => {
        peerConnectionsRef.current.forEach(connection => connection.close());
        peerConnectionsRef.current.clear();

        remoteAudiosRef.current.forEach(audio => {
            try {
                audio.pause();
                audio.srcObject = null;
            } catch {
                // ignore
            }
        });
        remoteAudiosRef.current.clear();
    }, []);

    const setAudioSinkState = useCallback((enabled) => {
        remoteAudiosRef.current.forEach(audio => {
            audio.muted = !enabled;
            if (enabled) {
                audio.play().catch(() => {
                    // Some browsers require a follow-up gesture.
                });
            }
        });
    }, []);

    const ensurePeerConnection = useCallback((targetId) => {
        const existingConnection = peerConnectionsRef.current.get(targetId);
        if (existingConnection) return existingConnection;

        const socket = socketRef.current;
        const connection = new RTCPeerConnection(RTC_CONFIG);

        connection.onicecandidate = (event) => {
            if (event.candidate) {
                socket?.emit('voice-ice-candidate', { targetId, candidate: event.candidate });
            }
        };

        connection.ontrack = (event) => {
            let audio = remoteAudiosRef.current.get(targetId);
            if (!audio) {
                audio = new Audio();
                audio.autoplay = true;
                audio.playsInline = true;
                remoteAudiosRef.current.set(targetId, audio);
            }
            const [stream] = event.streams;
            audio.srcObject = stream;
            audio.muted = !speakerEnabledRef.current;
            if (speakerEnabledRef.current) {
                audio.play().catch(() => {
                    // Some browsers require a follow-up gesture.
                });
            }
        };

        peerConnectionsRef.current.set(targetId, connection);
        return connection;
    }, []);

    const attachLocalTracks = useCallback((connection) => {
        const stream = localStreamRef.current;
        if (!stream) return;

        const activeTrackIds = connection.getSenders().map(sender => sender.track && sender.track.id).filter(Boolean);
        stream.getAudioTracks().forEach(track => {
            if (!activeTrackIds.includes(track.id)) {
                connection.addTrack(track, stream);
            }
        });
    }, []);

    const createOfferToPeer = useCallback(async (targetId) => {
        const socket = socketRef.current;
        if (!socket || !roomIdRef.current || targetId === socket.id) return;

        const connection = ensurePeerConnection(targetId);
        attachLocalTracks(connection);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        socket.emit('voice-offer', { targetId, offer: connection.localDescription });
    }, [attachLocalTracks, ensurePeerConnection]);

    const resetGameState = useCallback(() => {
        setGameActive(false);
        setMyRole(null);
        setHand([]);
        setBoard({});
        setCurrentTurnId(null);
        setRound(1);
        setScores({});
        setLogs([]);
        setChatMessages([]);
        setRoundResult(null);
        setGameOverResult(null);
        setMapResult(null);
    }, []);

    const resetRoomState = useCallback(({ clearSession = false } = {}) => {
        stopLocalMicTracks();
        closeAllVoiceConnections();
        setSpeakerEnabled(false);
        setMicEnabled(false);
        setVoiceError('');
        setRoomId(null);
        setPlayerKey(null);
        setIsHost(false);
        setPlayers([]);
        setPlayerCount(0);
        setMatchQueue({ inQueue: false, count: 0 });
        resetGameState();
        if (clearSession) {
            clearStoredRoomSession();
        }
    }, [closeAllVoiceConnections, resetGameState, stopLocalMicTracks]);

    const restoreProfileFromStorage = useCallback(() => {
        const storedUsername = readStoredUsername();
        const nextUser = createLocalUser(storedUsername);
        setUser(nextUser);
        setIsAuthenticated(Boolean(nextUser));
        return nextUser;
    }, []);

    const handleInvalidStoredSession = useCallback((message) => {
        resetRoomState({ clearSession: true });
        restoreProfileFromStorage();
        showError(message);
    }, [resetRoomState, restoreProfileFromStorage, showError]);

    useEffect(() => {
        const socket = io({ transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            const storedUser = restoreProfileFromStorage();
            const storedSession = readStoredRoomSession();

            if (storedSession.playerKey) {
                setPlayerKey(storedSession.playerKey);
            }
            if (storedSession.roomId && storedSession.playerKey) {
                socket.emit('reconnectPlayer', {
                    roomId: storedSession.roomId,
                    playerKey: storedSession.playerKey
                });
            } else if (storedUser) {
                setIsAuthenticated(true);
            }
        });

        socket.on('roomJoined', (data) => {
            setRoomId(data.roomId);
            setPlayerKey(data.playerKey);
            setIsHost(Boolean(data.isHost));
            setGameActive(Boolean(data.status && data.status !== 'waiting'));
            setRoundResult(null);
            setGameOverResult(null);
            setMapResult(null);
            saveStoredRoomSession({
                roomId: data.roomId,
                playerKey: data.playerKey,
                lastJoinMode: data.joinMode || 'join'
            });
        });

        socket.on('roomPlayers', (data) => {
            const nextPlayers = data.players || [];
            setPlayers(nextPlayers);
            setPlayerCount(data.playerCount ?? nextPlayers.length);
            if (data.currentTurnId !== undefined) {
                setCurrentTurnId(data.currentTurnId);
            }

            const currentPlayerKey = playerKeyRef.current;
            if (currentPlayerKey) {
                const me = nextPlayers.find(player => player.playerKey === currentPlayerKey);
                if (me) {
                    setIsHost(Boolean(me.isHost));
                }
            }
        });

        socket.on('playerJoined', (data) => {
            if (typeof data?.playerCount === 'number') {
                setPlayerCount(data.playerCount);
            }
        });

        socket.on('playerLeft', (data) => {
            if (typeof data?.playerCount === 'number') {
                setPlayerCount(data.playerCount);
            }
        });

        socket.on('matchQueueStatus', (data) => {
            setMatchQueue(data);
        });

        socket.on('matchFound', (data) => {
            setMatchQueue({ inQueue: false, count: 0 });
            setRoomId(data.roomId);
            setPlayerKey(data.playerKey);
            setIsHost(Boolean(data.isHost));
            saveStoredRoomSession({
                roomId: data.roomId,
                playerKey: data.playerKey,
                lastJoinMode: data.joinMode || 'match'
            });
        });

        socket.on('gameStarted', (data) => {
            setGameActive(true);
            setMyRole(data.yourRole || null);
            setHand(data.yourHand || []);
            setBoard(data.board || {});
            setRound(data.round || 1);
            setScores(data.scores || {});
            setRoundResult(null);
            setGameOverResult(null);
            setMapResult(null);
            setLogs([{ time: now(), message: '游戏开始！' }]);
        });

        socket.on('reconnectedState', (data) => {
            const recoveredName = data.yourName || readStoredUsername();
            const recoveredUser = createLocalUser(recoveredName);
            if (recoveredUser) {
                setUser(recoveredUser);
                setIsAuthenticated(true);
                saveStoredUsername(recoveredName);
            }

            setRoomId(data.roomId);
            setPlayerKey(data.playerKey || readStoredRoomSession().playerKey || null);
            setIsHost(Boolean(data.isHost));
            setPlayers(data.players || []);
            setPlayerCount(data.players?.length || 0);
            setGameActive(Boolean(data.gameActive));
            setMyRole(data.yourRole || null);
            setHand(data.yourHand || []);
            setBoard(data.board || {});
            setRound(data.round || 1);
            setScores(data.scores || {});
            setCurrentTurnId(data.currentTurnId || null);
            setRoundResult(null);
            setGameOverResult(data.gameOverResult || null);
            setMapResult(null);
            setLogs([{ time: now(), message: '已为你恢复到之前的房间。' }]);

            saveStoredRoomSession({
                roomId: data.roomId,
                playerKey: data.playerKey || readStoredRoomSession().playerKey,
                lastJoinMode: readStoredRoomSession().lastJoinMode || 'join'
            });
        });

        socket.on('boardUpdated', (nextBoard) => {
            setBoard(nextBoard);
        });

        socket.on('handUpdated', (data) => {
            setHand(data.yourHand || []);
        });

        socket.on('turnUpdated', (data) => {
            setCurrentTurnId(data.currentTurnId || null);
        });

        socket.on('gameMsg', (message) => {
            setLogs(prevLogs => [...prevLogs, { time: now(), message }]);
        });

        socket.on('actionEffect', () => {
            // Reserved for future sound or haptic effects.
        });

        socket.on('mapResult', (data) => {
            setMapResult(data);
            setTimeout(() => setMapResult(null), 4000);
        });

        socket.on('roundOver', (data) => {
            setRoundResult(data);
            setRound((data.round || 0) + 1);
            setScores(data.scores || {});
            setLogs(prevLogs => [...prevLogs, { time: now(), message: `🚩 ${data.msg}` }]);
        });

        socket.on('finalGameOver', (data) => {
            setGameActive(true);
            setGameOverResult(data);
            setScores(data.scores || {});
            setLogs(prevLogs => [...prevLogs, { time: now(), message: `🏁 ${data.msg}` }]);
        });

        socket.on('roomExpired', (data) => {
            handleInvalidStoredSession(data?.message || '之前的房间已失效，请重新进入。');
        });

        socket.on('sessionInvalid', (data) => {
            handleInvalidStoredSession(data?.message || '之前的玩家身份已失效，请重新进入房间。');
        });

        socket.on('voice-enabled', async ({ from }) => {
            if (!from || from === socket.id) return;
            if (!speakerEnabledRef.current && !micEnabledRef.current) return;

            try {
                await createOfferToPeer(from);
            } catch (error) {
                setVoiceError(`语音连接失败: ${error.message}`);
            }
        });

        socket.on('voice-offer', async ({ from, offer }) => {
            try {
                const connection = ensurePeerConnection(from);
                attachLocalTracks(connection);
                await connection.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await connection.createAnswer();
                await connection.setLocalDescription(answer);
                socket.emit('voice-answer', { targetId: from, answer: connection.localDescription });
            } catch (error) {
                setVoiceError(`接收语音失败: ${error.message}`);
            }
        });

        socket.on('voice-answer', async ({ from, answer }) => {
            try {
                const connection = ensurePeerConnection(from);
                await connection.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (error) {
                setVoiceError(`语音应答失败: ${error.message}`);
            }
        });

        socket.on('voice-ice-candidate', async ({ from, candidate }) => {
            try {
                const connection = ensurePeerConnection(from);
                await connection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {
                // ignore transient ICE errors
            }
        });

        socket.on('chatMessage', (data) => {
            setChatMessages(prevMessages => [...prevMessages, data]);
        });

        socket.on('errorMsg', (message) => {
            showError(message);
        });

        return () => {
            stopLocalMicTracks();
            closeAllVoiceConnections();
            if (errorTimerRef.current) {
                clearTimeout(errorTimerRef.current);
                errorTimerRef.current = null;
            }
            socket.disconnect();
        };
    }, [attachLocalTracks, closeAllVoiceConnections, createOfferToPeer, ensurePeerConnection, handleInvalidStoredSession, restoreProfileFromStorage, showError, stopLocalMicTracks]);

    useEffect(() => {
        roomIdRef.current = roomId;
    }, [roomId]);

    useEffect(() => {
        playerKeyRef.current = playerKey;
    }, [playerKey]);

    useEffect(() => {
        speakerEnabledRef.current = speakerEnabled;
    }, [speakerEnabled]);

    useEffect(() => {
        micEnabledRef.current = micEnabled;
    }, [micEnabled]);

    useEffect(() => {
        setAudioSinkState(speakerEnabled);
    }, [speakerEnabled, setAudioSinkState]);

    useEffect(() => {
        if (!micEnabled || !roomId || !socketRef.current?.id) return;

        const mySocketId = socketRef.current.id;
        players
            .map(player => player.id)
            .filter(playerId => playerId && playerId !== mySocketId)
            .forEach(playerId => {
                if (!peerConnectionsRef.current.has(playerId)) {
                    createOfferToPeer(playerId).catch(() => {
                        // ignore one-off failures
                    });
                }
            });
    }, [players, micEnabled, roomId, createOfferToPeer]);

    const quickLogin = useCallback((nickname) => {
        const profile = createLocalUser(nickname);
        if (!profile) {
            throw new Error('请输入用户名');
        }

        saveStoredUsername(profile.nickname);
        setUser(profile);
        setIsAuthenticated(true);
        return profile;
    }, []);

    const createRoom = useCallback(() => {
        const activeName = user?.nickname || readStoredUsername();
        if (!activeName) {
            showError('请输入用户名');
            return;
        }
        socketRef.current?.emit('createRoom', { name: activeName });
    }, [showError, user]);

    const joinRoom = useCallback((id) => {
        const activeName = user?.nickname || readStoredUsername();
        if (!activeName) {
            showError('请输入用户名');
            return;
        }
        socketRef.current?.emit('joinRoom', { roomId: String(id || '').trim(), name: activeName });
    }, [showError, user]);

    const leaveRoom = useCallback(() => {
        const storedSession = readStoredRoomSession();
        const activeRoomId = roomId || storedSession.roomId;
        const activePlayerKey = playerKey || storedSession.playerKey;

        if (activeRoomId) {
            socketRef.current?.emit('leaveRoom', { roomId: activeRoomId, playerKey: activePlayerKey });
        }
        resetRoomState({ clearSession: true });
    }, [playerKey, resetRoomState, roomId]);

    const startGame = useCallback(() => {
        if (roomId) {
            socketRef.current?.emit('requestStartGame', { roomId });
        }
    }, [roomId]);

    const requestRematch = useCallback(() => {
        if (roomId) {
            socketRef.current?.emit('requestRematch', { roomId });
        }
    }, [roomId]);

    const joinMatchQueue = useCallback(() => {
        const activeName = user?.nickname || readStoredUsername();
        if (!activeName) {
            showError('请输入用户名');
            return;
        }

        resetRoomState({ clearSession: true });
        socketRef.current?.emit('joinMatchQueue', { username: activeName });
    }, [resetRoomState, showError, user]);

    const leaveMatchQueue = useCallback(() => {
        socketRef.current?.emit('leaveMatchQueue');
    }, []);

    const playCard = useCallback((card, targetX, targetY, targetPlayerId) => {
        if (!roomId) return;
        socketRef.current?.emit('playCard', { roomId, card, targetX, targetY, targetPlayerId });
    }, [roomId]);

    const discardCard = useCallback((card) => {
        if (!roomId) return;
        socketRef.current?.emit('discardCard', { roomId, card });
    }, [roomId]);

    const sendChat = useCallback((message) => {
        if (!roomId) return;
        socketRef.current?.emit('chatMessage', { roomId, message });
    }, [roomId]);

    const toggleSpeaker = useCallback(() => {
        setSpeakerEnabled(prevEnabled => !prevEnabled);
    }, []);

    const toggleMic = useCallback(async () => {
        if (!roomId) {
            setVoiceError('请先进入房间后再开启麦克风');
            return;
        }

        if (micEnabled) {
            stopLocalMicTracks();
            setMicEnabled(false);
            return;
        }

        try {
            const stream = await getPreferredMicrophoneStream();
            await optimizeMicrophoneTrack(stream);
            localStreamRef.current = stream;
            setMicEnabled(true);
            setVoiceError('');

            const mySocketId = socketRef.current?.id;
            const otherPlayerIds = players.map(player => player.id).filter(playerId => playerId && playerId !== mySocketId);
            for (const targetId of otherPlayerIds) {
                await createOfferToPeer(targetId);
            }

            socketRef.current?.emit('voice-enabled', { roomId });
        } catch (error) {
            setVoiceError(`无法开启麦克风: ${error.message}`);
        }
    }, [createOfferToPeer, micEnabled, players, roomId, stopLocalMicTracks]);

    const logout = useCallback(() => {
        resetRoomState({ clearSession: true });
        clearStoredProfile();
        setUser(null);
        setIsAuthenticated(false);
    }, [resetRoomState]);

    const clearRoundResult = useCallback(() => {
        setRoundResult(null);
    }, []);

    const clearGameOver = useCallback(() => {
        leaveRoom();
    }, [leaveRoom]);

    const socketId = socketRef.current?.id;

    const value = {
        socket: socketRef.current,
        socketId,
        user,
        isAuthenticated,
        quickLogin,
        logout,
        roomId,
        isHost,
        playerKey,
        players,
        playerCount,
        createRoom,
        joinRoom,
        leaveRoom,
        startGame,
        requestRematch,
        matchQueue,
        joinMatchQueue,
        leaveMatchQueue,
        gameActive,
        myRole,
        hand,
        board,
        currentTurnId,
        round,
        scores,
        playCard,
        discardCard,
        speakerEnabled,
        micEnabled,
        voiceError,
        toggleSpeaker,
        toggleMic,
        logs,
        chatMessages,
        sendChat,
        errorMsg,
        roundResult,
        gameOverResult,
        mapResult,
        clearRoundResult,
        clearGameOver
    };

    return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
