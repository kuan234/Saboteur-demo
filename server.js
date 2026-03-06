const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

// 多房间结构：每个房间都有自己的一套状态
// rooms[roomId] = {
//   hostId,
//   players: [{ id, role, hand }],
//   deck,
//   setAsideRoleCard,
//   board,
//   currentPlayerIndex
// }
const rooms = {};

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getRoleDeck(playerCount) {
    let saboteurs = 0, miners = 0;
    if (playerCount === 3) { saboteurs = 1; miners = 3; }
    else if (playerCount === 4) { saboteurs = 1; miners = 4; }
    else if (playerCount === 5) { saboteurs = 2; miners = 4; }
    else if (playerCount === 6) { saboteurs = 2; miners = 5; }
    else if (playerCount === 7) { saboteurs = 3; miners = 5; }
    else if (playerCount === 8) { saboteurs = 3; miners = 6; }
    else if (playerCount === 9) { saboteurs = 3; miners = 7; }
    else if (playerCount === 10) { saboteurs = 4; miners = 7; }
    else { return []; }
    
    const roleDeck = [];
    for (let i = 0; i < saboteurs; i++) roleDeck.push('Saboteur');
    for (let i = 0; i < miners; i++) roleDeck.push('Gold Miner');
    return shuffle(roleDeck); 
}

// 核心：定义卡牌的四个接口 [上, 右, 下, 左]。1代表通，0代表死路。
const pathTemplates = [
    { type: 'path', name: '╋', dirs: [1, 1, 1, 1] },
    { type: 'path', name: '┃', dirs: [1, 0, 1, 0] },
    { type: 'path', name: '━', dirs: [0, 1, 0, 1] },
    { type: 'path', name: '┳', dirs: [0, 1, 1, 1] },
    { type: 'path', name: '┻', dirs: [1, 1, 0, 1] },
    { type: 'path', name: '┣', dirs: [1, 1, 1, 0] },
    { type: 'path', name: '┫', dirs: [1, 0, 1, 1] },
    { type: 'path', name: '┏', dirs: [0, 1, 1, 0] },
    { type: 'path', name: '┓', dirs: [0, 0, 1, 1] },
    { type: 'path', name: '┗', dirs: [1, 1, 0, 0] },
    { type: 'path', name: '┛', dirs: [1, 0, 0, 1] }
];

function createRoom(roomId, hostSocketId) {
    rooms[roomId] = {
        hostId: hostSocketId,
        players: [],
        deck: [],
        setAsideRoleCard: null,
        board: {},
        currentPlayerIndex: 0
    };
}

function startGame(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    const players = room.players;
    const playerCount = players.length;
    if (playerCount < 3 || playerCount > 10) {
        io.to(roomId).emit('errorMsg', '需要 3-10 名玩家才能开始游戏！');
        return;
    }

    const roleDeck = getRoleDeck(playerCount);
    players.forEach(player => { player.role = roleDeck.pop(); player.hand = []; });
    room.setAsideRoleCard = roleDeck.pop();

    room.board = {};
    // 起点卡四个方向都通
    room.board['0,0'] = { type: 'start', name: '梯', dirs: [1,1,1,1], faceUp: true };
    
    let goals = [
        { type: 'goal', faceUp: false, isTreasure: true, name: '终点' },
        { type: 'goal', faceUp: false, isTreasure: false, name: '终点' },
        { type: 'goal', faceUp: false, isTreasure: false, name: '终点' }
    ];
    goals = shuffle(goals);
    room.board['8,-2'] = goals[0]; room.board['8,0'] = goals[1]; room.board['8,2'] = goals[2];

    room.deck = [];
    // 随机生成 40 张具体的带形状的路线卡
    for (let i = 0; i < 40; i++) {
        let tmpl = pathTemplates[Math.floor(Math.random() * pathTemplates.length)];
        room.deck.push({ ...tmpl, id: `path_${i}` });
    }
    // 生成 27 张行动卡 (用锤子表情代替)
    for (let i = 0; i < 27; i++) {
        room.deck.push({ type: 'action', name: '行动', id: `action_${i}` });
    }
    room.deck = shuffle(room.deck);

    let cardsPerPlayer = (playerCount >= 3 && playerCount <= 5) ? 6 : (playerCount >= 6 && playerCount <= 7) ? 5 : 4;
    for (let i = 0; i < cardsPerPlayer; i++) {
        players.forEach(player => { if (room.deck.length > 0) player.hand.push(room.deck.pop()); });
    }

    players.forEach(player => {
        io.to(player.id).emit('gameStarted', { yourRole: player.role, yourHand: player.hand, board: room.board });
    });

    room.currentPlayerIndex = 0;
    io.to(roomId).emit('turnUpdated', { currentTurnId: players[room.currentPlayerIndex].id });
}

