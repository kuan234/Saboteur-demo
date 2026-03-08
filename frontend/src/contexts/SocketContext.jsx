import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {
    const socketRef = useRef(null);

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

    // UI
    const [logs, setLogs] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [errorMsg, setErrorMsg] = useState(null);
    const [roundResult, setRoundResult] = useState(null);
    const [gameOverResult, setGameOverResult] = useState(null);
    const [mapResult, setMapResult] = useState(null);

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

        socket.on('actionEffect', (data) => {
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
            setGameActive(false);
            setLogs(prev => [...prev, { time: now(), message: `🏁 ${data.msg}` }]);
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

        return () => { socket.disconnect(); };
    }, []);

    // --- Action helpers ---
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
    }, [roomId]);

    const startGame = useCallback(() => {
        if (roomId) socketRef.current?.emit('requestStartGame', { roomId });
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

    const logout = useCallback(() => {
        localStorage.removeItem('saboteur_token');
        localStorage.removeItem('saboteur_user');
        localStorage.removeItem('saboteur_roomId');
        localStorage.removeItem('saboteur_playerKey');
        setIsAuthenticated(false);
        setUser(null);
        setRoomId(null);
        setGameActive(false);
        window.location.reload();
    }, []);

    const clearRoundResult = useCallback(() => setRoundResult(null), []);
    const clearGameOver = useCallback(() => {
        setGameOverResult(null);
        setRoomId(null);
        localStorage.removeItem('saboteur_roomId');
        localStorage.removeItem('saboteur_playerKey');
    }, []);

    const socketId = socketRef.current?.id;

    const value = {
        socket: socketRef.current, socketId,
        // Auth
        user, isAuthenticated, login, register, logout,
        // Room
        roomId, isHost, playerKey, players, playerCount, createRoom, joinRoom, leaveRoom, startGame,
        // Match
        matchQueue, joinMatchQueue, leaveMatchQueue,
        // Game
        gameActive, myRole, hand, board, currentTurnId, round, scores,
        playCard, discardCard,
        // UI
        logs, chatMessages, sendChat, errorMsg, roundResult, gameOverResult, mapResult,
        clearRoundResult, clearGameOver,
    };

    return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

function now() {
    return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
