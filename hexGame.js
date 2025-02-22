class HexGame extends Phaser.Scene {
    constructor() {
        super({ key: "HexGame" });
        // Hex size for Honeycomb grid
        this.HEX_SIZE = 50;
        // Extend Honeycomb hex factory
        this.Hex = Honeycomb.extendHex({
            size: this.HEX_SIZE,
            orientation: "flat",
        });
        this.board = null;
        this.players = [];
        this.currentPlayer = 0;
        // Game state
        this.state = {
            phase: PHASES.SETUP_SELECTION,
            selectedHex: null,
            moveFrom: null,
            dice: { die1: null, die2: null },
            setupPlayers: [],
        };
        this.ui = new UI();
        this.previousState = null;
    }

    // Load game assets
    preload() {
        this.load.image("grass", "assets/grass-hex.png");
        this.load.image("forest", "assets/forest-hex.png");
        this.load.image("mountain", "assets/mountain-hex.png");
        this.load.image("settlement", "assets/settlement.png");
        this.load.image("army", "assets/army.png");
    }

    // Initialize the game scene
    create() {
        // Retrieve game settings from registry
        const gridSize = this.game.registry.get("gridSize");
        const playersData = this.game.registry.get("playersData");

        // Initialize board and players
        this.board = new HexBoard(this.Hex, gridSize);
        this.players = playersData.map((p, i) => new Player(i, p.name, p.color));
        this.state.setupPlayers = [...this.players];

        // Variables to calculate grid bounds for camera
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        // Set up hex grid display using Phaser
        this.board.tiles.forEach((tile) => {
            // Get pixel coordinates for the hex
            const point = tile.hex.toPoint();
            // Create a container for all elements of the tile
            const container = this.add.container(point.x, point.y);

            // Create hex sprite
            const hexSprite = this.add.sprite(0, 0, tile.type);
            hexSprite.setOrigin(0.5, 0.5);
            container.add(hexSprite);

            // Create resource value text
            tile.resourceText = this.add.text(0, 0, tile.resourceValue, {
                fontSize: "16px",
                color: "#fff",
                stroke: "#000",
                strokeThickness: 2,
            });
            tile.resourceText.setOrigin(0.5, 0.5);
            container.add(tile.resourceText);

            // Create settlement sprite (initially hidden if no settlement)
            tile.settlementSprite = this.add.sprite(0, -25, "settlement");
            tile.settlementSprite.setOrigin(0.5, 0.5);
            tile.settlementSprite.visible = tile.settlement;
            container.add(tile.settlementSprite);

            // Calculate army position based on settlement presence
            const armyY = tile.settlement ? 10 : -15;
            // Create army sprite (initially hidden if no armies)
            tile.armySprite = this.add.sprite(0, armyY, "army");
            tile.armySprite.setOrigin(0.5, 0.5);
            tile.armySprite.visible = tile.armies > 0;
            container.add(tile.armySprite);

            // Create army count text (initially hidden if no armies)
            tile.armyText = this.add.text(0, armyY + 35, tile.armies, {
                fontSize: "16px",
                color: "#fff",
                stroke: "#000",
                strokeThickness: 2,
            });
            tile.armyText.setOrigin(0.5, 0.5);
            tile.armyText.visible = tile.armies > 0;
            container.add(tile.armyText);

            // Create highlight graphics for selected hexes
            tile.highlight = this.add.graphics({ x: 0, y: 0 });
            tile.highlight.lineStyle(4, 0xffffff, 1);
            const corners = tile.hex.corners();
            tile.highlight.beginPath();
            corners.forEach((corner, i) => {
                if (i === 0) tile.highlight.moveTo(corner.x, corner.y);
                else tile.highlight.lineTo(corner.x, corner.y);
            });
            tile.highlight.closePath();
            tile.highlight.strokePath();
            tile.highlight.visible = false;
            container.add(tile.highlight);

            // Store container in tile for reference
            tile.container = container;

            // Make hex sprite interactive for clicks
            hexSprite.setInteractive();
            hexSprite.on("pointerdown", () => this.handleHexClick(tile));

            // Update grid bounds for camera positioning
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });

        // Set camera zoom and center to fit the grid
        const gridWidth = maxX - minX;
        const gridHeight = maxY - minY;
        const zoomX = this.scale.width / gridWidth;
        const zoomY = this.scale.height / gridHeight;
        const zoom = Math.min(zoomX, zoomY, 1);
        this.cameras.main.setZoom(zoom);
        this.cameras.main.centerOn((minX + maxX) / 2, (minY + maxY) / 2);

        // Handle window resizing
        this.scale.on("resize", () => {
            const zoomX = this.scale.width / gridWidth;
            const zoomY = this.scale.height / gridHeight;
            const zoom = Math.min(zoomX, zoomY, 1);
            this.cameras.main.setZoom(zoom);
            this.cameras.main.centerOn((minX + maxX) / 2, (minY + maxY) / 2);
        });

        // Set up UI handlers
        this.setupUIHandlers();
        // Update UI to reflect initial state
        this.updateUI();
    }

    // Set up UI button event listeners
    setupUIHandlers() {
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

    // Handle button actions
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
                if (this.state.phase === PHASES.ACTION)
                    this.setPhase(PHASES.MOVE_ARMY);
                break;
            case "attack":
                if (this.state.phase === PHASES.ACTION)
                    this.setPhase(PHASES.COMBAT);
                break;
            case "undo":
                this.undoLastAction();
                break;
            case "endTurn":
                this.endTurn();
                break;
        }
    }

    // Set the current game phase and update UI
    setPhase(phase) {
        this.state.phase = phase;
        this.ui.showMessage(this.getPhaseInstruction(phase));
        this.updateUI();
    }

    // Get instruction text for the current phase
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

    // Handle hex clicks based on the current phase
    handleHexClick(tile) {
        switch (this.state.phase) {
            case PHASES.SETUP_SELECTION:
                this.handleSetupSelection(tile);
                break;
            case PHASES.BUILD_ARMY:
                this.handleBuildArmy(tile);
                break;
            case PHASES.BUILD_SETTLEMENT:
                this.handleBuildSettlement(tile);
                break;
            case PHASES.EXPAND_TERRITORY:
                this.handleExpandTerritory(tile);
                break;
            case PHASES.MOVE_ARMY:
                this.handleMoveArmy(tile);
                break;
            case PHASES.COMBAT:
                this.handleCombat(tile);
                break;
        }
    }

    // Handle setup phase hex selection
    handleSetupSelection(tile) {
        if (tile.owner !== null) {
            this.ui.showMessage("This hex is already taken!", true);
            return;
        }
        // Check for adjacency to other owned hexes
        const neighbors = this.board.getNeighbors(tile.hex);
        const isAdjacentToOwned = neighbors.some((neighbor) => {
            const neighborTile = this.board.getTileAt(neighbor);
            return neighborTile && neighborTile.owner !== null;
        });
        if (isAdjacentToOwned) {
            this.ui.showMessage(
                "Cannot choose a hex adjacent to another player's starting hex!",
                true
            );
            return;
        }
        const player = this.players[this.currentPlayer];
        player.addHex(tile);
        tile.armies = 1;
        tile.settlement = true;
        // Update tile display
        this.updateTileDisplay(tile);
        this.state.setupPlayers.shift();
        if (this.state.setupPlayers.length > 0) {
            this.currentPlayer = this.state.setupPlayers[0].id;
        } else {
            this.state.phase = PHASES.RESOURCE_COLLECTION;
            this.currentPlayer = 0;
        }
        this.updateUI();
    }

    // Handle building an army on a hex
    handleBuildArmy(tile) {
        this.saveState();
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
        this.updateTileDisplay(tile);
        this.setPhase(PHASES.ACTION);
        this.updateUI();
    }

    // Handle building a settlement on a hex
    handleBuildSettlement(tile) {
        this.saveState();
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
        this.updateTileDisplay(tile);
        this.setPhase(PHASES.ACTION);
        this.updateUI();
    }

    // Handle expanding territory to a new hex
    handleExpandTerritory(tile) {
        this.saveState();
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
        this.updateTileDisplay(tile);
        this.setPhase(PHASES.ACTION);
        this.updateUI();
    }

    // Handle moving armies between hexes
    handleMoveArmy(tile) {
        const player = this.players[this.currentPlayer];
        if (!this.state.moveFrom) {
            if (tile.owner !== player.id || tile.armies === 0) {
                this.ui.showMessage("Select a hex with your army to move from", true);
                return;
            }
            this.state.moveFrom = tile;
            tile.highlight.visible = true;
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
            this.saveState();
            this.moveArmy(this.state.moveFrom, tile);
            player.hasMovedArmy = true;
            this.state.moveFrom.highlight.visible = false;
            this.state.moveFrom = null;
            this.setPhase(PHASES.ACTION);
            this.updateUI();
        }
    }

    // Check if a move is valid (adjacent hexes)
    isValidMove(from, to) {
        return this.board.getNeighbors(from.hex).some((n) => n.equals(to.hex));
    }

    // Move armies from one hex to another
    moveArmy(from, to) {
        to.armies += 1;
        from.armies -= 1;
        if (from.armies === 0 && !from.settlement) {
            this.players[this.currentPlayer].removeHex(from);
        }
        this.updateTileDisplay(from);
        this.updateTileDisplay(to);
    }

    // Handle combat actions
    handleCombat(tile) {
        const player = this.players[this.currentPlayer];
        if (!this.state.moveFrom) {
            if (tile.owner !== player.id || tile.armies === 0) {
                this.ui.showMessage("Select a hex with your army to attack from", true);
                return;
            }
            this.state.moveFrom = tile;
            tile.highlight.visible = true;
            this.ui.showMessage("Select an enemy hex to attack");
        } else {
            if (!this.isValidAttackTarget(tile)) {
                this.ui.showMessage(
                    "Invalid attack target - must be adjacent and enemy-owned!",
                    true
                );
                return;
            }
            this.saveState();
            this.performCombat(this.state.moveFrom, tile);
            this.state.moveFrom.highlight.visible = false;
            this.state.moveFrom = null;
            this.setPhase(PHASES.ACTION);
            this.updateUI();
        }
    }

    // Check if an attack target is valid
    isValidAttackTarget(target) {
        return (
            target.owner !== this.currentPlayer &&
            this.board
                .getNeighbors(this.state.moveFrom.hex)
                .some((n) => n.equals(target.hex))
        );
    }

    // Perform combat between hexes
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
        this.updateTileDisplay(attacker);
        this.updateTileDisplay(defender);
    }

    // Collect resources based on dice rolls
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
    }

    // End the current player's turn
    endTurn() {
        const player = this.players[this.currentPlayer];
        player.hasMovedArmy = false;
        this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
        this.state.phase = PHASES.RESOURCE_COLLECTION;
        this.state.moveFrom = null;
        this.state.dice = { die1: null, die2: null };
        this.ui.setUndoAvailable(false);
        // Clear any highlights
        this.board.tiles.forEach((tile) => {
            tile.highlight.visible = false;
        });
        this.updateUI();
    }

    // Save the current game state for undo
    saveState() {
        this.previousState = {
            board: {
                tiles: this.board.tiles.map((t) => ({
                    hex: t.hex,
                    type: t.type,
                    resourceValue: t.resourceValue,
                    owner: t.owner,
                    armies: t.armies,
                    settlement: t.settlement,
                })),
                gridSize: this.board.grid.width,
            },
            players: this.players.map((p) => ({
                id: p.id,
                name: p.name,
                color: p.color,
                resources: { ...p.resources },
                hexes: p.hexes.map((t) => this.board.tiles.indexOf(t)),
                hasMovedArmy: p.hasMovedArmy,
            })),
            currentPlayer: this.currentPlayer,
            state: {
                phase: this.state.phase,
                selectedHex: this.board.tiles.indexOf(this.state.selectedHex),
                moveFrom: this.board.tiles.indexOf(this.state.moveFrom),
                dice: { ...this.state.dice },
                setupPlayers: this.state.setupPlayers.map((p) => ({
                    id: p.id,
                    name: p.name,
                    color: p.color,
                })),
            },
        };
        this.ui.setUndoAvailable(true);
    }

    // Undo the last action
    undoLastAction() {
        if (!this.previousState) return;

        // Restore board state
        this.board.tiles.forEach((tile, i) => {
            const savedTile = this.previousState.board.tiles[i];
            tile.type = savedTile.type;
            tile.resourceValue = savedTile.resourceValue;
            tile.owner = savedTile.owner;
            tile.armies = savedTile.armies;
            tile.settlement = savedTile.settlement;
        });

        // Restore players
        this.players.forEach((player, i) => {
            const savedPlayer = this.previousState.players[i];
            player.resources = { ...savedPlayer.resources };
            player.hexes = savedPlayer.hexes.map((index) => this.board.tiles[index]);
            player.hasMovedArmy = savedPlayer.hasMovedArmy;
        });

        // Restore game state
        this.currentPlayer = this.previousState.currentPlayer;
        this.state = {
            phase: this.previousState.state.phase,
            selectedHex:
                this.previousState.state.selectedHex !== undefined &&
                this.previousState.state.selectedHex !== null
                    ? this.board.tiles[this.previousState.state.selectedHex]
                    : null,
            moveFrom:
                this.previousState.state.moveFrom !== undefined &&
                this.previousState.state.moveFrom !== null
                    ? this.board.tiles[this.previousState.state.moveFrom]
                    : null,
            dice: { ...this.previousState.state.dice },
            setupPlayers: this.previousState.state.setupPlayers.map((p) => {
                return this.players.find((player) => player.id === p.id);
            }),
        };

        // Update display for all tiles
        this.board.tiles.forEach((tile) => {
            this.updateTileDisplay(tile);
        });

        // Update highlights
        this.board.tiles.forEach((tile) => {
            tile.highlight.visible = false;
        });
        if (this.state.moveFrom) {
            this.state.moveFrom.highlight.visible = true;
        }

        this.updateUI();
    }

    // Update the display of a tile in Phaser
    updateTileDisplay(tile) {
        tile.settlementSprite.visible = tile.settlement;
        const armyY = tile.settlement ? 10 : -15;
        tile.armySprite.y = armyY;
        tile.armyText.y = armyY + 35;
        tile.armySprite.visible = tile.armies > 0;
        tile.armyText.setText(tile.armies);
        tile.armyText.visible = tile.armies > 0;
    }

    // Update the UI to reflect current game state
    updateUI() {
        const player = this.players[this.currentPlayer];
        this.ui.updatePlayerInfo(player);
        this.ui.updatePhase(this.state.phase);
        this.ui.updateLastRoll(this.state.dice.die1, this.state.dice.die2);
        this.ui.updateButtonStates(this.state.phase, player, COSTS);
        this.ui.showMessage(this.getPhaseInstruction(this.state.phase));
    }
}