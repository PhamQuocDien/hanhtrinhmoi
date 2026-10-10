// File: monopoly-logic.js
const { boardData } = require('./monopoly-data.js');

class MonopolyGame {
    constructor(roomId) {
        this.roomId = roomId;
        this.players = []; 
        this.boardState = {};    // Lưu chủ sở hữu ô đất {vị_trí: id_người_chơi}
        this.propertyHouses = {}; // QUAN TRỌNG: Lưu số nhà trên từng ô {vị_trí: số_nhà}
        this.turnIndex = 0; 
        this.logs = []; 
        this.state = 'waiting'; 
    }

    addPlayer(id, username) {
        if (this.state !== 'waiting') return null;
        const color = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'cyan', 'pink'][this.players.length % 8];
        const newPlayer = {
            id,
            username,
            money: 1500, 
            position: 0,
            color: color,
            isJailed: false,
            jailTurns: 0,
            properties: [],
            isBankrupt: false
        };
        this.players.push(newPlayer);
        this.log(`👋 ${username} đã tham gia game.`);
        return newPlayer;
    }

    startGame() {
        if (this.players.length < 2) return false;
        this.state = 'playing';
        this.turnIndex = 0;
        this.log("🎲 Game bắt đầu! Lượt của " + this.getCurrentPlayer().username);
        return true;
    }

    getCurrentPlayer() {
        return this.players[this.turnIndex];
    }

    nextTurn() {
        if (!this.players.length) return null;

        let attempts = 0;
        do {
            this.turnIndex = (this.turnIndex + 1) % this.players.length;
            attempts++;
        } while (this.players[this.turnIndex]?.isBankrupt && attempts <= this.players.length);

        const nextPlayer = this.getCurrentPlayer();
        if (nextPlayer) this.log(`👉 Chuyển lượt sang: ${nextPlayer.username}`);
        return nextPlayer;
    }

    getActivePlayers() {
        return this.players.filter(player => !player.isBankrupt && player.money > 0);
    }

    markBankruptIfNeeded(player) {
        if (!player || player.money > 0) return false;
        player.money = 0;
        player.isBankrupt = true;
        this.log(`💥 ${player.username} đã phá sản và rời cuộc đua.`);
        return true;
    }

    rollDice() {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2;
        return { d1, d2, total };
    }

    movePlayer(steps) {
        const player = this.getCurrentPlayer();
        
        if (player.isJailed) {
            player.jailTurns--;
            if (player.jailTurns <= 0) {
                player.isJailed = false;
                this.log(`🔓 ${player.username} đã hết hạn tù và được tự do!`);
            } else {
                return { action: 'msg', message: `${player.username} đang ở tù, mất lượt.` };
            }
        }

        const oldPos = player.position;
        player.position = (player.position + steps) % 40;

        if (player.position < oldPos) {
            player.money += 200;
            this.log(`💰 ${player.username} nhận $200 khi qua Bắt Đầu.`);
        }

        return this.handleLanding(player.position);
    }

    handleLanding(pos) {
        const player = this.getCurrentPlayer();
        const cell = boardData[pos];
        const ownerId = this.boardState[pos];

        let action = null; 
        let message = `Bé đang ở ${cell.name}.`;

        if (cell.type === 'property' || cell.type === 'railroad' || cell.type === 'utility') {
            if (!ownerId) {
                if (player.money >= cell.price) {
                    action = 'buy';
                    message = `Đất trống! Giá $${cell.price}. Mua không bé?`;
                } else {
                    message = `Đất trống nhưng bé không đủ tiền mua ($${cell.price}).`;
                }
            } else if (ownerId !== player.id) {
                const rent = this.calculateRent(pos);
                const owner = this.players.find(p => p.id === ownerId);
                const paid = Math.min(Math.max(player.money, 0), rent);
                player.money -= paid;
                if (owner) owner.money += paid;

                action = 'rent_paid';
                const ownerName = owner?.username || 'ngân hàng';
                this.log(`💸 ${player.username} trả $${paid} tiền thuê cho ${ownerName}.`);
                message = `Bé đã trả $${paid} tiền thuê nhà cho ${ownerName}.`;
                this.markBankruptIfNeeded(player);
            }
        } 
        else if (cell.type === 'tax') {
            const paid = Math.min(Math.max(player.money, 0), cell.price);
            player.money -= paid;
            this.log(`💸 ${player.username} đóng thuế $${paid}.`);
            message = `Bé bị trừ $${paid} tiền thuế Hành tinh.`;
            this.markBankruptIfNeeded(player);
        }
        else if (cell.type === 'gotojail') {
            player.position = 10; 
            player.isJailed = true;
            player.jailTurns = 3;
            this.log(`👮 ${player.username} bị cảnh sát bắt vào tù!`);
            message = "Ôi không! Bé đã bị bắt vào tù!";
        }
        else if (cell.type === 'chance' || cell.type === 'community') {
            const luck = Math.random();
            if (luck > 0.5) {
                player.money += 100;
                this.log(`🍀 ${player.username} nhặt được rương kim cương: +$100.`);
                message = "May mắn quá! Bé được tặng $100.";
            } else {
                const penalty = Math.min(Math.max(player.money, 0), 50);
                player.money -= penalty;
                this.log(`⚠️ ${player.username} làm hỏng phi thuyền: -$${penalty}.`);
                message = `Xui xẻo rồi! Bé bị phạt $${penalty}.`;
                this.markBankruptIfNeeded(player);
            }
        }

        return { player, action, message };
    }

    buyProperty(pos) {
        const player = this.getCurrentPlayer();
        const cell = boardData[pos];

        if (!player || !cell || !['property', 'railroad', 'utility'].includes(cell.type)) return false;
        if (player.isBankrupt) return false;

        if (player.money >= cell.price && !this.boardState[pos]) {
            player.money -= cell.price;
            this.boardState[pos] = player.id;
            player.properties.push(pos);
            this.log(`🏠 ${player.username} đã mua khu đất ${cell.name}.`);
            return true;
        }
        return false;
    }

    calculateRent(pos) {
        const cell = boardData[pos];
        if (!cell) return 0;
        const houses = Math.min(Math.max(this.propertyHouses[pos] || 0, 0), 5);

        if (cell.type === 'property' && cell.rent) {
            return cell.rent[houses]; 
        }
        
        if (cell.type === 'railroad') {
            const ownerId = this.boardState[pos];
            const count = boardData.filter((t, i) => t.type === 'railroad' && this.boardState[i] === ownerId).length;
            return [25, 50, 100, 200][count - 1] || 25;
        }

        return Math.floor(cell.price * 0.1); 
    }

    canBuildHouse(playerId, tileId) {
        const cell = boardData[tileId];
        if (!cell || cell.type !== 'property') return false;
        if (this.boardState[tileId] !== playerId) return false;

        const sameGroupTiles = boardData.filter(t => t.group === cell.group);
        const ownsAll = sameGroupTiles.every(t => this.boardState[t.id] === playerId);
        if (!ownsAll) return false;

        const currentHouses = this.propertyHouses[tileId] || 0;
        if (currentHouses >= 5) return false; 

        // Quy tắc xây đều
        for (let t of sameGroupTiles) {
            const otherHouses = this.propertyHouses[t.id] || 0;
            if (currentHouses > otherHouses) return false; 
        }
        return true;
    }

    buildHouse(tileId) {
        const player = this.getCurrentPlayer();
        const tile = boardData[tileId];

        if (!player || player.isBankrupt || !tile) return false;
        if (this.canBuildHouse(player.id, tileId)) {
            if (player.money < tile.housePrice) return false;
            
            player.money -= tile.housePrice;
            this.propertyHouses[tileId] = (this.propertyHouses[tileId] || 0) + 1;
            
            this.log(`🏗️ ${player.username} đã nâng cấp thêm nhà tại ${tile.name}.`);
            return true;
        }
        return false;
    }

    log(msg) {
        const time = new Date().toLocaleTimeString();
        this.logs.push(`[${time}] ${msg}`);
        if (this.logs.length > 50) this.logs.shift();
    }
}

module.exports = MonopolyGame;