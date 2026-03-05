const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } // 允许所有前端跨域连接，方便测试
});
app.use(express.static('public'));

// 游戏全局状态
let players = []; // 存储加入的玩家 { id, role, hand: [] }
let deck = [];    // 抽牌堆
let setAsideRoleCard = null; // 每局必须扣除的一张身份牌

// 辅助函数：洗牌算法 (Fisher-Yates)
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 核心逻辑 1：根据人数生成身份牌堆
function getRoleDeck(playerCount) {
    let saboteurs = 0;
    let miners = 0;

    // 严格按照规则说明书分配身份 [cite: 20, 21, 22]
    if (playerCount === 3) { saboteurs = 1; miners = 3; }
    else if (playerCount === 4) { saboteurs = 1; miners = 4; }
    else if (playerCount === 5) { saboteurs = 2; miners = 4; }
    else if (playerCount === 6) { saboteurs = 2; miners = 5; }
    else if (playerCount === 7) { saboteurs = 3; miners = 5; }
    else if (playerCount === 8) { saboteurs = 3; miners = 6; }
    else if (playerCount === 9) { saboteurs = 3; miners = 7; }
    else if (playerCount === 10) { saboteurs = 4; miners = 7; }
    else { return []; } // 不支持的人数

    const roleDeck = [];
    for (let i = 0; i < saboteurs; i++) roleDeck.push('Saboteur');
    for (let i = 0; i < miners; i++) roleDeck.push('Gold Miner');
    
    return shuffle(roleDeck); // 洗混身份牌 [cite: 23]
}

// 核心逻辑 2：初始化游戏与发牌
function startGame() {
    const playerCount = players.length;
    if (playerCount < 3 || playerCount > 10) {
        console.log("人数必须在 3 到 10 人之间");
        return;
    }

    console.log(`游戏开始！当前人数：${playerCount}`);

    // 1. 分配身份
    const roleDeck = getRoleDeck(playerCount);
    players.forEach(player => {
        player.role = roleDeck.pop(); // 每人发一张身份牌 [cite: 24]
        player.hand = []; // 清空手牌
    });
    setAsideRoleCard = roleDeck.pop(); // 剩下一张身份牌扣置一旁 [cite: 25]

    // 2. 构建游戏卡牌堆 (40张路线卡 + 27张行动卡) [cite: 38]
    deck = [];
    // (这里暂时用简单的字符串代替复杂的卡牌对象，后续我们会换成具体的路线/行动对象)
    for (let i = 0; i < 40; i++) deck.push({ type: 'path', id: `path_${i}` });
    for (let i = 0; i < 27; i++) deck.push({ type: 'action', id: `action_${i}` });
    deck = shuffle(deck); // 洗混抽牌堆 [cite: 38]

    // 3. 根据人数决定初始手牌数量
    let cardsPerPlayer = 0;
    if (playerCount >= 3 && playerCount <= 5) cardsPerPlayer = 6; // 3-5人发6张 [cite: 40]
    else if (playerCount >= 6 && playerCount <= 7) cardsPerPlayer = 5; // 6-7人发5张 [cite: 40]
    else if (playerCount >= 8 && playerCount <= 10) cardsPerPlayer = 4; // 8-10人发4张 [cite: 41]

    // 4. 发放手牌 [cite: 39]
    for (let i = 0; i < cardsPerPlayer; i++) {
        players.forEach(player => {
            if (deck.length > 0) {
                player.hand.push(deck.pop());
            }
        });
    }

    // 5. 将结果发送给每个玩家 (隐藏别人的身份)
    players.forEach(player => {
        io.to(player.id).emit('gameStarted', {
            yourRole: player.role,
            yourHand: player.hand,
            playersCount: playerCount
        });
    });
    
    console.log("发牌完毕！");
}

// Socket.io 客户端连接逻辑
io.on('connection', (socket) => {
    console.log(`玩家已连接: ${socket.id}`);
    
    // 玩家加入房间
    players.push({ id: socket.id, role: null, hand: [] });
    io.emit('playerJoined', { playerCount: players.length }); // 广播当前人数

    // 监听前端发来的“开始游戏”指令
    socket.on('requestStartGame', () => {
        startGame();
    });

    // 玩家断开连接
    socket.on('disconnect', () => {
        console.log(`玩家已离开: ${socket.id}`);
        players = players.filter(p => p.id !== socket.id);
        io.emit('playerLeft', { playerCount: players.length });
    });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`矮人矿坑服务器已启动，监听端口: ${PORT}`);
});