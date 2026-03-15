import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

const RTC_CONFIG = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

export function SocketProvider({ children }) {
    const socketRef = useRef(null);
    const peerConnectionsRef = useRef(new Map());
    const remoteAudiosRef = useRef(new Map());
    const localStreamRef = useRef(null);
    const speakerEnabledRef = useRef(false);
    const micEnabledRef = useRef(false);
    const roomIdRef = useRef(null);

    // Auth
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Room / Lobby
    const [roomId, setRoomId] = useState(null);
    const [playerKey, setPlayerKey] = useState(null);
    const [isHost, setIsHost] = useState(false);
    const [players, setPlayers] = useState([]);
    const [playerCount, setPlayerCount] = useState(0);
    const [matchQueue, setMatchQueue] = useState({ inQueue: false, count: 0 });

    // Game
    const [gameActive, setGameActive] = useState(false);
    const [myRole, setMyRole] = useState(null);
    const [hand, setHand] = useState([]);
    const [board, setBoard] = useState({});
    const [currentTurnId, setCurrentTurnId] = useState(null);
    const [round, setRound] = useState(1);
    const [scores, setScores] = useState({});

    // Voice
    const [speakerEnabled, setSpeakerEnabled] = useState(false);
    const [micEnabled, setMicEnabled] = useState(false);
    const [voiceError, setVoiceError] = useState('');

    // UI
    const [logs, setLogs] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [errorMsg, setErrorMsg] = useState(null);
    const [roundResult, setRoundResult] = useState(null);
    const [gameOverResult, setGameOverResult] = useState(null);
    const [mapResult, setMapResult] = useState(null);

    const stopLocalMicTracks = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
    }, []);

    const closeAllVoiceConnections = useCallback(() => {
        peerConnectionsRef.current.forEach(pc => pc.close());
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
                    // Some browsers require additional gesture.
                });
            }
        });
    }, []);

    const ensurePeerConnection = useCallback((targetId) => {
        const existing = peerConnectionsRef.current.get(targetId);
        if (existing) return existing;

        const socket = socketRef.current;
        const pc = new RTCPeerConnection(RTC_CONFIG);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket?.emit('voice-ice-candidate', { targetId, candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            let audio = remoteAudiosRef.current.get(targetId);
            if (!audio) {
                audio = new Audio();
                audio.autoplay = true;
                remoteAudiosRef.current.set(targetId, audio);
            }
            const [stream] = event.streams;
            audio.srcObject = stream;
            audio.muted = !speakerEnabledRef.current;
            if (speakerEnabledRef.current) {
                audio.play().catch(() => {
                    // Some browsers require additional gesture.
                });
            }
        };

        peerConnectionsRef.current.set(targetId, pc);
        return pc;
    }, []);

    const attachLocalTracks = useCallback((pc) => {
        const stream = localStreamRef.current;
        if (!stream) return;
        const currentTrackIds = pc.getSenders().map(s => s.track && s.track.id).filter(Boolean);
        stream.getAudioTracks().forEach(track => {
            if (!currentTrackIds.includes(track.id)) {
                pc.addTrack(track, stream);
            }
        });
    }, []);

    const createOfferToPeer = useCallback(async (targetId) => {
        const socket = socketRef.current;
        if (!socket || !roomIdRef.current || targetId === socket.id) return;
        const pc = ensurePeerConnection(targetId);
        attachLocalTracks(pc);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('voice-offer', { targetId, offer: pc.localDescription });
    }, [attachLocalTracks, ensurePeerConnection]);

    // --- Init socket ---
    useEffect(() => {
        const socket = io({ transports: ['websocket', 'polling'] });
        socketRef.current = socket;

        // Try auto-auth with stored token
        socket.on('connect', () => {
            const token = localStorage.getItem('saboteur_token');
            if (token) socket.emit('authenticate', token);
        });

        socket.on('authenticated', (data) => {
            if (data.success) {
                setUser(data.user);
                setIsAuthenticated(true);
                // Try reconnect to room
                const savedRoom = localStorage.getItem('saboteur_roomId');
                const savedKey = localStorage.getItem('saboteur_playerKey');
                if (savedRoom && savedKey) {
                    socket.emit('reconnectPlayer', { roomId: savedRoom, playerKey: savedKey });
                }
            }
        });

        // Room events
        socket.on('roomJoined', (data) => {
            setRoomId(data.roomId);
            setIsHost(data.isHost);
            setPlayerKey(data.playerKey);
            localStorage.setItem('saboteur_roomId', data.roomId);
            localStorage.setItem('saboteur_playerKey', data.playerKey);
        });

        socket.on('roomPlayers', (data) => {
            setPlayers(data.players || []);
        });

        socket.on('playerJoined', (data) => setPlayerCount(data.playerCount));
        socket.on('playerLeft', (data) => setPlayerCount(data.playerCount));

        // Matchmaking
        socket.on('matchQueueStatus', (data) => setMatchQueue(data));
        socket.on('matchFound', (data) => {
            setMatchQueue({ inQueue: false, count: 0 });
            setRoomId(data.roomId);
            setIsHost(data.isHost);
            setPlayerKey(data.playerKey);
            localStorage.setItem('saboteur_roomId', data.roomId);
            localStorage.setItem('saboteur_playerKey', data.playerKey);
        });

        // Game lifecycle
        socket.on('gameStarted', (data) => {
            setGameActive(true);
            setMyRole(data.yourRole);
            setHand(data.yourHand);
            setBoard(data.board);
            setRound(data.round || 1);
            setScores(data.scores || {});
            setRoundResult(null);
            setGameOverResult(null);
            setMapResult(null);
            setLogs([{ time: now(), message: '游戏开始！' }]);
        });

        socket.on('reconnectedState', (data) => {
            setRoomId(data.roomId);
            setGameActive(true);
            setMyRole(data.yourRole);
            setHand(data.yourHand);
            setBoard(data.board);
            setRound(data.round);
            setScores(data.scores || {});
            if (data.currentTurnId) setCurrentTurnId(data.currentTurnId);
            setLogs(prev => [...prev, { time: now(), message: '重连成功！' }]);
        });

        socket.on('boardUpdated', (newBoard) => setBoard(newBoard));
        socket.on('handUpdated', (data) => setHand(data.yourHand));
        socket.on('turnUpdated', (data) => {
            setCurrentTurnId(data.currentTurnId);
        });

        socket.on('gameMsg', (msg) => {
            setLogs(prev => [...prev, { time: now(), message: msg }]);
        });

        socket.on('actionEffect', () => {
            // Could trigger SFX here in the future
        });

        socket.on('mapResult', (data) => {
            setMapResult(data);
            setTimeout(() => setMapResult(null), 4000);
        });

        socket.on('roundOver', (data) => {
            setRoundResult(data);
            setRound(data.round + 1);
            setScores(data.scores || {});
            setLogs(prev => [...prev, { time: now(), message: `🚩 ${data.msg}` }]);
        });

        socket.on('finalGameOver', (data) => {
            setGameOverResult(data);
            setScores(data.scores || {});
            setLogs(prev => [...prev, { time: now(), message: `🏁 ${data.msg}` }]);
        });

        // Voice signaling
        socket.on('voice-enabled', async ({ from }) => {
            if (!from || from === socket.id) return;
            if (!speakerEnabledRef.current && !micEnabledRef.current) return;
            try {
                await createOfferToPeer(from);
            } catch (err) {
                setVoiceError(`语音连接失败: ${err.message}`);
            }
        });

        socket.on('voice-offer', async ({ from, offer }) => {
            try {
                const pc = ensurePeerConnection(from);
                attachLocalTracks(pc);
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('voice-answer', { targetId: from, answer: pc.localDescription });
            } catch (err) {
                setVoiceError(`接收语音失败: ${err.message}`);
            }
        });

        socket.on('voice-answer', async ({ from, answer }) => {
            try {
                const pc = ensurePeerConnection(from);
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
                setVoiceError(`语音应答失败: ${err.message}`);
            }
        });

        socket.on('voice-ice-candidate', async ({ from, candidate }) => {
            try {
                const pc = ensurePeerConnection(from);
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {
                // ignore transient ICE errors
            }
        });

        // Chat
        socket.on('chatMessage', (data) => {
            setChatMessages(prev => [...prev, data]);
        });

        // Errors
        socket.on('errorMsg', (msg) => {
            setErrorMsg(msg);
            setTimeout(() => setErrorMsg(null), 4000);
        });

        return () => {
            stopLocalMicTracks();
            closeAllVoiceConnections();
            socket.disconnect();
        };
    }, [attachLocalTracks, closeAllVoiceConnections, createOfferToPeer, ensurePeerConnection, stopLocalMicTracks]);


    useEffect(() => {
        speakerEnabledRef.current = speakerEnabled;
    }, [speakerEnabled]);

    useEffect(() => {
        micEnabledRef.current = micEnabled;
    }, [micEnabled]);

    useEffect(() => {
        roomIdRef.current = roomId;
    }, [roomId]);

    useEffect(() => {
        setAudioSinkState(speakerEnabled);
    }, [speakerEnabled, setAudioSinkState]);

    // Ensure mic-open players connect to newcomers
    useEffect(() => {
        if (!micEnabled || !roomId || !socketRef.current?.id) return;
        const me = socketRef.current.id;
        players
            .map(p => p.id)
            .filter(id => id && id !== me)
            .forEach(id => {
                if (!peerConnectionsRef.current.has(id)) {
                    createOfferToPeer(id).catch(() => {
                        // ignore one-off failures
                    });
                }
            });
    }, [players, micEnabled, roomId, createOfferToPeer]);

    // --- Action helpers ---

    const quickLogin = useCallback((nickname) => {
        const cleanName = String(nickname || '').trim();
        if (!cleanName) throw new Error('请输入用户名');
        const guestUser = { id: `guest_${Date.now()}`, username: cleanName, nickname: cleanName };
        setUser(guestUser);
        setIsAuthenticated(true);
        localStorage.setItem('saboteur_user', JSON.stringify(guestUser));
        localStorage.removeItem('saboteur_token');
        return guestUser;
    }, []);

    const login = useCallback(async (username, password) => {
        const res = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        localStorage.setItem('saboteur_token', data.token);
        localStorage.setItem('saboteur_user', JSON.stringify(data.user));
        socketRef.current?.emit('authenticate', data.token);
        return data;
    }, []);

    const register = useCallback(async (username, password, nickname) => {
        const res = await fetch('/api/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, nickname }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        return data;
    }, []);

    const createRoom = useCallback(() => {
        socketRef.current?.emit('createRoom', { name: user?.nickname });
    }, [user]);

    const joinRoom = useCallback((id) => {
        socketRef.current?.emit('joinRoom', { roomId: id, name: user?.nickname });
    }, [user]);

    const leaveRoom = useCallback(() => {
        const storedRoom = roomId || localStorage.getItem('saboteur_roomId');
        if (storedRoom) {
            socketRef.current?.emit('leaveRoom', { roomId: storedRoom });
        }
        stopLocalMicTracks();
        closeAllVoiceConnections();
        setSpeakerEnabled(false);
        setMicEnabled(false);
        setVoiceError('');
        setRoomId(null);
        setPlayers([]);
        setPlayerCount(0);
        setIsHost(false);
        setPlayerKey(null);
        setGameActive(false);
        setRoundResult(null);
        setGameOverResult(null);
        setMapResult(null);
        localStorage.removeItem('saboteur_roomId');
        localStorage.removeItem('saboteur_playerKey');
    }, [roomId, stopLocalMicTracks, closeAllVoiceConnections]);

    const startGame = useCallback(() => {
        if (roomId) socketRef.current?.emit('requestStartGame', { roomId });
    }, [roomId]);
    const requestRematch = useCallback(() => {
        if (roomId) socketRef.current?.emit('requestRematch', { roomId });
    }, [roomId]);

    const joinMatchQueue = useCallback(() => {
        socketRef.current?.emit('joinMatchQueue');
    }, []);

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
        setSpeakerEnabled(prev => !prev);
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
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            setMicEnabled(true);
            setVoiceError('');

            const myId = socketRef.current?.id;
            const others = players.map(p => p.id).filter(id => id && id !== myId);
            for (const targetId of others) {
                await createOfferToPeer(targetId);
            }

            socketRef.current?.emit('voice-enabled', { roomId });
        } catch (err) {
            setVoiceError(`无法开启麦克风: ${err.message}`);
        }
    }, [roomId, micEnabled, players, stopLocalMicTracks, createOfferToPeer]);

    const logout = useCallback(() => {
        stopLocalMicTracks();
        closeAllVoiceConnections();
        localStorage.removeItem('saboteur_token');
        localStorage.removeItem('saboteur_user');
        localStorage.removeItem('saboteur_roomId');
        localStorage.removeItem('saboteur_playerKey');
        setIsAuthenticated(false);
        setUser(null);
        setRoomId(null);
        setGameActive(false);
        window.location.reload();
    }, [stopLocalMicTracks, closeAllVoiceConnections]);

    const clearRoundResult = useCallback(() => setRoundResult(null), []);
    const clearGameOver = useCallback(() => {
        setGameOverResult(null);
        setGameActive(false);
        setRoomId(null);
        localStorage.removeItem('saboteur_roomId');
        localStorage.removeItem('saboteur_playerKey');
    }, []);

    const socketId = socketRef.current?.id;

    const value = {
        socket: socketRef.current, socketId,
        // Auth
        user, isAuthenticated, quickLogin, login, register, logout,
        // Room
        roomId, isHost, playerKey, players, playerCount, createRoom, joinRoom, leaveRoom, startGame, requestRematch,
        // Match
        matchQueue, joinMatchQueue, leaveMatchQueue,
        // Game
        gameActive, myRole, hand, board, currentTurnId, round, scores,
        playCard, discardCard,
        // Voice
        speakerEnabled, micEnabled, voiceError, toggleSpeaker, toggleMic,
        // UI
        logs, chatMessages, sendChat, errorMsg, roundResult, gameOverResult, mapResult,
        clearRoundResult, clearGameOver,
    };

    return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

function now() {
    return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
