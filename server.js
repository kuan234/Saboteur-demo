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

    // 监听玩家出牌动作 (加入了严格的规则校验)
    socket.on('playCard', (data) => {
        const playerIndex = players.findIndex(p => p.id === socket.id);
        const player = players[playerIndex];

        // 1. 检查是不是轮到你
        if (playerIndex !== currentPlayerIndex) {
            socket.emit('errorMsg', '还没轮到你出牌哦！');
            return;
        }

        const { card, targetX, targetY } = data;
        const coord = `${targetX},${targetY}`;

        // 2. 规则校验：行动卡绝对不能放在地图上！
        if (card.type === 'action') {
            socket.emit('errorMsg', '行动卡不能铺在桌面上！请选择道路卡。');
            return;
        }

        // 3. 规则校验：格子上是不是已经有牌了
        if (board[coord]) {
            socket.emit('errorMsg', '这个位置已经被占用了！');
            return;
        }

        // 4. 规则校验：新放的牌必须挨着桌上已有的牌 (上下左右至少有一个邻居)
        const hasNeighbor = board[`${targetX + 1},${targetY}`] || 
                            board[`${targetX - 1},${targetY}`] || 
                            board[`${targetX},${targetY + 1}`] || 
                            board[`${targetX},${targetY - 1}`];
        if (!hasNeighbor) {
            socket.emit('errorMsg', '违章建筑！新放的道路必须与桌上已有的卡牌相邻！');
            return;
        }

        // 5. 放牌到桌面
        board[coord] = { type: card.type, name: card.id, faceUp: true };

        // 6. 扣除手牌并摸新牌
        player.hand = player.hand.filter(c => c.id !== card.id);
        if (deck.length > 0) player.hand.push(deck.pop());

        // 7. 切换回合
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;

        // 8. 广播更新
        io.emit('boardUpdated', board);
        io.emit('turnUpdated', { currentTurnId: players[currentPlayerIndex].id });
        socket.emit('handUpdated', { yourHand: player.hand });
    });

    // 👇👇👇 新增：监听玩家弃牌 (Pass) 👇👇👇
    socket.on('discardCard', (data) => {
        const playerIndex = players.findIndex(p => p.id === socket.id);
        const player = players[playerIndex];

        if (playerIndex !== currentPlayerIndex) {
            socket.emit('errorMsg', '还没轮到你操作哦！');
            return;
        }

        // 扣除弃掉的牌
        player.hand = player.hand.filter(c => c.id !== data.card.id);
        
        // 摸一张新牌
        if (deck.length > 0) player.hand.push(deck.pop());

        // 切换回合
        currentPlayerIndex = (currentPlayerIndex + 1) % players.length;

        // 广播并刷新
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