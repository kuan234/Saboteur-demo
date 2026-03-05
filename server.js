let currentPlayerIndex = 0;
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

let players = []; 
let deck = [];    
let setAsideRoleCard = null;
let board = {}; 

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

function startGame() {
    const playerCount = players.length;
    if (playerCount < 3 || playerCount > 10) return;

    const roleDeck = getRoleDeck(playerCount);
    players.forEach(player => { player.role = roleDeck.pop(); player.hand = []; });
    setAsideRoleCard = roleDeck.pop();

    board = {};
    // 起点卡四个方向都通
    board['0,0'] = { type: 'start', name: '梯', dirs: [1,1,1,1], faceUp: true };
    
    let goals = [
        { type: 'goal', faceUp: false, isTreasure: true, name: '终点' },
        { type: 'goal', faceUp: false, isTreasure: false, name: '终点' },
        { type: 'goal', faceUp: false, isTreasure: false, name: '终点' }
    ];
    goals = shuffle(goals);
    board['8,-2'] = goals[0]; board['8,0'] = goals[1]; board['8,2'] = goals[2];

    deck = [];
    // 随机生成 40 张具体的带形状的路线卡
    for (let i = 0; i < 40; i++) {
        let tmpl = pathTemplates[Math.floor(Math.random() * pathTemplates.length)];
        deck.push({ ...tmpl, id: `path_${i}` });
    }
    // 生成 27 张行动卡 (用锤子表情代替)
    for (let i = 0; i < 27; i++) {
        deck.push({ type: 'action', name: '🔨行动', id: `action_${i}` });
    }
    deck = shuffle(deck);

    let cardsPerPlayer = (playerCount >= 3 && playerCount <= 5) ? 6 : (playerCount >= 6 && playerCount <= 7) ? 5 : 4;
    for (let i = 0; i < cardsPerPlayer; i++) {
        players.forEach(player => { if (deck.length > 0) player.hand.push(deck.pop()); });
    }

    players.forEach(player => {
        io.to(player.id).emit('gameStarted', { yourRole: player.role, yourHand: player.hand, board: board });
    });

    currentPlayerIndex = 0;
    io.emit('turnUpdated', { currentTurnId: players[currentPlayerIndex].id });
}

io.on('connection', (socket) => {
    players.push({ id: socket.id, role: null, hand: [] });
    io.emit('playerJoined', { playerCount: players.length });

    socket.on('requestStartGame', () => startGame());

    socket.on('playCard', (data) => {
        const playerIndex = players.findIndex(p => p.id === socket.id);
        const player = players[playerIndex];

        if (playerIndex !== currentPlayerIndex) { socket.emit('errorMsg', '还没轮到你出牌！'); return; }

        const { card, targetX, targetY } = data;
        const coord = `${targetX},${targetY}`;

        if (card.type === 'action') { socket.emit('errorMsg', '行动卡不能铺在桌面上！'); return; }
        if (board[coord]) { socket.emit('errorMsg', '位置被占用了！'); return; }

        // --- 核心：连通性判定算法 ---
        const targetDirs = card.dirs; // 新卡的四个接口 [上, 右, 下, 左]
        const neighbors = {
            top: board[`${targetX},${targetY - 1}`],
            right: board[`${targetX + 1},${targetY}`],
            bottom: board[`${targetX},${targetY + 1}`],
            left: board[`${targetX - 1},${targetY}`]
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
        board[coord] = { type: card.type, name: card.name, dirs: card.dirs, faceUp: true };
        player.hand = player.hand.filter(c => c.id !== card.id);
        if (deck.length > 0) player.hand.push(deck.pop());
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;

        io.emit('boardUpdated', board);
        io.emit('turnUpdated', { currentTurnId: players[currentPlayerIndex].id });
        socket.emit('handUpdated', { yourHand: player.hand });
    });

    socket.on('discardCard', (data) => {
        const playerIndex = players.findIndex(p => p.id === socket.id);
        const player = players[playerIndex];
        if (playerIndex !== currentPlayerIndex) { socket.emit('errorMsg', '还没轮到你！'); return; }

        player.hand = player.hand.filter(c => c.id !== data.card.id);
        if (deck.length > 0) player.hand.push(deck.pop());
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;

        io.emit('turnUpdated', { currentTurnId: players[currentPlayerIndex].id });
        socket.emit('handUpdated', { yourHand: player.hand });
    });

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('playerLeft', { playerCount: players.length });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`服务器启动: ${PORT}`));