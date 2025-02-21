// Canvas and context
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
assets.grass.src = 'assets/grass.png';
assets.forest.src = 'assets/forest.png';
assets.mountain.src = 'assets/mountain.png';
assets.settlement.src = 'assets/settlement.png';
assets.army.src = 'assets/army.png';
assets.wood.src = 'assets/forest.png';
assets.stone.src = 'assets/mountain.png';
assets.food.src = 'assets/grass.png'; 

// Hex grid setup with Honeycomb.js
let grid;
const Hex = Honeycomb.extendHex({ size: 50 });
const Grid = Honeycomb.defineGrid(Hex);

// Game state
const gameState = {
    players: [
        { id: 1, wood: 5, stone: 5, food: 5, settlements: [], armies: [] },
        { id: 2, wood: 5, stone: 5, food: 5, settlements: [], armies: [] }
    ],
    currentPlayer: 0,
    board: []
};

// Costs for building and purchasing
const ARMY_COST = { food: 2, wood: 1 };
const HEX_COST = { stone: 2 };

// Initially show start menu, hide game
document.getElementById('startMenu').style.display = 'block';
document.getElementById('gameCanvas').style.display = 'none';
document.getElementById('ui').style.display = 'none';

// Start game button
document.getElementById('startGame').addEventListener('click', () => {
    const gridSize = parseInt(document.getElementById('gridSize').value);
    const numPlayers = parseInt(document.getElementById('numPlayers').value);
    startGame(gridSize, numPlayers);
});

// Selected hex for attacking
let selectedHex = null;

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
    endTurn: document.getElementById('endTurn'),
    players: [],
    currentPlayer: 0,
    phase: 'building',
    board: []
};

// Start the game
function startGame(gridSize, numPlayers) {
    // Create grid
    grid = Grid.rectangle({ width: gridSize, height: gridSize });

    // Initialize players
    gameState.players = Array.from({ length: numPlayers }, (_, i) => ({
        id: i + 1,
        wood: 0,
        stone: 0,
        food: 0,
        hexes: []
    }));
    gameState.currentPlayer = 0;
    gameState.phase = 'building';

    // Generate board with random resource hexes
    gameState.board = grid.map(hex => ({
        hex,
        type: ['wood', 'stone', 'food'][Math.floor(Math.random() * 3)],
        owner: null,
        armies: []
    }));

    // Assign starting hexes
    const startingHexes = grid.slice(0, numPlayers); // Simple: first N hexes
    startingHexes.forEach((hex, i) => {
        const tile = gameState.board.find(t => t.hex.equals(hex));
        tile.owner = i;
        tile.armies = [{ health: 100, damage: 50 }];
        gameState.players[i].hexes.push(tile);
    });

    // Show game, hide menu
    document.getElementById('startMenu').style.display = 'none';
    document.getElementById('gameCanvas').style.display = 'block';
    document.getElementById('ui').style.display = 'block';
    startTurn();
}

// Start a player's turn
function startTurn() {
    const player = gameState.players[gameState.currentPlayer];
    // Collect resources from controlled hexes
    gameState.board.forEach(tile => {
        if (tile.owner === gameState.currentPlayer) {
            if (tile.type === 'wood') player.wood += 1;
            else if (tile.type === 'stone') player.stone += 1;
            else if (tile.type === 'food') player.food += 1;
        }
    });
    gameState.phase = 'building';
    render();
}

// Render the game board
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    grid.forEach(hex => {
        const tile = gameState.board.find(t => t.hex.equals(hex));
        const point = hex.toPoint();
        const centerX = point.x + canvas.width / 2 - grid.width / 2;
        const centerY = point.y + canvas.height / 2 - grid.height / 2;
        ctx.drawImage(assets[tile.type], centerX - 50, centerY - 50, 100, 100);
        if (tile.owner !== null) {
            ctx.fillStyle = `hsl(${tile.owner * 60}, 100%, 50%)`;
            ctx.beginPath();
            hex.corners().forEach(({ x, y }) => ctx.lineTo(x + centerX, y + centerY));
            ctx.closePath();
            ctx.stroke();
        }
        if (tile.armies.length > 0) {
            ctx.fillStyle = 'black';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(tile.armies.length, centerX, centerY);
        }
    });
    updateUI();

    // Check for victory
    const playersWithArmies = gameState.players.filter(p => 
        gameState.board.some(t => t.owner === p.id && t.armies.length > 0)
    );
    if (playersWithArmies.length === 1) {
        alert(`Player ${playersWithArmies[0].id} wins!`);
    }
}

