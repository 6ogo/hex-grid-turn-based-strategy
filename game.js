// game.js
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = canvas.getContext('2d');
        this.assets = {};
        this.state = {
            players: [],
            currentPlayer: 0,
            phase: 'SETUP',
            board: [],
            selectedHex: null,
            lastRoll: null
        };
        
        // Constants
        this.HEX_SIZE = 40;
        this.GRID_PADDING = 50;
        
        // Initialize hex grid
        this.Hex = Honeycomb.extendHex({ size: this.HEX_SIZE });
        this.Grid = Honeycomb.defineGrid(this.Hex);
        
        // Bind event handlers
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        this.setupUIHandlers();
    }

    async init() {
        // Load assets
        await this.loadAssets();
        
        // Set canvas size based on window
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Show start menu
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

    resizeCanvas() {
        const padding = 40;
        this.canvas.width = window.innerWidth - padding;
        this.canvas.height = window.innerHeight - padding;
    }

    setupUIHandlers() {
        // Start game button
        document.getElementById('startGame').addEventListener('click', () => {
            const gridSize = parseInt(document.getElementById('gridSize').value);
            const numPlayers = parseInt(document.getElementById('numPlayers').value);
            this.startGame(gridSize, numPlayers);
        });

        // Resource collection button
        document.getElementById('rollDice').addEventListener('click', () => {
            if (this.state.phase === 'RESOURCE_COLLECTION') {
                this.collectResources();
            }
        });

        // End turn button
        document.getElementById('endTurn').addEventListener('click', () => {
            this.endTurn();
        });
    }

    startGame(gridSize, numPlayers) {
        // Create hex grid
        this.grid = this.Grid.rectangle({ width: gridSize, height: gridSize });
        
        // Initialize players
        const playerColors = ['#ff4444', '#44ff44', '#4444ff', '#ffff44'];
        this.state.players = Array.from({ length: numPlayers }, (_, i) => ({
            id: i,
            color: playerColors[i],
            resources: { wood: 5, stone: 5, food: 5 },
            hexes: []
        }));

        // Initialize board
        this.state.board = this.grid.map(hex => {
            const types = ['grass', 'forest', 'mountain'];
            return {
                hex,
                type: types[Math.floor(Math.random() * types.length)],
                resourceValue: Math.floor(Math.random() * 6) + 1,
                owner: null,
                armies: 0
            };
        });

        // Assign starting positions
        this.assignStartingPositions();

        // Show game screen
        document.getElementById('startMenu').style.display = 'none';
        document.getElementById('gameCanvas').style.display = 'block';
        document.getElementById('ui').style.display = 'block';

        // Start first turn
        this.state.currentPlayer = 0;
        this.state.phase = 'RESOURCE_COLLECTION';
        this.render();
        this.updateUI();
    }

    assignStartingPositions() {
        // Give each player one starting hex
        this.state.players.forEach((player, i) => {
            const startHex = this.grid[i * 2];  // Space out starting positions
            const tile = this.state.board.find(t => t.hex.equals(startHex));
            tile.owner = player.id;
            tile.armies = 1;
            player.hexes.push(tile);
        });
    }

    collectResources() {
        const roll = Math.floor(Math.random() * 6) + 1;
        this.state.lastRoll = roll;
        
        // Collect resources from matching hexes
        this.state.board.forEach(tile => {
            if (tile.owner === this.state.currentPlayer && tile.resourceValue === roll) {
                const player = this.state.players[this.state.currentPlayer];
                switch (tile.type) {
                    case 'forest':
                        player.resources.wood += 1;
                        break;
                    case 'mountain':
                        player.resources.stone += 1;
                        break;
                    case 'grass':
                        player.resources.food += 1;
                        break;
                }
            }
        });

        this.state.phase = 'BUILDING';
        this.updateUI();
        this.render();
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

        if (this.state.phase === 'BUILDING') {
            // Handle building/purchasing
            if (tile.owner === null && this.isAdjacentToOwned(tile, player)) {
                if (player.resources.stone >= 2) {
                    player.resources.stone -= 2;
                    tile.owner = player.id;
                    player.hexes.push(tile);
                    this.render();
                    this.updateUI();
                }
            }
        }
    }

    isAdjacentToOwned(tile, player) {
        const neighbors = this.grid.neighborsOf(tile.hex);
        return neighbors.some(neighbor => {
            const neighborTile = this.state.board.find(t => t.hex.equals(neighbor));
            return neighborTile && neighborTile.owner === player.id;
        });
    }

    pixelToHex(x, y) {
        const point = { x: x - this.canvas.width / 2, y: y - this.canvas.height / 2 };
        return this.Hex.pointToHex(point);
    }

    endTurn() {
        this.state.currentPlayer = (this.state.currentPlayer + 1) % this.state.players.length;
        this.state.phase = 'RESOURCE_COLLECTION';
        this.state.lastRoll = null;
        this.updateUI();
        this.render();
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
        
        // Fill based on terrain
        this.ctx.fillStyle = this.getTerrainColor(tile.type);
        this.ctx.fill();
        
        // Draw border
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

        // Draw armies if present
        if (tile.armies > 0) {
            this.ctx.drawImage(
                this.assets.army,
                x - 15,
                y - 15,
                30,
                30
            );
            this.ctx.fillText(tile.armies.toString(), x, y + 25);
        }
    }

    getTerrainColor(type) {
        switch (type) {
            case 'grass': return '#90EE90';
            case 'forest': return '#228B22';
            case 'mountain': return '#808080';
            default: return '#FFFFFF';
        }
    }

    updateUI() {
        const player = this.state.players[this.state.currentPlayer];
        
        // Update resource display
        document.getElementById('wood').textContent = player.resources.wood;
        document.getElementById('stone').textContent = player.resources.stone;
        document.getElementById('food').textContent = player.resources.food;
        
        // Update current player and phase
        document.getElementById('player').textContent = `Player ${player.id + 1}`;
        document.getElementById('phase').textContent = this.state.phase;
        
        // Update roll result if applicable
        if (this.state.lastRoll) {
            document.getElementById('lastRoll').textContent = this.state.lastRoll;
        } else {
            document.getElementById('lastRoll').textContent = '-';
        }
    }
}

// Initialize game when page loads
window.addEventListener('load', () => {
    const game = new Game();
    game.init();
});