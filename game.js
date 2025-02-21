// Setup canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// Load assets (replace with your asset paths)
const assets = {
    grass: new Image(),
    forest: new Image(),
    mountain: new Image(),
    settlement: new Image(),
    army: new Image()
};
assets.grass.src = 'assets/grass-hex.png';
assets.forest.src = 'assets/forest-hex.png';
assets.mountain.src = 'assets/mountain-hex.png';
assets.settlement.src = 'assets/settlement.png';
assets.army.src = 'assets/army.png';

// Hex grid setup with Honeycomb.js
const Hex = Honeycomb.extendHex({ size: 50 });
const Grid = Honeycomb.defineGrid(Hex);
const grid = Grid.rectangle({ width: 10, height: 8 });

// Game state
const gameState = {
    players: [
        { id: 1, wood: 5, stone: 5, food: 5, settlements: [], armies: [] },
        { id: 2, wood: 5, stone: 5, food: 5, settlements: [], armies: [] }
    ],
    currentPlayer: 0,
    board: []
};

// Initialize board with random terrain and numbers
grid.forEach(hex => {
    const type = Math.random() < 0.33 ? 'grass' : Math.random() < 0.66 ? 'forest' : 'mountain';
    gameState.board.push({ hex, type, number: Math.floor(Math.random() * 6) + 1, owner: null, armies: 0 });
});

// UI elements
const ui = {
    player: document.getElementById('currentPlayer'),
    wood: document.getElementById('wood'),
    stone: document.getElementById('stone'),
    food: document.getElementById('food'),
    rollDice: document.getElementById('rollDice'),
    buildSettlement: document.getElementById('buildSettlement'),
    buildArmy: document.getElementById('buildArmy'),
    endTurn: document.getElementById('endTurn')
};

// Render the game
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    grid.forEach(hex => {
        const tile = gameState.board.find(t => t.hex.equals(hex));
        const point = hex.toPoint();
        const centerX = point.x + canvas.width / 2 - grid.width / 2;
        const centerY = point.y + canvas.height / 2 - grid.height / 2;
        ctx.drawImage(assets[tile.type], centerX - 50, centerY - 50, 100, 100);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(tile.number, centerX, centerY);
        if (tile.owner !== null) {
            if (tile.settlements) ctx.drawImage(assets.settlement, centerX - 25, centerY - 25, 50, 50);
            if (tile.armies > 0) ctx.drawImage(assets.army, centerX - 15, centerY - 15, 30, 30);
        }
    });
    updateUI();
}

// Update UI
function updateUI() {
    const player = gameState.players[gameState.currentPlayer];
    ui.player.textContent = player.id;
    ui.wood.textContent = player.wood;
    ui.stone.textContent = player.stone;
    ui.food.textContent = player.food;
}

// Roll dice and distribute resources
ui.rollDice.addEventListener('click', () => {
    const roll = Math.floor(Math.random() * 6) + 1;
    alert(`Rolled a ${roll}`);
    gameState.board.forEach(tile => {
        if (tile.number === roll && tile.owner !== null) {
            const player = gameState.players[tile.owner];
            if (tile.type === 'forest') player.wood += 1;
            else if (tile.type === 'mountain') player.stone += 1;
            else if (tile.type === 'grass') player.food += 1;
        }
    });
    render();
});

// Build settlement
ui.buildSettlement.addEventListener('click', () => {
    const player = gameState.players[gameState.currentPlayer];
    if (player.wood >= 2 && player.stone >= 1) {
        player.wood -= 2;
        player.stone -= 1;
        // Simplified: Claim first unowned hex
        const freeTile = gameState.board.find(t => t.owner === null);
        if (freeTile) {
            freeTile.owner = gameState.currentPlayer;
            freeTile.settlements = true;
        }
        render();
    } else {
        alert('Not enough resources!');
    }
});

// Build army
ui.buildArmy.addEventListener('click', () => {
    const player = gameState.players[gameState.currentPlayer];
    if (player.food >= 1 && player.wood >= 1) {
        player.food -= 1;
        player.wood -= 1;
        // Simplified: Add army to first owned hex
        const ownedTile = gameState.board.find(t => t.owner === gameState.currentPlayer);
        if (ownedTile) ownedTile.armies += 1;
        render();
    } else {
        alert('Not enough resources!');
    }
});

// End turn
ui.endTurn.addEventListener('click', () => {
    gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;
    render();
});

// Click to select hex (basic interaction)
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hex = grid.pointToHex([x - canvas.width / 2 + grid.width / 2, y - canvas.height / 2 + grid.height / 2]);
    const tile = gameState.board.find(t => t.hex.equals(hex));
    if (tile) alert(`Clicked hex: ${tile.type}, Number: ${tile.number}`);
});

// Start game
render();