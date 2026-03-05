let currentPlayerIndex = 0; // 记录现在轮到第几个玩家出牌
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
let board = {}; // 存储桌上的卡牌，格式 { 'x,y': cardData }

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

function startGame() {
    const playerCount = players.length;
    if (playerCount < 3 || playerCount > 10) return;

    // 1. 发身份
    const roleDeck = getRoleDeck(playerCount);
    players.forEach(player => {
        player.role = roleDeck.pop();
        player.hand = [];
    });
    setAsideRoleCard = roleDeck.pop();

    // 2. 初始化桌面地图 (起点和3个终点)
    board = {};
    board['0,0'] = { type: 'start', faceUp: true, name: '起点' };
    
    // 准备终点卡：1个宝藏，2个石头
    let goals = [
        { type: 'goal', faceUp: false, isTreasure: true, name: '终点(隐藏)' },
        { type: 'goal', faceUp: false, isTreasure: false, name: '终点(隐藏)' },
        { type: 'goal', faceUp: false, isTreasure: false, name: '终点(隐藏)' }
    ];
    goals = shuffle(goals);
    
    // 根据规则，距离起点7个卡牌宽度放置终点，上下各隔开一张卡的距离
    board['8,-2'] = goals[0];
    board['8,0'] = goals[1];
    board['8,2'] = goals[2];

    // 3. 生成手牌并洗牌
    deck = [];
    for (let i = 0; i < 40; i++) deck.push({ type: 'path', id: `道路_${i}` });
    for (let i = 0; i < 27; i++) deck.push({ type: 'action', id: `行动_${i}` });
    deck = shuffle(deck);

    // 4. 发牌
    let cardsPerPlayer = (playerCount >= 3 && playerCount <= 5) ? 6 : (playerCount >= 6 && playerCount <= 7) ? 5 : 4;
    for (let i = 0; i < cardsPerPlayer; i++) {
        players.forEach(player => { if (deck.length > 0) player.hand.push(deck.pop()); });
    }

    // 5. 将数据发给前端 (加入 board 数据)
    players.forEach(player => {
        io.to(player.id).emit('gameStarted', {
            yourRole: player.role,
            yourHand: player.hand,
            board: board
        });
    });

    // 👇👇👇 请把代码加在这里！(在上面这段代码的下面，大括号 } 的上面) 👇👇👇
    currentPlayerIndex = 0; // 重置回合
    io.emit('turnUpdated', { currentTurnId: players[currentPlayerIndex].id });
}

io.on('connection', (socket) => {
    players.push({ id: socket.id, role: null, hand: [] });
    io.emit('playerJoined', { playerCount: players.length });

    socket.on('requestStartGame', () => startGame());

    socket.on('disconnect', () => {
        players = players.filter(p => p.id !== socket.id);
        io.emit('playerLeft', { playerCount: players.length });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`服务器启动: ${PORT}`));