// Update UI
function updateUI() {
    const player = gameState.players[gameState.currentPlayer];
    ui.player.textContent = player.id;
    ui.wood.textContent = player.wood;
    ui.stone.textContent = player.stone;
    ui.food.textContent = player.food;
    ui.phase.textContent = gameState.phase;
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

// Handle clicks on the canvas
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hex = grid.pointToHex([x - canvas.width / 2 + grid.width / 2, y - canvas.height / 2 + grid.height / 2]);
    const tile = gameState.board.find(t => t.hex.equals(hex));
    if (!tile) return;

    const player = gameState.players[gameState.currentPlayer];

    if (gameState.phase === 'building') {
        if (tile.owner === gameState.currentPlayer) {
            // Build army on owned hex
            if (player.food >= ARMY_COST.food && player.wood >= ARMY_COST.wood) {
                player.food -= ARMY_COST.food;
                player.wood -= ARMY_COST.wood;
                tile.armies.push({ health: 100, damage: 50 });
                render();
            } else {
                alert('Not enough resources to build an army!');
            }
        } else if (tile.owner === null && grid.neighbors(tile.hex).some(n => 
            gameState.board.find(t => t.hex.equals(n))?.owner === gameState.currentPlayer)) {
            // Purchase adjacent unclaimed hex
            if (player.stone >= HEX_COST.stone) {
                player.stone -= HEX_COST.stone;
                tile.owner = gameState.currentPlayer;
                player.hexes.push(tile);
                render();
            } else {
                alert('Not enough stone to purchase a hex!');
            }
        }
    } else if (gameState.phase === 'attacking') {
        if (selectedHex === null) {
            if (tile.owner === gameState.currentPlayer && tile.armies.length > 0) {
                selectedHex = tile;
            }
        } else {
            if (grid.distance(selectedHex.hex, tile.hex) === 1 && tile.owner !== gameState.currentPlayer) {
                performAttack(selectedHex, tile);
                selectedHex = null;
            } else {
                selectedHex = null;
            }
        }
        render();
    }
});

// Proceed to attack phase
ui.proceedToAttack.addEventListener('click', () => {
    if (gameState.phase === 'building') {
        gameState.phase = 'attacking';
        render();
    }
});

// End turn
ui.endTurn.addEventListener('click', () => {
    if (gameState.phase === 'attacking') {
        gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;
        selectedHex = null;
        startTurn();
    }
});

// Perform combat
function performAttack(attackerTile, defenderTile) {
    const attackerArmies = [...attackerTile.armies];
    const defenderArmies = [...defenderTile.armies];

    // Each army attacks a random enemy
    attackerArmies.forEach(army => {
        if (defenderArmies.length > 0) {
            const target = defenderArmies[Math.floor(Math.random() * defenderArmies.length)];
            target.health -= army.damage;
        }
    });
    defenderArmies.forEach(army => {
        if (attackerArmies.length > 0) {
            const target = attackerArmies[Math.floor(Math.random() * attackerArmies.length)];
            target.health -= army.damage;
        }
    });

    // Update armies after combat
    attackerTile.armies = attackerArmies.filter(a => a.health > 0);
    defenderTile.armies = defenderArmies.filter(a => a.health > 0);

    // Conquer if defender is defeated
    if (defenderTile.armies.length === 0) {
        defenderTile.owner = attackerTile.owner;
        if (attackerTile.armies.length > 1) {
            defenderTile.armies = attackerTile.armies.slice(1);
            attackerTile.armies = [attackerTile.armies[0]];
        } else {
            defenderTile.armies = attackerTile.armies;
            attackerTile.armies = [];
            attackerTile.owner = null;
        }
    }
}

// Start game
render();