const PHASES = {
    SETUP_SELECTION: "SETUP_SELECTION",
    RESOURCE_COLLECTION: "RESOURCE_COLLECTION",
    ACTION: "ACTION",
    BUILD_ARMY: "BUILD_ARMY",
    BUILD_SETTLEMENT: "BUILD_SETTLEMENT",
    MOVE_ARMY: "MOVE_ARMY",
    COMBAT: "COMBAT",
  };
  
  class Board {
    constructor(hexFactory, gridSize) {
      this.grid = Honeycomb.Grid(hexFactory).rectangle({ width: gridSize, height: gridSize });
      this.tiles = this.initializeTiles();
    }
  
    initializeTiles() {
      return this.grid.map((hex) => ({
        hex,
        type: ["grass", "forest", "mountain"][Math.floor(Math.random() * 3)],
        resourceValue: Math.floor(Math.random() * 6) + 1,
        owner: null,
        armies: 0,
        settlement: false,
        grayscale: true,
      }));
    }
  
    getTileAt(hex) {
      return this.tiles.find((t) => t.hex.equals(hex));
    }
  }
  
  class Player {
    constructor(id, name, color) {
      this.id = id;
      this.name = name;
      this.color = color;
      this.resources = { wood: 5, stone: 5, food: 5 };
      this.hexes = [];
    }
  
    addHex(tile) {
      this.hexes.push(tile);
      tile.owner = this.id;
    }
  
    removeHex(tile) {
      this.hexes = this.hexes.filter((h) => h !== tile);
      tile.owner = null;
    }
  
    canAfford(cost) {
      return Object.entries(cost).every(([resource, amount]) => this.resources[resource] >= amount);
    }
  
    spendResources(cost) {
      Object.entries(cost).forEach(([resource, amount]) => {
        this.resources[resource] -= amount);
      });
    }
  }
  
  class UI {
    constructor() {
      this.elements = {
        playerName: document.getElementById("playerName"),
        wood: document.getElementById("wood"),
        stone: document.getElementById("stone"),
        food: document.getElementById("food"),
        phase: document.getElementById("phase"),
        lastRoll: document.getElementById("lastRoll"),
        actionInfo: document.getElementById("actionInfo"),
        rollDice: document.getElementById("rollDice"),
        buildArmy: document.getElementById("buildArmy"),
        buildSettlement: document.getElementById("buildSettlement"),
        moveArmy: document.getElementById("moveArmy"),
        attack: document.getElementById("attack"),
        undo: document.getElementById("undo"),
        endTurn: document.getElementById("endTurn"),
      };
    }
  
    updatePlayerInfo(player) {
      this.elements.playerName.textContent = player.name;
      this.elements.playerName.style.color = player.color;
      this.elements.wood.textContent = player.resources.wood;
      this.elements.stone.textContent = player.resources.stone;
      this.elements.food.textContent = player.resources.food;
    }
  
    updatePhase(phase) {
      this.elements.phase.textContent = phase;
    }
  
    updateLastRoll(die1, die2) {
      const rollText = die1 !== null && die2 !== null ? `${die1}, ${die2}` : "-";
      this.elements.lastRoll.textContent = rollText;
    }
  
    updateActionInfo(message, phase) {
      this.elements.actionInfo.textContent = message;
      this.elements.actionInfo.title = this.getPhaseHelpText(phase);
    }
  
    updateButtonStates(phase, player, buildingCosts) {
      this.elements.rollDice.disabled = phase !== PHASES.RESOURCE_COLLECTION;
      this.elements.buildArmy.disabled = phase !== PHASES.ACTION || !player.canAfford(buildingCosts.army);
      this.elements.buildSettlement.disabled = phase !== PHASES.ACTION || !player.canAfford(buildingCosts.settlement);
      this.elements.moveArmy.disabled = phase !== PHASES.ACTION;
      this.elements.attack.disabled = phase !== PHASES.ACTION;
    }
  
    toggleUndoButton(enabled) {
      this.elements.undo.disabled = !enabled;
    }
  
    getPhaseHelpText(phase) {
      switch (phase) {
        case PHASES.SETUP_SELECTION: return "Click a hex to choose your starting position.";
        case PHASES.RESOURCE_COLLECTION: return "Roll the dice to collect resources from owned hexes.";
        case PHASES.ACTION: return "Choose an action: build, move armies, attack, or end turn.";
        case PHASES.BUILD_ARMY: return "Select a hex you own to build an army.";
        case PHASES.BUILD_SETTLEMENT: return "Select a hex you own to build a settlement.";
        case PHASES.MOVE_ARMY: return "Select a hex with your army to move from, then select destination.";
        case PHASES.COMBAT: return "Select a hex with your army to attack from, then select enemy hex.";
        default: return "";
      }
    }
  }
  
  class Game {
    constructor() {
      this.canvas = document.getElementById("gameCanvas");
      if (!this.canvas) {
        console.error("Canvas element not found!");
        return;
      }
      this.ctx = this.canvas.getContext("2d");
      this.assets = {};
      this.HEX_SIZE = 50;
      this.BUILDING_COSTS = {
        settlement: { wood: 2, stone: 1 },
        army: { food: 2 },
      };
      this.Hex = Honeycomb.Hex({ radius: this.HEX_SIZE });
      this.Grid = Honeycomb.Grid;
      this.board = null;
      this.players = [];
      this.currentPlayerIndex = 0;
      this.state = {
        phase: PHASES.SETUP_SELECTION,
        selectedHex: null,
        moveFrom: null,
        dice: { die1: null, die2: null },
        setupPlayersRemaining: [],
      };
      this.ui = new UI();
      this.previousState = null;
      this.undoAvailable = false;
  
      this.canvas.addEventListener("click", this.handleClick.bind(this));
      this.setupUIHandlers();
      this.setupPlayerFields();
    }
  
    async init() {
      await this.loadAssets();
      this.resizeCanvas();
      window.addEventListener("resize", () => this.resizeCanvas());
      document.getElementById("startMenu").style.display = "block";
      document.getElementById("gameCanvas").style.display = "none";
      document.getElementById("ui").style.display = "none";
    }
  
    async loadAssets() {
      const assetFiles = {
        grass: "grass-hex.png",
        forest: "forest-hex.png",
        mountain: "mountain-hex.png",
        wood: "wood.png",
        stone: "stone.png",
        food: "food.png",
        settlement: "settlement.png",
        army: "army.png",
      };
  
      const loadPromises = Object.entries(assetFiles).map(([key, file]) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            this.assets[key] = img;
            resolve();
          };
          img.onerror = () => {
            console.error(`Failed to load asset: ${file}`);
            reject(new Error(`Failed to load asset: ${file}`));
            alert(`Failed to load game asset: ${file}. Please refresh the page.`);
          };
          img.src = `assets/${file}`;
        });
      });
  
      await Promise.all(loadPromises);
    }
  
    setupPlayerFields() {
      const updateFields = () => {
        const numPlayers = parseInt(document.getElementById("numPlayers").value);
        const container = document.getElementById("playerSetup");
        if (!container) return;
  
        container.innerHTML = "";
        for (let i = 0; i < numPlayers; i++) {
          const playerField = document.createElement("div");
          playerField.className = "player-field";
          playerField.innerHTML = `
            <input type="text" id="player${i}name" placeholder="Player ${i + 1} Name" required>
            <input type="color" id="player${i}color" value="${this.getDefaultColor(i)}">
          `;
          container.appendChild(playerField);
        }
      };
  
      const numPlayersSelect = document.getElementById("numPlayers");
      if (numPlayersSelect) {
        numPlayersSelect.addEventListener("change", updateFields);
        updateFields();
      }
    }
  
    getDefaultColor(index) {
      const colors = ["#ff4444", "#44ff44", "#4444ff", "#ffff44"];
      return colors[index] || "#ffffff";
    }
  
    resizeCanvas() {
      const padding = 40;
      this.canvas.width = window.innerWidth - padding;
      this.canvas.height = window.innerHeight - padding;
    }
  
    setupUIHandlers() {
      const startButton = document.getElementById("startGame");
      if (startButton) {
        startButton.onclick = (e) => {
          e.preventDefault();
          const gridSize = parseInt(document.getElementById("gridSize").value);
          const numPlayers = parseInt(document.getElementById("numPlayers").value);
          const playersData = [];
          for (let i = 0; i < numPlayers; i++) {
            const name = document.getElementById(`player${i}name`).value || `Player ${i + 1}`;
            const color = document.getElementById(`player${i}color`).value;
            playersData.push({ name, color });
          }
          this.startGame(gridSize, playersData);
        };
      }
  
      this.ui.elements.rollDice.addEventListener("click", () => {
        if (this.state.phase === PHASES.RESOURCE_COLLECTION) this.collectResources();
      });
  
      this.ui.elements.buildArmy.addEventListener("click", () => {
        this.state.phase = PHASES.BUILD_ARMY;
        this.ui.updateActionInfo("Select a hex to build an army", this.state.phase);
      });
  
      this.ui.elements.buildSettlement.addEventListener("click", () => {
        this.state.phase = PHASES.BUILD_SETTLEMENT;
        this.ui.updateActionInfo("Select a hex to build a settlement", this.state.phase);
      });
  
      this.ui.elements.moveArmy.addEventListener("click", () => {
        this.state.phase = PHASES.MOVE_ARMY;
        this.ui.updateActionInfo("Select a hex with your army to move", this.state.phase);
      });
  
      this.ui.elements.attack.addEventListener("click", () => {
        this.state.phase = PHASES.COMBAT;
        this.ui.updateActionInfo("Select a hex with your army to attack from", this.state.phase);
      });
  
      this.ui.elements.undo.addEventListener("click", () => this.undoLastAction());
  
      this.ui.elements.endTurn.addEventListener("click", () => this.endTurn());
    }
  
    startGame(gridSize, playersData) {
      const uniqueNames = new Set(playersData.map(p => p.name));
      const uniqueColors = new Set(playersData.map(p => p.color));
      if (uniqueNames.size !== playersData.length || uniqueColors.size !== playersData.length) {
        this.ui.updateActionInfo("Player names and colors must be unique!", this.state.phase);
        return;
      }
  
      this.board = new Board(this.Hex, gridSize);
      this.players = playersData.map((p, i) => new Player(i, p.name, p.color));
      this.state.setupPlayersRemaining = [...this.players];
      this.state.phase = PHASES.SETUP_SELECTION;
      this.currentPlayerIndex = 0;
      this.undoAvailable = false;
      this.ui.toggleUndoButton(false);
  
      document.getElementById("startMenu").style.display = "none";
      document.getElementById("gameCanvas").style.display = "block";
      document.getElementById("ui").style.display = "block";
  
      this.render();
      this.updateUI();
      this.ui.updateActionInfo(`${this.players[this.currentPlayerIndex].name}: Choose your starting hex`, this.state.phase);
    }
  
    handleClick(event) {
      const rect = this.canvas.getBoundingClientRect();
      const point = {
        x: event.clientX - rect.left - this.canvas.width / 2,
        y: event.clientY - rect.top - this.canvas.height / 2,
      };
      const hex = this.board.grid.pointToHex(point);
      if (!hex) return;
      const tile = this.board.getTileAt(hex);
      if (!tile) return;
  
      this.previousState = JSON.parse(JSON.stringify({
        state: this.state,
        board: this.board.tiles,
        players: this.players.map(p => ({
          id: p.id,
          name: p.name,
          color: p.color,
          resources: { ...p.resources },
          hexes: p.hexes,
        })),
      }));
      this.undoAvailable = true;
      this.ui.toggleUndoButton(true);
  
      switch (this.state.phase) {
        case PHASES.SETUP_SELECTION:
          this.handleInitialSelection(tile);
          break;
        case PHASES.BUILD_ARMY:
          this.handleBuildArmy(tile);
          break;
        case PHASES.BUILD_SETTLEMENT:
          this.handleBuildSettlement(tile);
          break;
        case PHASES.MOVE_ARMY:
          this.handleArmyMovement(tile);
          break;
        case PHASES.COMBAT:
          this.handleCombat(tile);
          break;
      }
      this.render();
    }
  
    handleInitialSelection(tile) {
      if (tile.owner !== null) {
        this.ui.updateActionInfo("This hex is already taken! Choose another one.", this.state.phase);
        return;
      }
  
      const currentPlayer = this.players[this.currentPlayerIndex];
      currentPlayer.addHex(tile);
      tile.armies = 1;
      tile.settlement = true;
      tile.grayscale = false;
  
      this.state.setupPlayersRemaining.shift();
      if (this.state.setupPlayersRemaining.length > 0) {
        this.currentPlayerIndex = this.state.setupPlayersRemaining[0].id;
        this.ui.updateActionInfo(`${this.players[this.currentPlayerIndex].name}: Choose your starting hex`, this.state.phase);
      } else {
        this.state.phase = PHASES.RESOURCE_COLLECTION;
        this.currentPlayerIndex = 0;
        this.ui.updateActionInfo("Roll dice to collect resources", this.state.phase);
      }
      this.updateUI();
    }
  
    handleBuildArmy(tile) {
      const player = this.players[this.currentPlayerIndex];
      if (tile.owner !== player.id) {
        this.ui.updateActionInfo("You can only build armies on your own hexes!", this.state.phase);
        return;
      }
      if (!player.canAfford(this.BUILDING_COSTS.army)) {
        this.ui.updateActionInfo("Insufficient resources for army", this.state.phase);
        return;
      }
      player.spendResources(this.BUILDING_COSTS.army);
      tile.armies += 1;
      this.state.phase = PHASES.ACTION;
      this.ui.updateActionInfo("Army built! Choose another action or end turn", this.state.phase);
      this.updateUI();
    }
  
    handleBuildSettlement(tile) {
      const player = this.players[this.currentPlayerIndex];
      if (tile.owner !== player.id || tile.settlement) {
        this.ui.updateActionInfo("You can only build settlements on your own empty hexes!", this.state.phase);
        return;
      }
      if (!player.canAfford(this.BUILDING_COSTS.settlement)) {
        this.ui.updateActionInfo("Insufficient resources for settlement", this.state.phase);
        return;
      }
      player.spendResources(this.BUILDING_COSTS.settlement);
      tile.settlement = true;
      this.state.phase = PHASES.ACTION;
      this.ui.updateActionInfo("Settlement built! Choose another action or end turn", this.state.phase);
      this.updateUI();
    }
  
    handleArmyMovement(tile) {
      if (!this.state.moveFrom) {
        if (tile.owner === this.currentPlayerIndex && tile.armies > 0) {
          this.state.moveFrom = tile;
          this.ui.updateActionInfo("Select destination hex", this.state.phase);
        }
      } else {
        if (this.isValidMove(this.state.moveFrom, tile)) {
          this.moveArmy(this.state.moveFrom, tile);
          this.state.moveFrom = null;
          this.state.phase = PHASES.ACTION;
          this.ui.updateActionInfo("Army moved! Choose another action or end turn", this.state.phase);
        } else {
          this.ui.updateActionInfo("Invalid move destination", this.state.phase);
        }
      }
    }
  
    isValidMove(from, to) {
      const neighbors = this.board.grid.neighborsOf(from.hex);
      return neighbors.some(n => n.equals(to.hex)) && (to.owner === null || to.owner === this.currentPlayerIndex);
    }
  
    moveArmy(from, to) {
      const player = this.players[this.currentPlayerIndex];
      if (to.owner === null) {
        player.addHex(to);
        to.grayscale = false;
      }
      to.armies += 1;
      from.armies -= 1;
      if (from.armies === 0 && !from.settlement) {
        player.removeHex(from);
        from.grayscale = true;
      }
    }
  
    handleCombat(targetTile) {
      if (!this.state.moveFrom) {
        if (targetTile.owner === this.currentPlayerIndex && targetTile.armies > 0) {
          this.state.moveFrom = targetTile;
          this.ui.updateActionInfo("Select enemy hex to attack", this.state.phase);
        }
      } else {
        if (this.isValidAttackTarget(targetTile)) {
          this.performCombat(this.state.moveFrom, targetTile);
          this.state.moveFrom = null;
          this.state.phase = PHASES.ACTION;
          this.ui.updateActionInfo("Combat resolved! Choose another action or end turn", this.state.phase);
        } else {
          this.ui.updateActionInfo("Invalid attack target", this.state.phase);
        }
      }
    }
  
    isValidAttackTarget(target) {
      if (!this.state.moveFrom || target.owner === this.currentPlayerIndex) return false;
      const neighbors = this.board.grid.neighborsOf(this.state.moveFrom.hex);
      return neighbors.some(n => n.equals(target.hex));
    }
  
    performCombat(attacker, defender) {
      const attackStrength = attacker.armies * (Math.random() + 0.5);
      const defenseStrength = defender.armies * (Math.random() + 0.5);
      const attackingPlayer = this.players[attacker.owner];
      const defendingPlayer = this.players[defender.owner];
  
      if (attackStrength > defenseStrength) {
        defendingPlayer.removeHex(defender);
        attackingPlayer.addHex(defender);
        defender.armies = Math.floor(attacker.armies / 2);
        attacker.armies = Math.ceil(attacker.armies / 2);
        defender.grayscale = false;
      } else {
        attacker.armies = Math.ceil(attacker.armies / 2);
        defender.armies = Math.floor(defender.armies * 0.75);
      }
    }
  
    collectResources() {
      this.state.dice.die1 = Math.floor(Math.random() * 6) + 1;
      this.state.dice.die2 = Math.floor(Math.random() * 6) + 1;
      const numbers = [this.state.dice.die1, this.state.dice.die2];
      const player = this.players[this.currentPlayerIndex];
  
      numbers.forEach(roll => {
        this.board.tiles.forEach(tile => {
          if (tile.owner === this.currentPlayerIndex && tile.resourceValue === roll) {
            const multiplier = tile.settlement ? 2 : 1;
            switch (tile.type) {
              case "forest": player.resources.wood += 1 * multiplier; break;
              case "mountain": player.resources.stone += 1 * multiplier; break;
              case "grass": player.resources.food += 1 * multiplier; break;
            }
          }
        });
      });
  
      this.state.phase = PHASES.ACTION;
      this.ui.updateActionInfo("Choose an action: build, move armies, attack, or end turn", this.state.phase);
      this.updateUI();
      this.render();
    }
  
    endTurn() {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      this.state.phase = PHASES.RESOURCE_COLLECTION;
      this.state.moveFrom = null;
      this.state.dice.die1 = null;
      this.state.dice.die2 = null;
      this.undoAvailable = false;
      this.ui.toggleUndoButton(false);
      this.ui.updateActionInfo("Roll dice to collect resources", this.state.phase);
      this.updateUI();
      this.render();
    }
  
    undoLastAction() {
      if (!this.undoAvailable || !this.previousState) return;
  
      this.state = JSON.parse(JSON.stringify(this.previousState.state));
      this.board.tiles = this.previousState.board.map(t => ({
        ...t,
        hex: this.Hex(t.hex.x, t.hex.y),
      }));
      this.players = this.previousState.players.map(p => {
        const player = new Player(p.id, p.name, p.color);
        player.resources = { ...p.resources };
        player.hexes = p.hexes;
        return player;
      });
      this.undoAvailable = false;
      this.ui.toggleUndoButton(false);
      this.ui.updateActionInfo("Action undone. Choose again.", this.state.phase);
      this.updateUI();
      this.render();
    }
  
    render() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.save();
      this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
  
      this.board.tiles.forEach(tile => this.drawHex(tile));
      this.ctx.restore();
    }
  
    drawHex(tile) {
      const { x, y } = tile.hex.toPoint();
      const corners = tile.hex.corners();
  
      this.ctx.beginPath();
      corners.forEach(({ x: cx, y: cy }, i) => {
        i === 0 ? this.ctx.moveTo(cx + x, cy + y) : this.ctx.lineTo(cx + x, cy + y);
      });
      this.ctx.closePath();
  
      this.ctx.filter = tile.grayscale ? "grayscale(100%)" : "none";
      const centerX = x - this.HEX_SIZE;
      const centerY = y - this.HEX_SIZE;
      this.ctx.drawImage(this.assets[tile.type], centerX, centerY, this.HEX_SIZE * 2, this.HEX_SIZE * 2);
      this.ctx.filter = "none";
  
      this.ctx.strokeStyle = tile.owner !== null ? this.players[tile.owner].color : "#000";
      this.ctx.lineWidth = tile.owner !== null ? 3 : 1;
      this.ctx.stroke();
  
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      this.ctx.beginPath();
      this.ctx.arc(x, y, 12, 0, Math.PI * 2);
      this.ctx.fill();
  
      this.ctx.fillStyle = "#000";
      this.ctx.font = "bold 16px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(tile.resourceValue.toString(), x, y);
  
      if (tile.settlement) this.ctx.drawImage(this.assets.settlement, x - 15, y - 15, 30, 30);
      if (tile.armies > 0) {
        this.ctx.drawImage(this.assets.army, x - 15, y + 5, 30, 30);
        this.ctx.fillText(tile.armies.toString(), x, y + 45);
      }
  
      if (this.state.moveFrom === tile) {
        this.ctx.strokeStyle = "#fff";
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }
    }
  
    updateUI() {
      const player = this.players[this.currentPlayerIndex];
      this.ui.updatePlayerInfo(player);
      this.ui.updatePhase(this.state.phase);
      this.ui.updateLastRoll(this.state.dice.die1, this.state.dice.die2);
      this.ui.updateButtonStates(this.state.phase, player, this.BUILDING_COSTS);
    }
  }
  
  window.addEventListener("DOMContentLoaded", () => {
    const game = new Game();
    if (game.canvas) {
      game.init().catch(err => console.error("Error initializing game:", err));
    }
  });