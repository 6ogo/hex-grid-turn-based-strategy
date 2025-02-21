// Constants
const PHASES = {
  SETUP_SELECTION: "SETUP_SELECTION",
  RESOURCE_COLLECTION: "RESOURCE_COLLECTION",
  ACTION: "ACTION",
  BUILD_ARMY: "BUILD_ARMY",
  BUILD_SETTLEMENT: "BUILD_SETTLEMENT",
  EXPAND_TERRITORY: "EXPAND_TERRITORY",
  MOVE_ARMY: "MOVE_ARMY",
  COMBAT: "COMBAT",
};

const COSTS = {
  settlement: { wood: 5, stone: 5 },
  army: { food: 10 },
  territory: { wood: 3, stone: 2 },
};

class HexBoard {
  constructor(hexFactory, gridSize) {
      this.factory = hexFactory;
      this.grid = Honeycomb.defineGrid(hexFactory).rectangle({
          width: gridSize,
          height: gridSize,
      });
      this.tiles = this.initializeTiles();
      this.scale = 1;
  }

  initializeTiles() {
      return Array.from(this.grid).map((hex) => ({
          hex,
          type: ["grass", "forest", "mountain"][Math.floor(Math.random() * 3)],
          resourceValue: Math.floor(Math.random() * 6) + 1,
          owner: null,
          armies: 0,
          settlement: false,
      }));
  }

  getTileAt(hex) {
      return this.tiles.find(t => t.hex.equals(hex));
  }

  getNeighbors(hex) {
    return Array.from(this.grid.neighborsOf(hex));
  }

  isAdjacentToOwned(tile, playerId) {
    const neighbors = this.getNeighbors(tile.hex);
    return neighbors.some((neighbor) => {
      const neighborTile = this.getTileAt(neighbor);
      return neighborTile && neighborTile.owner === playerId;
    });
  }

  adjustScale(canvasWidth, canvasHeight) {
    const gridBounds = this.grid.bounds(); // Call bounds() as a method
    const gridWidth = gridBounds.width;
    const gridHeight = gridBounds.height;
    const padding = 50;
    const scaleX = (canvasWidth - padding * 2) / gridWidth;
    const scaleY = (canvasHeight - padding * 2) / gridHeight;
    this.scale = Math.min(scaleX, scaleY, 1);
  }
}

class Player {
  constructor(id, name, color) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.resources = { wood: 5, stone: 5, food: 5 };
    this.hexes = [];
    this.hasMovedArmy = false;
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
    return Object.entries(cost).every(
      ([resource, amount]) => this.resources[resource] >= amount
    );
  }

  spendResources(cost) {
    Object.entries(cost).forEach(([resource, amount]) => {
      this.resources[resource] -= amount;
    });
  }

  canExpandTo(tile, board) {
    return tile.owner === null && board.isAdjacentToOwned(tile, this.id);
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
      expandTerritory: document.getElementById("expandTerritory"),
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
    this.elements.lastRoll.textContent =
      die1 && die2 ? `${die1}, ${die2}` : "-";
  }

  showMessage(message, isError = false) {
    this.elements.actionInfo.textContent = message;
    this.elements.actionInfo.classList.toggle("error", isError);
    if (isError) {
      setTimeout(
        () => this.elements.actionInfo.classList.remove("error"),
        2000
      );
    }
  }

  updateButtonStates(phase, player, costs) {
    const disableAll =
      phase !== PHASES.ACTION &&
      phase !== PHASES.RESOURCE_COLLECTION &&
      phase !== PHASES.SETUP_SELECTION;
    this.elements.rollDice.disabled = phase !== PHASES.RESOURCE_COLLECTION;
    this.elements.buildArmy.disabled =
      disableAll || !player.canAfford(costs.army);
    this.elements.buildSettlement.disabled =
      disableAll || !player.canAfford(costs.settlement);
    this.elements.expandTerritory.disabled =
      disableAll || !player.canAfford(costs.territory);
    this.elements.moveArmy.disabled = disableAll || player.hasMovedArmy;
    this.elements.attack.disabled = disableAll;
    this.elements.undo.disabled = !this.undoAvailable;
    this.elements.endTurn.disabled = disableAll;
  }

  setUndoAvailable(available) {
    this.undoAvailable = available;
    this.elements.undo.disabled = !available;
  }
}