io.on('connection', (socket) => {
    socket.on('createRoom', () => {
        let roomId;
        do {
            roomId = Math.floor(1000 + Math.random() * 9000).toString();
        } while (rooms[roomId]);

        createRoom(roomId, socket.id);
        const room = rooms[roomId];
        room.players.push({ id: socket.id, role: null, hand: [] });
        socket.join(roomId);

        io.to(roomId).emit('playerJoined', { playerCount: room.players.length });
        socket.emit('roomJoined', { roomId, isHost: true });
    });

    socket.on('joinRoom', (data) => {
        const { roomId } = data || {};
        const room = rooms[roomId];
        if (!room) {
            socket.emit('errorMsg', '房间不存在！');
            return;
        }
        room.players.push({ id: socket.id, role: null, hand: [] });
        socket.join(roomId);
        io.to(roomId).emit('playerJoined', { playerCount: room.players.length });
        socket.emit('roomJoined', { roomId, isHost: false });
    });

    socket.on('requestStartGame', (data) => {
        const { roomId } = data || {};
        const room = rooms[roomId];
        if (!room) return;
        if (socket.id !== room.hostId) {
            socket.emit('errorMsg', '只有房主可以开始游戏！');
            return;
        }
        startGame(roomId);
    });

    socket.on('playCard', (data) => {
        const { roomId, card, targetX, targetY } = data || {};
        const room = rooms[roomId];
        if (!room) return;

        const players = room.players;
        const playerIndex = players.findIndex(p => p.id === socket.id);
        const player = players[playerIndex];

        if (playerIndex === -1) {
            socket.emit('errorMsg', '你不在这个房间中！');
            return;
        }

        if (playerIndex !== room.currentPlayerIndex) { socket.emit('errorMsg', '还没轮到你出牌！'); return; }
        const coord = `${targetX},${targetY}`;

        if (card.type === 'action') { socket.emit('errorMsg', '行动卡不能铺在桌面上！'); return; }
        if (room.board[coord]) { socket.emit('errorMsg', '位置被占用了！'); return; }

        // --- 核心：连通性判定算法 ---
        const targetDirs = card.dirs; // 新卡的四个接口 [上, 右, 下, 左]
        const neighbors = {
            top: room.board[`${targetX},${targetY - 1}`],
            right: room.board[`${targetX + 1},${targetY}`],
            bottom: room.board[`${targetX},${targetY + 1}`],
            left: room.board[`${targetX - 1},${targetY}`]
        };

        let hasNeighbor = false;
        let validMatch = true;
        let connectToPath = false;

        // 检查上方邻居 (它的下接口 dirs[2] 必须和我的上接口 dirs[0] 匹配)
        if (neighbors.top && neighbors.top.dirs) {
            hasNeighbor = true;
            if (neighbors.top.dirs[2] !== targetDirs[0]) validMatch = false;
            if (neighbors.top.dirs[2] === 1 && targetDirs[0] === 1) connectToPath = true;
        }
        // 检查右侧邻居 (它的左接口 dirs[3] 必须和我的右接口 dirs[1] 匹配)
        if (neighbors.right && neighbors.right.dirs) {
            hasNeighbor = true;
            if (neighbors.right.dirs[3] !== targetDirs[1]) validMatch = false;
            if (neighbors.right.dirs[3] === 1 && targetDirs[1] === 1) connectToPath = true;
        }
        // 检查下方邻居 (它的上接口 dirs[0] 必须和我的下接口 dirs[2] 匹配)
        if (neighbors.bottom && neighbors.bottom.dirs) {
            hasNeighbor = true;
            if (neighbors.bottom.dirs[0] !== targetDirs[2]) validMatch = false;
            if (neighbors.bottom.dirs[0] === 1 && targetDirs[2] === 1) connectToPath = true;
        }
        // 检查左侧邻居 (它的右接口 dirs[1] 必须和我的左接口 dirs[3] 匹配)
        if (neighbors.left && neighbors.left.dirs) {
            hasNeighbor = true;
            if (neighbors.left.dirs[1] !== targetDirs[3]) validMatch = false;
            if (neighbors.left.dirs[1] === 1 && targetDirs[3] === 1) connectToPath = true;
        }

        if (!hasNeighbor) { socket.emit('errorMsg', '违章建筑！必须挨着已有的卡牌放！'); return; }
        if (!validMatch) { socket.emit('errorMsg', '放不进去！管道接口对不上！'); return; }
        if (!connectToPath) { socket.emit('errorMsg', '死路！你必须至少连接一条现有的通路！'); return; }

        // 校验通过，放牌！
        room.board[coord] = { type: card.type, name: card.name, dirs: card.dirs, faceUp: true };
        player.hand = player.hand.filter(c => c.id !== card.id);
        if (room.deck.length > 0) player.hand.push(room.deck.pop());

        // --- 👇 新增：检查是否挖到了终点 👇 ---
        let gameEnded = false;
        // 辅助函数：检查放置新牌后，四周有没有碰到终点卡
        const checkGoal = (nx, ny, myDirIndex) => {
            const gCoord = `${nx},${ny}`;
            const gCard = room.board[gCoord];
            // 如果碰到了还没翻开的终点卡，并且我的管道口是通向它的 (1代表通)
            if (gCard && gCard.type === 'goal' && !gCard.faceUp && card.dirs[myDirIndex] === 1) {
                gCard.faceUp = true; // 翻开终点卡
                if (gCard.isTreasure) {
                    gCard.name = '💎'; // 变成钻石/金块图标
                    io.to(roomId).emit('gameOver', { winners: 'Gold Miner', msg: '🎉 恭喜！挖到了宝藏！【淘金者】阵营获胜！' });
                    gameEnded = true;
                } else {
                    gCard.name = '🪨'; // 变成石头图标
                    io.to(roomId).emit('gameMsg', '哎呀，挖开是个石头！继续找！');
                }
            }
        };

        checkGoal(targetX, targetY - 1, 0); // 检查上方
        checkGoal(targetX + 1, targetY, 1); // 检查右侧
        checkGoal(targetX, targetY + 1, 2); // 检查下方
        checkGoal(targetX - 1, targetY, 3); // 检查左侧
        // --- 👆 终点检查结束 👆 ---

        // 检查是不是所有人都没牌了 (牌堆抽空 + 手牌打光 = 破坏者赢)
        const allHandsEmpty = players.every(p => p.hand.length === 0);
        if (allHandsEmpty && !gameEnded) {
            io.to(roomId).emit('gameOver', { winners: 'Saboteur', msg: '😈 所有牌已耗尽，未能挖到宝藏！【破坏者】阵营获胜！' });
            gameEnded = true;
        }

        // 如果游戏还没结束，才切换回合
        if (!gameEnded) {
            room.currentPlayerIndex = (room.currentPlayerIndex + 1) % players.length;
            io.to(roomId).emit('turnUpdated', { currentTurnId: players[room.currentPlayerIndex].id });
        }

        io.to(roomId).emit('boardUpdated', room.board);
        socket.emit('handUpdated', { yourHand: player.hand });
    });

    socket.on('discardCard', (data) => {
        const { roomId, card } = data || {};
        const room = rooms[roomId];
        if (!room) return;

        const players = room.players;
        const playerIndex = players.findIndex(p => p.id === socket.id);
        const player = players[playerIndex];
        if (playerIndex === -1) {
            socket.emit('errorMsg', '你不在这个房间中！');
            return;
        }
        if (playerIndex !== room.currentPlayerIndex) { socket.emit('errorMsg', '还没轮到你！'); return; }

        player.hand = player.hand.filter(c => c.id !== card.id);
        if (room.deck.length > 0) player.hand.push(room.deck.pop());

        // --- 新增：弃牌后也要检查是不是所有人手牌耗尽 ---
        const allHandsEmpty = players.every(p => p.hand.length === 0);
        if (allHandsEmpty) {
            io.to(roomId).emit('gameOver', { winners: 'Saboteur', msg: '😈 所有牌已耗尽，未能挖到宝藏！【破坏者】阵营获胜！' });
            socket.emit('handUpdated', { yourHand: player.hand });
            return;
        }

        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % players.length;
        io.to(roomId).emit('turnUpdated', { currentTurnId: players[room.currentPlayerIndex].id });
        socket.emit('handUpdated', { yourHand: player.hand });
    });

    socket.on('disconnect', () => {
        // 简化：断线暂时直接移出房间
        for (const [roomId, room] of Object.entries(rooms)) {
            const idx = room.players.findIndex(p => p.id === socket.id);
            if (idx !== -1) {
                room.players.splice(idx, 1);
                io.to(roomId).emit('playerLeft', { playerCount: room.players.length });
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`服务器启动: ${PORT}`));