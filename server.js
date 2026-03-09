const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PUBLIC_DIR = path.join(__dirname, 'public');
const CLIENT_DIST_DIR = path.join(__dirname, 'frontend', 'dist');
const CLIENT_INDEX_FILE = path.join(CLIENT_DIST_DIR, 'index.html');
const usersByUsername = {};
const usersByToken = {};

function hasClientBuild() {
    return fs.existsSync(CLIENT_INDEX_FILE);
}

function sendClientApp(res) {
    if (!hasClientBuild()) {
        res.status(503).send('Frontend build is missing. Run `npm run build` before starting the server.');
        return;
    }
    res.sendFile(CLIENT_INDEX_FILE);
}

app.use(express.json());

app.use(express.static(CLIENT_DIST_DIR));
app.use('/legacy', express.static(PUBLIC_DIR));

app.get('/', (_req, res) => {
    sendClientApp(res);
});

app.get('/healthz', (_req, res) => {
    if (!hasClientBuild()) {
        res.status(500).send('frontend build missing');
        return;
    }
    res.status(200).send('ok');
});

app.post('/api/register', (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();
    const nickname = String(req.body?.nickname || '').trim();

    if (!username || !password || !nickname) {
        return res.status(400).json({ error: '请填写完整信息' });
    }
    if (usersByUsername[username]) {
        return res.status(400).json({ error: '账号已存在' });
    }

    usersByUsername[username] = {
        id: crypto.randomUUID(),
        username,
        password,
        nickname
    };

    return res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '').trim();
    const user = usersByUsername[username];

    if (!user || user.password !== password) {
        return res.status(401).json({ error: '账号或密码错误' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    usersByToken[token] = {
        id: user.id,
        username: user.username,
        nickname: user.nickname
    };

    return res.json({
        token,
        user: usersByToken[token]
    });
});

app.get(/^(?!\/socket\.io\/|\/healthz$|\/api\/).*/, (_req, res) => {
    sendClientApp(res);
});

// 多房间结构：每个房间都有自己的一套状态
// rooms[roomId] = {
//   hostId,
//   players: [{ id, playerKey, name, role, hand, tools, disconnected }],
//   deck,
//   setAsideRoleCard,
//   board,
//   currentPlayerIndex,
//   round,
//   scores: { [playerKey]: number }
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
// 这里用 11 类基础形状，下面再配置发牌时的数量分布，总数 = 40。
const pathTemplates = [
    { type: 'path', name: '╋', dirs: [1, 1, 1, 1] }, // 十字
    { type: 'path', name: '┃', dirs: [1, 0, 1, 0] }, // 竖直
    { type: 'path', name: '━', dirs: [0, 1, 0, 1] }, // 水平
    { type: 'path', name: '┳', dirs: [0, 1, 1, 1] }, // T 型缺上
    { type: 'path', name: '┻', dirs: [1, 1, 0, 1] }, // T 型缺下
    { type: 'path', name: '┣', dirs: [1, 1, 1, 0] }, // T 型缺左
    { type: 'path', name: '┫', dirs: [1, 0, 1, 1] }, // T 型缺右
    { type: 'path', name: '┏', dirs: [0, 1, 1, 0] }, // 拐角
    { type: 'path', name: '┓', dirs: [0, 0, 1, 1] }, // 拐角
    { type: 'path', name: '┗', dirs: [1, 1, 0, 0] }, // 拐角
    { type: 'path', name: '┛', dirs: [1, 0, 0, 1] }  // 拐角
];
// 更精细的道路牌数量分布（总和 40），近似贴近实体卡的组合：
// 索引与上面的 pathTemplates 一一对应。
const pathDeckCounts = [
    3, // ╋  三通/十字类
    5, // ┃  直线
    5, // ━  直线
    4, // ┳  T
    4, // ┻  T
    4, // ┣  T
    4, // ┫  T
    3, // ┏  拐角
    3, // ┓  拐角
    3, // ┗  拐角
    2  // ┛  拐角
]; // 3+5+5+4+4+4+4+3+3+3+2 = 40

function createRoom(roomId, hostSocketId) {
    rooms[roomId] = {
        hostId: hostSocketId,
        players: [],
        deck: [],
        setAsideRoleCard: null,
        board: {},
        currentPlayerIndex: 0,
        round: 1,
        scores: {}
    };
}

const toolNames = { cart: '矿车', lantern: '油灯', pickaxe: '镐子' };

function broadcastRoomPlayers(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    const currentTurnId = room.players[room.currentPlayerIndex]?.id || null;
    io.to(roomId).emit('roomPlayers', {
        players: room.players.map(p => ({
            id: p.id,
            playerKey: p.playerKey,
            name: p.name || '',
            role: p.role || null,
            tools: p.tools || { cart: true, lantern: true, pickaxe: true },
            disconnected: !!p.disconnected,
            isCurrentTurn: currentTurnId && p.id === currentTurnId
        }))
    });
}

function ensureScoreEntries(room) {
    if (!room.scores) room.scores = {};
    room.players.forEach(p => {
        if (room.scores[p.playerKey] == null) {
            room.scores[p.playerKey] = 0;
        }
    });
}

function finishRound(roomId, winners, msg, connectorPlayerId) {
    const room = rooms[roomId];
    if (!room) return;

    ensureScoreEntries(room);

    const miners = room.players.filter(p => p.role === 'Gold Miner');
    const saboteurs = room.players.filter(p => p.role === 'Saboteur');
    const scoreDelta = {};

    if (winners === 'Gold Miner') {
        // 简化版：每个好矮人随机获得 1-3 金块
        miners.forEach(p => {
            const gain = 1 + Math.floor(Math.random() * 3);
            room.scores[p.playerKey] += gain;
            scoreDelta[p.playerKey] = gain;
        });
    } else if (winners === 'Saboteur') {
        // 按官方规则的总金块数：1/2~3/>=4 个坏矮人
        const sabCount = saboteurs.length;
        let gain = 0;
        if (sabCount === 1) gain = 4;
        else if (sabCount === 2 || sabCount === 3) gain = 3;
        else if (sabCount >= 4) gain = 2;
        saboteurs.forEach(p => {
            room.scores[p.playerKey] += gain;
            scoreDelta[p.playerKey] = gain;
        });
    }

    const payload = {
        round: room.round,
        winners,
        msg,
        scores: room.scores,
        delta: scoreDelta,
        players: room.players.map(p => ({
            playerKey: p.playerKey,
            name: p.name || '',
            role: p.role,
            disconnected: !!p.disconnected
        }))
    };

    if (room.round < 3) {
        io.to(roomId).emit('roundOver', payload);
        room.round += 1;
        // 开启下一轮：重置牌堆与身份
        startGame(roomId);
    } else {
        // 第 3 轮结束，整局游戏结束
        io.to(roomId).emit('finalGameOver', payload);
    }
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
    players.forEach(player => {
        player.role = roleDeck.pop();
        player.hand = [];
        player.tools = { cart: true, lantern: true, pickaxe: true };
    });
    room.setAsideRoleCard = roleDeck.pop();

    room.board = {};
    // 起点卡四个方向都通
    room.board['0,0'] = { type: 'start', name: '梯', dirs: [1, 1, 1, 1], faceUp: true };

    let goals = [
        { type: 'goal', faceUp: false, isTreasure: true, name: '终点' },
        { type: 'goal', faceUp: false, isTreasure: false, name: '终点' },
        { type: 'goal', faceUp: false, isTreasure: false, name: '终点' }
    ];
    goals = shuffle(goals);
    room.board['8,-2'] = goals[0]; room.board['8,0'] = goals[1]; room.board['8,2'] = goals[2];

    room.deck = [];
    // 普通道路卡：按预设数量分布精确生成 40 张
    let pathId = 0;
    pathTemplates.forEach((tmpl, idx) => {
        const count = pathDeckCounts[idx] || 0;
        for (let i = 0; i < count; i++) {
            room.deck.push({ ...tmpl, id: `path_${pathId++}` });
        }
    });
    // 行动卡：按官方 27 张规格生成
    let actionId = 0;
    const pushAction = (card) => room.deck.push({ ...card, id: `action_${actionId++}` });

    // A. 破坏牌 Sabotage（9）- 矿车/油灯/镐子 各 3
    ['cart', 'lantern', 'pickaxe'].forEach(tool => {
        for (let i = 0; i < 3; i++) {
            pushAction({ type: 'action', subType: 'sabotage', tool, name: `破坏${tool}` });
        }
    });

    // B1. 单工具修复（3）- 各 1
    ['cart', 'lantern', 'pickaxe'].forEach(tool => {
        pushAction({ type: 'action', subType: 'repair', tools: [tool], name: `修理${tool}` });
    });

    // B2. 双工具修复（6）- 每个组合 2
    const pairs = [
        ['cart', 'lantern'],
        ['cart', 'pickaxe'],
        ['lantern', 'pickaxe']
    ];
    pairs.forEach(tools => {
        for (let i = 0; i < 2; i++) {
            pushAction({ type: 'action', subType: 'repair', tools, name: `修理${tools.join('/')}` });
        }
    });

    // C. 地图牌 Map（6）
    for (let i = 0; i < 6; i++) {
        pushAction({ type: 'action', subType: 'map', name: '地图' });
    }

    // D. 落石牌 Rockfall（3）
    for (let i = 0; i < 3; i++) {
        pushAction({ type: 'action', subType: 'rockfall', name: '落石' });
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
    socket.on('authenticate', (token) => {
        const user = usersByToken[String(token || '')];
        if (!user) {
            socket.emit('authenticated', { success: false, error: '登录已失效，请重新登录' });
            return;
        }
        socket.data.user = user;
        socket.emit('authenticated', { success: true, user });
    });

    // 断线重连：客户端会在连接后自动发送本地保存的 playerKey/roomId
    socket.on('reconnectPlayer', (data) => {
        const { roomId, playerKey } = data || {};
        const room = rooms[roomId];
        if (!room) {
            socket.emit('errorMsg', '房间不存在或已被清理，无法重连。');
            return;
        }
        const player = room.players.find(p => p.playerKey === playerKey);
        if (!player) {
            socket.emit('errorMsg', '未找到可重连的玩家位置。');
            return;
        }
        // 更新 socket id 并标记在线
        player.id = socket.id;
        player.disconnected = false;
        socket.join(roomId);

        // 把当前房间状态同步给该玩家
        ensureScoreEntries(room);
        socket.emit('reconnectedState', {
            roomId,
            yourRole: player.role,
            yourName: player.name || '',
            yourHand: player.hand,
            board: room.board,
            round: room.round,
            scores: room.scores,
            currentTurnId: room.players[room.currentPlayerIndex]?.id || null
        });
        io.to(roomId).emit('playerJoined', { playerCount: room.players.filter(p => !p.disconnected).length });
        broadcastRoomPlayers(roomId);
    });

    socket.on('createRoom', (data) => {
        const name = (data && data.name && String(data.name).trim()) || '玩家';
        let roomId;
        do {
            roomId = Math.floor(1000 + Math.random() * 9000).toString();
        } while (rooms[roomId]);

        createRoom(roomId, socket.id);
        const room = rooms[roomId];
        const playerKey = Math.random().toString(36).slice(2, 10);
        room.players.push({
            id: socket.id,
            playerKey,
            name,
            role: null,
            hand: [],
            tools: { cart: true, lantern: true, pickaxe: true },
            disconnected: false
        });
        socket.join(roomId);

        io.to(roomId).emit('playerJoined', { playerCount: room.players.length });
        broadcastRoomPlayers(roomId);
        socket.emit('roomJoined', { roomId, isHost: true, playerKey });
    });

    socket.on('joinRoom', (data) => {
        const { roomId } = data || {};
        const name = (data && data.name && String(data.name).trim()) || '玩家';
        const room = rooms[roomId];
        if (!room) {
            socket.emit('errorMsg', '房间不存在！');
            return;
        }
        const playerKey = Math.random().toString(36).slice(2, 10);
        room.players.push({
            id: socket.id,
            playerKey,
            name,
            role: null,
            hand: [],
            tools: { cart: true, lantern: true, pickaxe: true },
            disconnected: false
        });
        socket.join(roomId);
        io.to(roomId).emit('playerJoined', { playerCount: room.players.length });
        broadcastRoomPlayers(roomId);
        socket.emit('roomJoined', { roomId, isHost: false, playerKey });
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

    // 修改名字
    socket.on('changeName', (data) => {
        const { roomId, newName } = data || {};
        const room = rooms[roomId];
        if (!room) return;
        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;
        player.name = String(newName || '玩家').trim().slice(0, 20);
        broadcastRoomPlayers(roomId);
        socket.emit('nameChanged', { name: player.name });
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

        // 行动牌处理
        if (card.type === 'action') {
            const { subType } = card;
            // 所有行动牌使用后都弃掉并抽新牌，然后换下一位
            if (subType === 'sabotage' || subType === 'repair') {
                const { targetPlayerId } = data || {};
                if (!targetPlayerId) {
                    socket.emit('errorMsg', '请先选择一个目标玩家！');
                    return;
                }
                const target = players.find(p => p.id === targetPlayerId);
                if (!target) {
                    socket.emit('errorMsg', '目标玩家不存在！');
                    return;
                }
                if (!target.tools) target.tools = { cart: true, lantern: true, pickaxe: true };

                if (subType === 'sabotage') {
                    const tool = card.tool;
                    if (!tool) {
                        socket.emit('errorMsg', '这张破坏牌数据有误。');
                        return;
                    }
                    target.tools[tool] = false;
                    io.to(roomId).emit('gameMsg', `玩家 ${target.name || target.id} 的 ${toolNames[tool] || tool} 被破坏了！`);
                    broadcastRoomPlayers(roomId);
                } else if (subType === 'repair') {
                    const tools = card.tools || [];
                    let repaired = false;
                    for (const t of tools) {
                        if (target.tools[t] === false) {
                            target.tools[t] = true;
                            repaired = true;
                            io.to(roomId).emit('gameMsg', `玩家 ${target.name || target.id} 的 ${toolNames[t] || t} 被修好了！`);
                            break;
                        }
                    }
                    if (!repaired) {
                        socket.emit('errorMsg', '目标玩家对应的工具没有损坏，修理失败。');
                        return;
                    }
                    broadcastRoomPlayers(roomId);
                }
            } else if (subType === 'map') {
                const coord = `${targetX},${targetY}`;
                const gCard = room.board[coord];
                if (!gCard || gCard.type !== 'goal') {
                    socket.emit('errorMsg', '地图只能用于查看终点卡！');
                    return;
                } else {
                    socket.emit('mapResult', { coord, isTreasure: !!gCard.isTreasure });
                }
            } else if (subType === 'rockfall') {
                const coord = `${targetX},${targetY}`;
                const bCard = room.board[coord];
                if (!bCard || bCard.type === 'start' || bCard.type === 'goal') {
                    socket.emit('errorMsg', '落石只能移除普通道路牌，不能移除起点或终点！');
                    return;
                } else {
                    delete room.board[coord];
                    io.to(roomId).emit('boardUpdated', room.board);
                    io.to(roomId).emit('gameMsg', `一张道路牌在 ${coord} 被落石摧毁了！`);
                }
            }

            // 行动牌从手牌中移除并抽一张新牌
            player.hand = player.hand.filter(c => c.id !== card.id);
            if (room.deck.length > 0) player.hand.push(room.deck.pop());
            socket.emit('handUpdated', { yourHand: player.hand });

            // 行动牌使用后直接轮到下一位
            room.currentPlayerIndex = (room.currentPlayerIndex + 1) % players.length;
            io.to(roomId).emit('turnUpdated', { currentTurnId: players[room.currentPlayerIndex].id });
            return;
        }

        // 下面是道路牌逻辑
        const coord = `${targetX},${targetY}`;

        // 工具被破坏时不能铺路
        if (player.tools && (player.tools.cart === false || player.tools.lantern === false || player.tools.pickaxe === false)) {
            socket.emit('errorMsg', '你的工具被破坏了，暂时不能铺路！');
            return;
        }
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
        room.board[coord] = { type: card.type, name: card.name, dirs: card.dirs, rotation: card.rotation || 0, faceUp: true };
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
                    gameEnded = true;
                    finishRound(roomId, 'Gold Miner', '🎉 恭喜！挖到了宝藏！【淘金者】阵营获胜！', socket.id);
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
            gameEnded = true;
            finishRound(roomId, 'Saboteur', '😈 所有牌已耗尽，未能挖到宝藏！【破坏者】阵营获胜！');
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
            finishRound(roomId, 'Saboteur', '😈 所有牌已耗尽，未能挖到宝藏！【破坏者】阵营获胜！');
            socket.emit('handUpdated', { yourHand: player.hand });
            return;
        }

        room.currentPlayerIndex = (room.currentPlayerIndex + 1) % players.length;
        io.to(roomId).emit('turnUpdated', { currentTurnId: players[room.currentPlayerIndex].id });
        socket.emit('handUpdated', { yourHand: player.hand });
    });

    socket.on('disconnect', () => {
        // 标记玩家断线，但保留其位置和分数，便于重连
        for (const [roomId, room] of Object.entries(rooms)) {
            const player = room.players.find(p => p.id === socket.id);
            if (player) {
                player.disconnected = true;
                io.to(roomId).emit('playerLeft', { playerCount: room.players.filter(p => !p.disconnected).length });
                broadcastRoomPlayers(roomId);
                break;
            }
        }
    });
    // 聊天消息
    socket.on('chatMessage', (data) => {
        const { roomId, message } = data || {};
        const room = rooms[roomId];
        if (!room || !message) return;
        const player = room.players.find(p => p.id === socket.id);
        const name = (player && player.name) || '匿名';
        io.to(roomId).emit('chatMessage', {
            name,
            message: String(message).slice(0, 200),
            time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        });
    });

    // 语音状态广播：通知房间内所有人某玩家已开启语音
    socket.on('voice-enabled', (data) => {
        const { roomId } = data || {};
        if (!roomId) return;
        socket.to(roomId).emit('voice-enabled', { from: socket.id });
    });

    // 语音信令转发（WebRTC）
    socket.on('voice-offer', (data) => {
        const { targetId, offer } = data || {};
        if (!targetId || !offer) return;
        io.to(targetId).emit('voice-offer', { from: socket.id, offer });
    });

    socket.on('voice-answer', (data) => {
        const { targetId, answer } = data || {};
        if (!targetId || !answer) return;
        io.to(targetId).emit('voice-answer', { from: socket.id, answer });
    });

    socket.on('voice-ice-candidate', (data) => {
        const { targetId, candidate } = data || {};
        if (!targetId || !candidate) return;
        io.to(targetId).emit('voice-ice-candidate', { from: socket.id, candidate });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`服务器启动: ${PORT}`));