class HexGame {
  async init() {
    await this.loadAssets();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    const startMenu = document.getElementById("startMenu");
    const gameCanvas = document.getElementById("gameCanvas");
    const gameUI = document.getElementById("gameUI");
    if (startMenu && gameCanvas && gameUI) {
      startMenu.style.display = "block";
      gameCanvas.style.display = "none";
      gameUI.classList.add("hidden");
    } else {
      console.error("One or more elements not found:", {
        startMenu,
        gameCanvas,
        gameUI,
      });
    }
  }

constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.HEX_SIZE = 50;
    this.assets = {};
    this.board = null;
    this.players = [];
    this.currentPlayer = 0;
    this.state = {
        phase: PHASES.SETUP_SELECTION,
        selectedHex: null,
        moveFrom: null,
        dice: { die1: null, die2: null },
        setupPlayers: [],
    };
    this.ui = new UI();
    this.previousState = null;
    this.animationFrameId = null;

    // Initialize Hex factory
    this.Hex = Honeycomb.extendHex({
        size: this.HEX_SIZE,
        orientation: 'flat'
    });

    this.canvas.addEventListener("click", (e) => this.handleClick(e));
    this.setupUIHandlers();
    this.setupPlayerFields();
}

  async init() {
    await this.loadAssets();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    document.getElementById("startMenu").style.display = "block";
    document.getElementById("gameCanvas").style.display = "none";
    document.getElementById("gameUI").classList.add("hidden");
  }

  async loadAssets() {
    const assets = {
      grass: "assets/grass-hex.png",
      forest: "assets/forest-hex.png",
      mountain: "assets/mountain-hex.png",
      wood: "assets/wood.png",
      stone: "assets/stone.png",
      food: "assets/food.png",
      settlement: "assets/settlement.png",
      army: "assets/army.png",
    };

    await Promise.all(
      Object.entries(assets).map(
        ([key, file]) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              this.assets[key] = img;
              resolve();
            };
            img.onerror = () => reject(new Error(`Failed to load ${file}`));
            img.src = file;
          })
      )
    );
  }

  setupPlayerFields() {
    const updateFields = () => {
      const numPlayers = parseInt(document.getElementById("numPlayers").value);
      const container = document.getElementById("playerSetup");
      container.innerHTML = "";
      for (let i = 0; i < numPlayers; i++) {
        container.innerHTML += `
          <div class="player-field">
            <input type="text" id="player${i}name" placeholder="Player ${
          i + 1
        } Name" required>
            <input type="color" id="player${i}color" value="${this.getDefaultColor(
          i
        )}">
          </div>`;
      }
    };

    document
      .getElementById("numPlayers")
      .addEventListener("change", updateFields);
    updateFields();
  }

  getDefaultColor(index) {
    return ["#ff4444", "#44ff44", "#4444ff", "#ffff44"][index] || "#ffffff";
  }

  resizeCanvas() {
    const padding = 40;
    this.canvas.width = window.innerWidth - padding;
    this.canvas.height = window.innerHeight - padding;
    if (this.board) {
      this.board.adjustScale(this.canvas.width, this.canvas.height);
      this.render();
    }
  }

  setupUIHandlers() {
    document.getElementById("startGame").onclick = (e) => {
      e.preventDefault();
      const gridSize = parseInt(document.getElementById("gridSize").value);
      const numPlayers = parseInt(document.getElementById("numPlayers").value);
      const playersData = [];
      for (let i = 0; i < numPlayers; i++) {
        const name =
          document.getElementById(`player${i}name`).value || `Player ${i + 1}`;
        const color = document.getElementById(`player${i}color`).value;
        playersData.push({ name, color });
      }
      this.startGame(gridSize, playersData);
    };

    [
      "rollDice",
      "buildArmy",
      "buildSettlement",
      "expandTerritory",
      "moveArmy",
      "attack",
      "undo",
      "endTurn",
    ].forEach((id) => {
      this.ui.elements[id].addEventListener("click", () =>
        this.handleAction(id)
      );
    });
  }

  startGame(gridSize, playersData) {
    if (
      new Set(playersData.map((p) => p.name)).size !== playersData.length ||
      new Set(playersData.map((p) => p.color)).size !== playersData.length
    ) {
      alert("Player names and colors must be unique!");
      return;
    }

    this.Hex = Honeycomb.extendHex({ size: this.HEX_SIZE });
    this.board = new HexBoard(this.Hex, gridSize);
    this.players = playersData.map((p, i) => new Player(i, p.name, p.color));
    this.state.setupPlayers = [...this.players];
    this.state.phase = PHASES.SETUP_SELECTION;
    this.currentPlayer = 0;

    document.getElementById("startMenu").style.display = "none";
    document.getElementById("gameCanvas").style.display = "block";
    document.getElementById("gameUI").classList.remove("hidden");
    const startMenu = document.getElementById("startMenu");
    const gameCanvas = document.getElementById("gameCanvas");
    const gameUI = document.getElementById("gameUI");
    if (startMenu && gameCanvas && gameUI) {
      startMenu.style.display = "none";
      gameCanvas.style.display = "block";
      gameUI.classList.remove("hidden");
    } else {
      console.error("One or more elements not found:", {
        startMenu,
        gameCanvas,
        gameUI,
      });
    }
    this.updateUI();
    this.render();
  }

  handleAction(action) {
    switch (action) {
      case "rollDice":
        if (this.state.phase === PHASES.RESOURCE_COLLECTION)
          this.collectResources();
        break;
      case "buildArmy":
        if (this.state.phase === PHASES.ACTION)
          this.setPhase(PHASES.BUILD_ARMY);
        break;
      case "buildSettlement":
        if (this.state.phase === PHASES.ACTION)
          this.setPhase(PHASES.BUILD_SETTLEMENT);
        break;
      case "expandTerritory":
        if (this.state.phase === PHASES.ACTION)
          this.setPhase(PHASES.EXPAND_TERRITORY);
        break;
      case "moveArmy":
        if (this.state.phase === PHASES.ACTION) this.setPhase(PHASES.MOVE_ARMY);
        break;
      case "attack":
        if (this.state.phase === PHASES.ACTION) this.setPhase(PHASES.COMBAT);
        break;
      case "undo":
        this.undoLastAction();
        break;
      case "endTurn":
        this.endTurn();
        break;
    }
  }

  setPhase(phase) {
    this.state.phase = phase;
    this.ui.showMessage(this.getPhaseInstruction(phase));
    this.updateUI();
  }

  getPhaseInstruction(phase) {
    const instructions = {
      [PHASES.SETUP_SELECTION]: `${
        this.players[this.currentPlayer].name
      }: Choose your starting hex`,
      [PHASES.RESOURCE_COLLECTION]: "Roll dice to collect resources",
      [PHASES.ACTION]:
        "Choose an action: build, move armies, attack, or end turn",
      [PHASES.BUILD_ARMY]: "Select a hex to build an army",
      [PHASES.BUILD_SETTLEMENT]: "Select a hex to build a settlement",
      [PHASES.EXPAND_TERRITORY]: "Select an adjacent hex to expand territory",
      [PHASES.MOVE_ARMY]: "Select a hex with your army, then destination",
      [PHASES.COMBAT]:
        "Select a hex with your army to attack from, then enemy hex",
    };
    return instructions[phase] || "Select a hex to perform actions";
  }

  handleClick(event) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Convert canvas coordinates to hex grid coordinates
    const gridX = (mouseX - this.canvas.width / 2) / this.board.scale;
    const gridY = (mouseY - this.canvas.height / 2) / this.board.scale;

    // Convert point to hex coordinates
    const hex = this.Hex().pointToCoordinates({ x: gridX, y: gridY });
    const roundedHex = this.Hex().round(hex);

    // Find the tile using the rounded hex coordinates
    const clickedTile = this.board.tiles.find(
      (tile) => tile.hex.x === roundedHex.x && tile.hex.y === roundedHex.y
    );

    if (!clickedTile) return;

    switch (this.state.phase) {
      case PHASES.SETUP_SELECTION:
        this.handleSetupSelection(clickedTile);
        break;
      case PHASES.BUILD_ARMY:
        this.handleBuildArmy(clickedTile);
        break;
      case PHASES.BUILD_SETTLEMENT:
        this.handleBuildSettlement(clickedTile);
        break;
      case PHASES.EXPAND_TERRITORY:
        this.handleExpandTerritory(clickedTile);
        break;
      case PHASES.MOVE_ARMY:
        this.handleMoveArmy(clickedTile);
        break;
      case PHASES.COMBAT:
        this.handleCombat(clickedTile);
        break;
    }
    this.render();
  }

  isPointInHex(x, y, corners) {
    let inside = false;
    for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
      const { x: xi, y: yi } = corners[i];
      const { x: xj, y: yj } = corners[j];
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  handleSetupSelection(tile) {
    if (tile.owner !== null) {
      this.ui.showMessage("This hex is already taken!", true);
      return;
    }

    const player = this.players[this.currentPlayer];
    player.addHex(tile);
    tile.armies = 1;
    tile.settlement = true;

    this.state.setupPlayers.shift();
    if (this.state.setupPlayers.length > 0) {
      this.currentPlayer = this.state.setupPlayers[0].id;
    } else {
      this.state.phase = PHASES.RESOURCE_COLLECTION;
      this.currentPlayer = 0;
    }
    this.updateUI();
  }

  handleBuildArmy(tile) {
    const player = this.players[this.currentPlayer];
    if (tile.owner !== player.id) {
      this.ui.showMessage("You can only build on your own hexes!", true);
      return;
    }
    if (!player.canAfford(COSTS.army)) {
      this.ui.showMessage("Not enough resources for army!", true);
      return;
    }
    player.spendResources(COSTS.army);
    tile.armies += 1;
    this.setPhase(PHASES.ACTION);
    this.updateUI();
  }

  handleBuildSettlement(tile) {
    const player = this.players[this.currentPlayer];
    if (tile.owner !== player.id || tile.settlement) {
      this.ui.showMessage(
        "You can only build settlements on your own empty hexes!",
        true
      );
      return;
    }
    if (!player.canAfford(COSTS.settlement)) {
      this.ui.showMessage("Not enough resources for settlement!", true);
      return;
    }
    player.spendResources(COSTS.settlement);
    tile.settlement = true;
    this.setPhase(PHASES.ACTION);
    this.updateUI();
  }

  handleExpandTerritory(tile) {
    const player = this.players[this.currentPlayer];
    if (!player.canExpandTo(tile, this.board)) {
      this.ui.showMessage("Can only expand to adjacent unowned hexes!", true);
      return;
    }
    if (!player.canAfford(COSTS.territory)) {
      this.ui.showMessage("Not enough resources to expand!", true);
      return;
    }
    player.spendResources(COSTS.territory);
    player.addHex(tile);
    this.setPhase(PHASES.ACTION);
    this.updateUI();
  }

  handleMoveArmy(tile) {
    const player = this.players[this.currentPlayer];
    if (!this.state.moveFrom) {
      if (tile.owner !== player.id || tile.armies === 0) {
        this.ui.showMessage("Select a hex with your army to move from", true);
        return;
      }
      this.state.moveFrom = tile;
      this.ui.showMessage("Select a destination hex you own");
    } else {
      if (
        !this.isValidMove(this.state.moveFrom, tile) ||
        tile.owner !== player.id
      ) {
        this.ui.showMessage(
          "Invalid move - hexes must be adjacent and owned!",
          true
        );
        return;
      }
      this.moveArmy(this.state.moveFrom, tile);
      player.hasMovedArmy = true;
      this.state.moveFrom = null;
      this.setPhase(PHASES.ACTION);
      this.updateUI();
    }
  }

  isValidMove(from, to) {
    return this.board.getNeighbors(from.hex).some((n) => n.equals(to.hex));
  }

  moveArmy(from, to) {
    to.armies += 1;
    from.armies -= 1;
    if (from.armies === 0 && !from.settlement) {
      this.players[this.currentPlayer].removeHex(from);
    }
  }

  handleCombat(tile) {
    const player = this.players[this.currentPlayer];
    if (!this.state.moveFrom) {
      if (tile.owner !== player.id || tile.armies === 0) {
        this.ui.showMessage("Select a hex with your army to attack from", true);
        return;
      }
      this.state.moveFrom = tile;
      this.ui.showMessage("Select an enemy hex to attack");
    } else {
      if (!this.isValidAttackTarget(tile)) {
        this.ui.showMessage(
          "Invalid attack target - must be adjacent and enemy-owned!",
          true
        );
        return;
      }
      this.performCombat(this.state.moveFrom, tile);
      this.state.moveFrom = null;
      this.setPhase(PHASES.ACTION);
      this.updateUI();
    }
  }

  isValidAttackTarget(target) {
    return (
      target.owner !== this.currentPlayer &&
      this.board
        .getNeighbors(this.state.moveFrom.hex)
        .some((n) => n.equals(target.hex))
    );
  }

  performCombat(attacker, defender) {
    const attackRoll = Math.random() * attacker.armies + 1;
    const defendRoll = Math.random() * defender.armies + 1;
    if (attackRoll > defendRoll) {
      defender.owner = attacker.owner;
      defender.armies = Math.floor(attacker.armies / 2);
      attacker.armies = Math.ceil(attacker.armies / 2);
    } else {
      attacker.armies = Math.ceil(attacker.armies / 2);
      defender.armies = Math.floor(defender.armies * 0.75);
    }
  }

  collectResources() {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    this.state.dice = { die1, die2 };
    const player = this.players[this.currentPlayer];

    [die1, die2].forEach((roll) => {
      this.board.tiles.forEach((tile) => {
        if (tile.owner === player.id && tile.resourceValue === roll) {
          const bonus = tile.settlement ? 2 : 1;
          switch (tile.type) {
            case "forest":
              player.resources.wood += bonus;
              break;
            case "mountain":
              player.resources.stone += bonus;
              break;
            case "grass":
              player.resources.food += bonus;
              break;
          }
        }
      });
    });

    this.state.phase = PHASES.ACTION;
    this.updateUI();
    this.render();
  }

  endTurn() {
    const player = this.players[this.currentPlayer];
    player.hasMovedArmy = false;
    this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    this.state.phase = PHASES.RESOURCE_COLLECTION;
    this.state.moveFrom = null;
    this.state.dice = { die1: null, die2: null };
    this.ui.setUndoAvailable(false);
    this.updateUI();
    this.render();
  }

  undoLastAction() {
    if (!this.previousState) return;
    this.state = { ...this.previousState.state };
    this.board = new HexBoard(this.Hex, this.board.grid.width);
    this.board.tiles = this.previousState.board.tiles.map((t) => ({
      ...t,
      hex: this.Hex(t.hex.x, t.hex.y),
    }));
    this.players = this.previousState.players.map(
      (p) => new Player(p.id, p.name, p.color, p.resources, p.hexes)
    );
    this.ui.setUndoAvailable(false);
    this.updateUI();
    this.render();
  }

  updateUI() {
    const player = this.players[this.currentPlayer];
    this.ui.updatePlayerInfo(player);
    this.ui.updatePhase(this.state.phase);
    this.ui.updateLastRoll(this.state.dice.die1, this.state.dice.die2);
    this.ui.updateButtonStates(this.state.phase, player, COSTS);
    this.ui.showMessage(this.getPhaseInstruction(this.state.phase));
  }

  render() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.scale(this.board.scale, this.board.scale);

    this.board.tiles.forEach((tile) => {
      const point = tile.hex.toPoint();
      const corners = tile.hex.corners();
      const size = this.HEX_SIZE;
      const hexWidth = 2 * size;
      const hexHeight = Math.sqrt(3) * size;
      const imgX = point.x - hexWidth / 2;
      const imgY = point.y - hexHeight / 2;
      this.ctx.drawImage(
        this.assets[tile.type],
        imgX,
        imgY,
        hexWidth,
        hexHeight
      );

      // Draw hex outline
      this.ctx.beginPath();
      corners.forEach(({ x, y }, i) => {
        if (i === 0) this.ctx.moveTo(point.x + x, point.y + y);
        else this.ctx.lineTo(point.x + x, point.y + y);
      });
      this.ctx.closePath();
      this.ctx.strokeStyle =
        tile.owner !== null ? this.players[tile.owner].color : "#000";
      this.ctx.lineWidth = tile.owner !== null ? 3 : 1;
      this.ctx.stroke();

      // Clip and draw terrain image within hex bounds
      this.ctx.save();
      this.ctx.beginPath();
      corners.forEach(({ x, y }, i) => {
        if (i === 0) this.ctx.moveTo(point.x + x, point.y + y);
        else this.ctx.lineTo(point.x + x, point.y + y);
      });
      this.ctx.closePath();
      this.ctx.clip();

      const imageSize = Math.sqrt(3) * size;
      const imageX = point.x - imageSize / 2;
      const imageY = point.y - imageSize / 2;
      this.ctx.drawImage(
        this.assets[tile.type],
        imageX,
        imageY,
        imageSize,
        imageSize
      );
      this.ctx.restore();

      // Draw resource value
      this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      this.ctx.beginPath();
      this.ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "#000";
      this.ctx.font = "bold 16px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(tile.resourceValue, point.x, point.y);

      // Draw settlement and armies
      if (tile.settlement) {
        this.ctx.drawImage(
          this.assets.settlement,
          point.x - 15,
          point.y - 15,
          30,
          30
        );
      }
      if (tile.armies > 0) {
        this.ctx.drawImage(this.assets.army, point.x - 15, point.y + 5, 30, 30);
        this.ctx.fillText(tile.armies, point.x, point.y + 45);
      }

      // Highlight selected hex
      if (this.state.moveFrom === tile) {
        this.ctx.strokeStyle = "#fff";
        this.ctx.lineWidth = 4;
        this.ctx.stroke();
      }
    });

    this.ctx.restore();
    this.animationFrameId = requestAnimationFrame(() => this.render());
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const game = new HexGame();
  game.init().catch((err) => console.error("Error initializing game:", err));
});
