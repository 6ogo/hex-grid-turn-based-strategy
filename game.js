// game.js
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = canvas.getContext('2d');
        this.assets = {}

// Initialize game when page loads
window.addEventListener('load', () => {
    const game = new Game();
    game.init();
});;
        this.state = {
            players: [],
            currentPlayer: 0,
            phase: 'SETUP',
            board: [],
            selectedHex: null,
            lastRoll: null,
            moveFrom: null,
            moveTo: null
        };
        
        // Constants
        this.HEX_SIZE = 50;
        this.BUILDING_COSTS = {
            settlement: { wood: 2, stone: 1 },
            army: { food: 2 }
        };
        
        // Initialize hex grid
        this.Hex = Honeycomb.extendHex({ size: this.HEX_SIZE });
        this.Grid = Honeycomb.defineGrid(this.Hex);
        
        // Bind event handlers
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        this.setupUIHandlers();
        this.setupPlayerFields();
    }

    async init() {
        await this.loadAssets();
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        document.getElementById('startMenu').style.display = 'block';
        document.getElementById('gameCanvas').style.display = 'none';
        document.getElementById('ui').style.display = 'none';
    }

    async loadAssets() {
        const assetFiles = {
            grass: 'grass-hex.png',
            forest: 'forest-hex.png',
            mountain: 'mountain-hex.png',
            wood: 'wood.png',
            stone: 'stone.png',
            food: 'food.png',
            settlement: 'settlement.png',
            army: 'army.png'
        };

        const loadPromises = Object.entries(assetFiles).map(([key, file]) => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    this.assets[key] = img;
                    resolve();
                };
                img.onerror = reject;
                img.src = `assets/${file}`;
            });
        });

        await Promise.all(loadPromises);
    }

    setupPlayerFields() {
        const updateFields = () => {
            const numPlayers = parseInt(document.getElementById('numPlayers').value);
            const container = document.getElementById('playerSetup');
            container.innerHTML = '';
            
            for (let i = 0; i < numPlayers; i++) {
                const playerField = document.createElement('div');
                playerField.className = 'player-field';
                playerField.innerHTML = `
                    <input type="text" id="player${i}name" placeholder="Player ${i + 1} Name" required>
                    <input type="color" id="player${i}color" value="${this.getDefaultColor(i)}">
                `;
                container.appendChild(playerField);
            }
        };

        document.getElementById('numPlayers').addEventListener('change', updateFields);
        updateFields();
    }

    getDefaultColor(index) {
        const colors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44'];
        return colors[index] || '#ffffff';
    }

    resizeCanvas() {
        const padding = 40;
        this.canvas.width = window.innerWidth - padding;
        this.canvas.height = window.innerHeight - padding;
    }

    setupUIHandlers() {
        document.getElementById('startGame').addEventListener('click', () => {
            const gridSize = parseInt(document.getElementById('gridSize').value);
            const numPlayers = parseInt(document.getElementById('numPlayers').value);
            const players = [];
            
            for (let i = 0; i < numPlayers; i++) {
                const name = document.getElementById(`player${i}name`).value || `Player ${i + 1}`;
                const color = document.getElementById(`player${i}color`).value;
                players.push({ name, color });
            }
            
            this.startGame(gridSize, players);
        });

        document.getElementById('rollDice').addEventListener('click', () => {
            if (this.state.phase === 'RESOURCE_COLLECTION') {
                this.collectResources();
            }
        });

        document.getElementById('buildArmy').addEventListener('click', () => {
            this.state.phase = 'BUILD_ARMY';
            this.updateActionInfo('Select a hex to build an army');
        });

        document.getElementById('buildSettlement').addEventListener('click', () => {
            this.state.phase = 'BUILD_SETTLEMENT';
            this.updateActionInfo('Select a hex to build a settlement');
        });

        document.getElementById('endTurn').addEventListener('click', () => {
            this.endTurn();
        });
    }

    startGame(gridSize, players) {
        this.grid = this.Grid.rectangle({ width: gridSize, height: gridSize });
        
        this.state.players = players.map((player, i) => ({
            id: i,
            name: player.name,
            color: player.color,
            resources: { wood: 5, stone: 5, food: 5 },
            hexes: []
        }));

        this.state.board = this.grid.map(hex => {
            const types = ['grass', 'forest', 'mountain'];
            return {
                hex,
                type: types[Math.floor(Math.random() * types.length)],
                resourceValue: Math.floor(Math.random() * 6) + 1,
                owner: null,
                armies: 0,
                settlement: false,
                grayscale: true
            };
        });

        // Hide menu, show game
        document.getElementById('startMenu').style.display = 'none';
        document.getElementById('gameCanvas').style.display = 'block';
        document.getElementById('ui').style.display = 'block';

        // Assign starting positions
        this.assignStartingPositions();

        // Start first turn
        this.state.currentPlayer = 0;
        this.state.phase = 'RESOURCE_COLLECTION';
        this.render();
        this.updateUI();
    }

    assignStartingPositions() {
        // Give each player one starting hex at corners
        const corners = this.getCornerHexes();
        this.state.players.forEach((player, i) => {
            if (corners[i]) {
                const tile = this.state.board.find(t => t.hex.equals(corners[i]));
                tile.owner = player.id;
                tile.armies = 1;
                tile.settlement = true;
                tile.grayscale = false;
                player.hexes.push(tile);
            }
        });
    }

    getCornerHexes() {
        const width = this.grid.width;
        const height = this.grid.height;
        return [
            this.grid[0], // top-left
            this.grid[width - 1], // top-right
            this.grid[(height - 1) * width], // bottom-left
            this.grid[height * width - 1] // bottom-right
        ];
    }

    collectResources() {
        const roll = Math.floor(Math.random() * 6) + 1;
        this.state.lastRoll = roll;
        
        // Collect resources from matching hexes
        this.state.board.forEach(tile => {
            if (tile.owner === this.state.currentPlayer && tile.resourceValue === roll) {
                const player = this.state.players[this.state.currentPlayer];
                const multiplier = tile.settlement ? 2 : 1; // Settlements provide double resources
                
                switch (tile.type) {
                    case 'forest':
                        player.resources.wood += 1 * multiplier;
                        break;
                    case 'mountain':
                        player.resources.stone += 1 * multiplier;
                        break;
                    case 'grass':
                        player.resources.food += 1 * multiplier;
                        break;
                }
            }
        });

        this.state.phase = 'ACTION';
        this.updateUI();
        this.render();
        this.updateActionInfo('Choose an action: build, move armies, or end turn');
    }

    handleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Convert click to hex coordinates
        const hexCoordinates = this.pixelToHex(x, y);
        const clickedHex = this.grid.get(hexCoordinates);
        
        if (!clickedHex) return;
        
        const tile = this.state.board.find(t => t.hex.equals(clickedHex));
        if (!tile) return;

        this.handleHexClick(tile);
    }

    handleHexClick(tile) {
        const player = this.state.players[this.state.currentPlayer];

        switch (this.state.phase) {
            case 'BUILD_ARMY':
                this.handleBuildArmy(tile, player);
                break;
            case 'BUILD_SETTLEMENT':
                this.handleBuildSettlement(tile, player);
                break;
            case 'MOVE_ARMY':
                this.handleArmyMovement(tile);
                break;
            case 'COMBAT':
                this.handleCombat(tile);
                break;
        }
    }

    handleBuildArmy(tile, player) {
        if (tile.owner === player.id && player.resources.food >= this.BUILDING_COSTS.army.food) {
            player.resources.food -= this.BUILDING_COSTS.army.food;
            tile.armies += 1;
            this.state.phase = 'ACTION';
            this.updateActionInfo('Army built! Choose another action or end turn');
            this.render();
            this.updateUI();
        } else {
            this.updateActionInfo('Invalid location or insufficient resources for army');
        }
    }

    handleBuildSettlement(tile, player) {
        if (tile.owner === player.id && !tile.settlement &&
            player.resources.wood >= this.BUILDING_COSTS.settlement.wood &&
            player.resources.stone >= this.BUILDING_COSTS.settlement.stone) {
            
            player.resources.wood -= this.BUILDING_COSTS.settlement.wood;
            player.resources.stone -= this.BUILDING_COSTS.settlement.stone;
            tile.settlement = true;
            this.state.phase = 'ACTION';
            this.updateActionInfo('Settlement built! Choose another action or end turn');
            this.render();
            this.updateUI();
        } else {
            this.updateActionInfo('Invalid location or insufficient resources for settlement');
        }
    }

    handleArmyMovement(tile) {
        if (!this.state.moveFrom) {
            // First click - select army to move
            if (tile.owner === this.state.currentPlayer && tile.armies > 0) {
                this.state.moveFrom = tile;
                this.updateActionInfo('Select destination hex');
            }
        } else {
            // Second click - select destination
            if (this.isValidMove(this.state.moveFrom, tile)) {
                this.moveArmy(this.state.moveFrom, tile);
                this.state.moveFrom = null;
                this.state.phase = 'ACTION';
                this.updateActionInfo('Army moved! Choose another action or end turn');
            } else {
                this.updateActionInfo('Invalid move destination');
            }
            this.render();
        }
    }

    isValidMove(from, to) {
        // Check if destination is adjacent
        const neighbors = this.grid.neighborsOf(from.hex);
        if (!neighbors.some(n => n.equals(to.hex))) return false;

        // Check if destination is owned by current player or empty
        return to.owner === null || to.owner === this.state.currentPlayer;
    }

    moveArmy(from, to) {
        // If moving to empty hex, claim it
        if (to.owner === null) {
            to.owner = this.state.currentPlayer;
            to.grayscale = false;
            this.state.players[this.state.currentPlayer].hexes.push(to);
        }

        // Move army
        to.armies += 1;
        from.armies -= 1;

        // If source hex is empty now, update its status
        if (from.armies === 0 && !from.settlement) {
            from.owner = null;
            from.grayscale = true;
            const player = this.state.players[this.state.currentPlayer];
            player.hexes = player.hexes.filter(h => h !== from);
        }
    }

    handleCombat(targetTile) {
        if (!this.state.moveFrom) {
            if (targetTile.owner === this.state.currentPlayer && targetTile.armies > 0) {
                this.state.moveFrom = targetTile;
                this.updateActionInfo('Select enemy hex to attack');
            }
        } else {
            if (this.isValidAttackTarget(targetTile)) {
                this.performCombat(this.state.moveFrom, targetTile);
                this.state.moveFrom = null;
                this.state.phase = 'ACTION';
                this.updateActionInfo('Combat resolved! Choose another action or end turn');
            } else {
                this.updateActionInfo('Invalid attack target');
            }
            this.render();
        }
    }

    isValidAttackTarget(target) {
        if (!this.state.moveFrom || target.owner === this.state.currentPlayer) return false;
        const neighbors = this.grid.neighborsOf(this.state.moveFrom.hex);
        return neighbors.some(n => n.equals(target.hex));
    }

    performCombat(attacker, defender) {
        // Simple combat resolution
        const attackStrength = attacker.armies * (Math.random() + 0.5); // 0.5-1.5 multiplier
        const defenseStrength = defender.armies * (Math.random() + 0.5);

        if (attackStrength > defenseStrength) {
            // Attacker wins
            defender.owner = attacker.owner;
            defender.armies = Math.floor(attacker.armies / 2);
            attacker.armies = Math.ceil(attacker.armies / 2);
            defender.grayscale = false;
            
            // Update player hex lists
            const attackingPlayer = this.state.players[attacker.owner];
            const defendingPlayer = this.state.players[defender.owner];
            defendingPlayer.hexes = defendingPlayer.hexes.filter(h => h !== defender);
            attackingPlayer.hexes.push(defender);
        } else {
            // Defender wins
            attacker.armies = Math.ceil(attacker.armies / 2);
            defender.armies = Math.floor(defender.armies * 0.75);
        }
    }

    pixelToHex(x, y) {
        const point = { 
            x: x - this.canvas.width / 2, 
            y: y - this.canvas.height / 2 
        };
        return this.Hex.pointToHex(point);
    }

    endTurn() {
        this.state.currentPlayer = (this.state.currentPlayer + 1) % this.state.players.length;
        this.state.phase = 'RESOURCE_COLLECTION';
        this.state.lastRoll = null;
        this.state.moveFrom = null;
        this.updateUI();
        this.render();
        this.updateActionInfo('Roll dice to collect resources');
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Set up transform to center the grid
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);

        // Draw all hexes
        this.state.board.forEach(tile => {
            this.drawHex(tile);
        });

        this.ctx.restore();
    }

    drawHex(tile) {
        const { x, y } = tile.hex.toPoint();
        const corners = tile.hex.corners();
        
        // Draw hex background
        this.ctx.beginPath();
        corners.forEach(({ x: cx, y: cy }, i) => {
            if (i === 0) this.ctx.moveTo(cx + x, cy + y);
            else this.ctx.lineTo(cx + x, cy + y);
        });
        this.ctx.closePath();
        
        // Draw terrain with grayscale if not owned
        if (tile.grayscale) {
            this.ctx.filter = 'grayscale(100%)';
        } else {
            this.ctx.filter = 'none';
        }
        
        const centerX = x - this.HEX_SIZE;
        const centerY = y - this.HEX_SIZE;
        this.ctx.drawImage(
            this.assets[tile.type],
            centerX,
            centerY,
            this.HEX_SIZE * 2,
            this.HEX_SIZE * 2
        );
        
        this.ctx.filter = 'none';

        // Draw hex border
        if (tile.owner !== null) {
            this.ctx.strokeStyle = this.state.players[tile.owner].color;
            this.ctx.lineWidth = 3;
        } else {
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
        }
        this.ctx.stroke();

        // Draw resource number
        this.ctx.fillStyle = '#000';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(tile.resourceValue.toString(), x, y);

        // Draw settlement if present
        if (tile.settlement) {
            this.ctx.drawImage(
                this.assets.settlement,
                x - 15,
                y - 15,
                30,
                30
            );
        }

        // Draw armies if present
        if (tile.armies > 0) {
            this.ctx.drawImage(
                this.assets.army,
                x - 15,
                y + 5,
                30,
                30
            );
            this.ctx.fillText(tile.armies.toString(), x, y + 45);
        }

        // Highlight selected hex
        if (this.state.moveFrom === tile) {
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }

    updateUI() {
        const player = this.state.players[this.state.currentPlayer];
        
        // Update player name with color
        const playerName = document.getElementById('playerName');
        playerName.textContent = player.name;
        playerName.style.color = player.color;
        
        // Update resources
        document.getElementById('wood').textContent = player.resources.wood;
        document.getElementById('stone').textContent = player.resources.stone;
        document.getElementById('food').textContent = player.resources.food;
        
        // Update phase and roll
        document.getElementById('phase').textContent = this.state.phase;
        document.getElementById('lastRoll').textContent = this.state.lastRoll || '-';
        
        // Update buttons based on phase and resources
        const buildArmyBtn = document.getElementById('buildArmy');
        const buildSettlementBtn = document.getElementById('buildSettlement');
        
        buildArmyBtn.disabled = player.resources.food < this.BUILDING_COSTS.army.food;
        buildSettlementBtn.disabled = player.resources.wood < this.BUILDING_COSTS.settlement.wood || 
                                    player.resources.stone < this.BUILDING_COSTS.settlement.stone;
    }

    updateActionInfo(message) {
        document.getElementById('actionInfo').textContent = message;
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    const game = new Game();
    game.init();
});