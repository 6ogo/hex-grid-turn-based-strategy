class HexGame extends Phaser.Scene {
    constructor() {
        super({ key: "HexGame" });
        this.HEX_SIZE = 35; // Increased from 25 for larger hexes
        this.Hex = Honeycomb.extendHex({
            size: this.HEX_SIZE,
            orientation: "flat",
        });
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
        this.ui = new UI(this); // Pass 'this' (HexGame instance) to UI
        this.previousState = null;
    }

    preload() {
        this.load.image("grass", "assets/grass-hex.png");
        this.load.image("forest", "assets/forest-hex.png");
        this.load.image("mountain", "assets/mountain-hex.png");
        this.load.image("settlement", "assets/settlement.png");
        this.load.image("army", "assets/army.png");
    }

    create() {
        const gridSize = this.game.registry.get("gridSize");
        const playersData = this.game.registry.get("playersData");

        this.board = new HexBoard(this.Hex, gridSize);
        this.players = playersData.map((p, i) => new Player(i, p.name, p.color));
        this.state.setupPlayers = [...this.players];

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        this.board.tiles.forEach((tile) => {
            const point = tile.hex.toPoint();
            const container = this.add.container(point.x, point.y);

            // Hex sprite with fixed size (scaled to fit within hex outline)
            const hexWidth = this.HEX_SIZE * 2; // Diameter of hex
            const hexHeight = Math.sqrt(3) * this.HEX_SIZE; // Height of hex
            const hexSprite = this.add.sprite(0, 0, tile.type);
            hexSprite.setOrigin(0.5, 0.5);
            hexSprite.setDisplaySize(hexWidth - 4, hexHeight - 4); // Slightly smaller than hex to show outline
            container.add(hexSprite);

            // Ownership overlay for hover (initially invisible)
            const ownerOverlay = this.add.rectangle(0, 0, hexWidth - 4, hexHeight - 4, 0x000000, 0);
            ownerOverlay.setOrigin(0.5, 0.5);
            ownerOverlay.setInteractive();
            ownerOverlay.on("pointerover", () => this.showOwnershipHover(tile, ownerOverlay));
            ownerOverlay.on("pointerout", () => this.hideOwnershipHover(ownerOverlay));
            container.add(ownerOverlay);

            // Resource value text (small and centered)
            tile.resourceText = this.add.text(0, 0, tile.resourceValue, {
                fontSize: "12px", // Slightly larger text
                color: "#fff",
                stroke: "#000",
                strokeThickness: 1,
            });
            tile.resourceText.setOrigin(0.5, 0.5);
            container.add(tile.resourceText);

            // Settlement sprite (larger and positioned inside hex)
            tile.settlementSprite = this.add.sprite(0, -15, "settlement"); // Adjusted Y for larger size
            tile.settlementSprite.setOrigin(0.5, 0.5);
            tile.settlementSprite.setDisplaySize(30, 30); // Larger max size (30x30 pixels)
            tile.settlementSprite.visible = tile.settlement;
            container.add(tile.settlementSprite);

            // Army sprite (larger and positioned inside hex)
            const armyY = tile.settlement ? 12 : -12; // Adjusted for larger size
            tile.armySprite = this.add.sprite(0, armyY, "army");
            tile.armySprite.setOrigin(0.5, 0.5);
            tile.armySprite.setDisplaySize(22, 22); // Larger max size (22x22 pixels)
            tile.armySprite.visible = tile.armies > 0;
            container.add(tile.armySprite);

            // Army count text (larger and positioned near army sprite)
            tile.armyText = this.add.text(0, armyY + 18, tile.armies, {
                fontSize: "10px", // Slightly larger text
                color: "#fff",
                stroke: "#000",
                strokeThickness: 1,
            });
            tile.armyText.setOrigin(0.5, 0.5);
            tile.armyText.visible = tile.armies > 0;
            container.add(tile.armyText);

            // Highlight graphics (thin outline for selection)
            tile.highlight = this.add.graphics({ x: 0, y: 0 });
            tile.highlight.lineStyle(2, 0xffffff, 1); // Thin white line
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

            tile.container = container;

            // Interactive area matches scaled hex
            hexSprite.setInteractive();
            hexSprite.on("pointerdown", () => this.handleHexClick(tile));

            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });

        // Adjust camera to fit grid within 800x600 canvas, ensuring no overlap
        const gridWidth = maxX - minX + this.HEX_SIZE * 2; // Add padding
        const gridHeight = maxY - minY + this.HEX_SIZE * 2;
        const zoomX = 800 / gridWidth; // Match canvas width
        const zoomY = 600 / gridHeight; // Match canvas height
        const zoom = Math.min(zoomX, zoomY, 1);
        this.cameras.main.setZoom(zoom);
        this.cameras.main.centerOn((minX + maxX) / 2, (minY + maxY) / 2);

        this.scale.on("resize", () => {
            const zoomX = 800 / gridWidth;
            const zoomY = 600 / gridHeight;
            const zoom = Math.min(zoomX, zoomY, 1);
            this.cameras.main.setZoom(zoom);
            this.cameras.main.centerOn((minX + maxX) / 2, (minY + maxY) / 2);
        });

        this.setupUIHandlers();
        this.updateUI();
    }

    showOwnershipHover(tile, overlay) {
        if (tile.owner !== null) {
            const player = this.players[tile.owner];
            overlay.fillColor = Phaser.Display.Color.ValueToColor(player.color).color;
            overlay.fillAlpha = 0.3; // Semi-transparent overlay
            overlay.visible = true; // Use Phaser visibility instead of classList
        }
    }

    hideOwnershipHover(overlay) {
        overlay.fillAlpha = 0; // Reset alpha instead of using classList
        overlay.visible = false; // Use Phaser visibility
    }

    updateTileDisplay(tile) {
        tile.settlementSprite.visible = tile.settlement;
        const armyY = tile.settlement ? 12 : -12;
        tile.armySprite.y = armyY;
        tile.armyText.y = armyY + 18;
        tile.armySprite.visible = tile.armies > 0;
        tile.armyText.setText(tile.armies);
        tile.armyText.visible = tile.armies > 0;
    }

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

    handleAction(action) {
        switch (action) {
            case "rollDice":
                if (this.state.phase === PHASES.RESOURCE_COLLECTION)
                    this.collectResources();
                break;
            case "buildArmy":
                if (this.state.phase === PHASES.ACTION)
                    this.handleBuildArmy(null); // Pass null to check globally
                break;
            case "buildSettlement":
                if (this.state.phase === PHASES.ACTION)
                    this.handleBuildSettlement(null); // Pass null to check globally
                break;
            case "expandTerritory":
                if (this.state.phase === PHASES.ACTION)
                    this.handleExpandTerritory(null); // Pass null to check globally
                break;
            case "moveArmy":
                if (this.state.phase === PHASES.ACTION)
                    this.setPhase(PHASES.MOVE_ARMY);
                break;
            case "attack":
                if (this.state.phase === PHASES.ACTION)
                    this.handleAttack(null); // Pass null to check globally
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
            [PHASES.EXPAND_TERRITORY]: "Select an adjacent unowned hex to expand territory",
            [PHASES.MOVE_ARMY]: "Select a hex with your army, then destination",
            [PHASES.COMBAT]: "Select a hex with your army to attack from, then enemy hex",
        };
        return instructions[phase] || "Select a hex to perform actions";
    }

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

    handleSetupSelection(tile) {
        if (tile.owner !== null) {
            this.ui.showMessage("This hex is already taken!", true);
            this.ui.showActionFeedback("Cannot select this hex - already owned.", false);
            return;
        }
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
            this.ui.showActionFeedback("Cannot select this hex - adjacent to owned territory.", false);
            return;
        }
        const player = this.players[this.currentPlayer];
        player.addHex(tile);
        tile.armies = 1;
        tile.settlement = true;
        this.updateTileDisplay(tile);
        this.ui.showActionFeedback(`Player ${player.name} claimed a starting hex!`);
        this.state.setupPlayers.shift();
        if (this.state.setupPlayers.length > 0) {
            this.currentPlayer = this.state.setupPlayers[0].id;
        } else {
            this.state.phase = PHASES.RESOURCE_COLLECTION;
            this.currentPlayer = 0;
        }
        this.updateUI();
    }

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

    handleBuildArmy(tile) {
        const player = this.players[this.currentPlayer];
        if (tile) {
            this.saveState();
            if (tile.owner !== player.id) {
                this.ui.showMessage("You can only build on your own hexes!", true);
                this.ui.showActionFeedback("Cannot build army - not your hex.", false);
                return;
            }
            if (!player.canAfford(COSTS.army)) {
                this.ui.showMessage("Not enough resources for army!", true);
                this.ui.showActionFeedback("Cannot build army - insufficient resources.", false);
                return;
            }
            player.spendResources(COSTS.army);
            tile.armies += 1;
            this.updateTileDisplay(tile);
            this.ui.showActionFeedback(`Player ${player.name} built an army!`);
            this.setPhase(PHASES.ACTION);
        } else {
            // Check if action is possible globally
            if (!player.hexes.some(t => player.canAfford(COSTS.army))) {
                this.ui.showMessage("Not enough resources to build an army!", true);
                this.ui.showActionFeedback("Cannot build army - insufficient resources.", false);
                return;
            }
            this.setPhase(PHASES.BUILD_ARMY);
        }
        this.updateUI();
    }

    handleBuildSettlement(tile) {
        const player = this.players[this.currentPlayer];
        if (tile) {
            this.saveState();
            if (tile.owner !== player.id || tile.settlement) {
                this.ui.showMessage(
                    "You can only build settlements on your own empty hexes!",
                    true
                );
                this.ui.showActionFeedback("Cannot build settlement - not your empty hex.", false);
                return;
            }
            if (!player.canAfford(COSTS.settlement)) {
                this.ui.showMessage("Not enough resources for settlement!", true);
                this.ui.showActionFeedback("Cannot build settlement - insufficient resources.", false);
                return;
            }
            player.spendResources(COSTS.settlement);
            tile.settlement = true;
            this.updateTileDisplay(tile);
            this.ui.showActionFeedback(`Player ${player.name} built a settlement!`);
            this.setPhase(PHASES.ACTION);
        } else {
            // Check if action is possible globally
            if (!player.hexes.some(t => !t.settlement && player.canAfford(COSTS.settlement))) {
                this.ui.showMessage("Not enough resources or no valid hex for settlement!", true);
                this.ui.showActionFeedback("Cannot build settlement - insufficient resources or no valid hex.", false);
                return;
            }
            this.setPhase(PHASES.BUILD_SETTLEMENT);
        }
        this.updateUI();
    }

    handleExpandTerritory(tile) {
        const player = this.players[this.currentPlayer];
        if (tile) {
            this.saveState();
            if (!player.canExpandTo(tile, this.board)) {
                this.ui.showMessage("Can only expand to adjacent unowned hexes!", true);
                this.ui.showActionFeedback("Cannot expand - not an adjacent unowned hex.", false);
                return;
            }
            if (!player.canAfford(COSTS.territory)) {
                this.ui.showMessage("Not enough resources to expand!", true);
                this.ui.showActionFeedback("Cannot expand - insufficient resources.", false);
                return;
            }
            player.spendResources(COSTS.territory);
            player.addHex(tile);
            this.updateTileDisplay(tile);
            this.ui.showActionFeedback(`Player ${player.name} expanded territory!`);
            this.setPhase(PHASES.ACTION);
        } else {
            // Check if action is possible globally
            if (!this.ui.canExpand(player, this.board)) { // Pass board explicitly
                this.ui.showMessage("Cannot expand - no valid adjacent unowned hex or insufficient resources!", true);
                this.ui.showActionFeedback("Cannot expand - no valid adjacent unowned hex or insufficient resources.", false);
                return;
            }
            this.setPhase(PHASES.EXPAND_TERRITORY);
        }
        this.updateUI();
    }

    handleMoveArmy(tile) {
        const player = this.players[this.currentPlayer];
        if (!this.state.moveFrom) {
            if (tile.owner !== player.id || tile.armies === 0) {
                this.ui.showMessage("Select a hex with your army to move from", true);
                this.ui.showActionFeedback("Cannot move - no army in this hex or not your hex.", false);
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
                this.ui.showActionFeedback("Cannot move - invalid destination.", false);
                return;
            }
            this.saveState();
            this.moveArmy(this.state.moveFrom, tile);
            player.hasMovedArmy = true;
            this.state.moveFrom.highlight.visible = false;
            this.state.moveFrom = null;
            this.ui.showActionFeedback(`Player ${player.name} moved an army!`);
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
        this.updateTileDisplay(from);
        this.updateTileDisplay(to);
    }

    handleAttack(tile) {
        const player = this.players[this.currentPlayer];
        if (tile) {
            this.saveState();
            if (!this.isValidAttackTarget(tile)) {
                this.ui.showMessage(
                    "Invalid attack target - must be adjacent and enemy-owned!",
                    true
                );
                this.ui.showActionFeedback("Cannot attack - not an adjacent enemy hex.", false);
                return;
            }
            this.performCombat(this.state.moveFrom, tile);
            this.state.moveFrom.highlight.visible = false;
            this.state.moveFrom = null;
            this.ui.showActionFeedback(`Player ${player.name} attacked an enemy territory!`);
            this.setPhase(PHASES.ACTION);
        } else {
            // Check if action is possible globally
            if (!this.ui.canAttack(player, this.board)) { // Pass board explicitly
                this.ui.showMessage("Cannot attack - no armies or no enemy targets!", true);
                this.ui.showActionFeedback("Cannot attack - no armies or no enemy targets.", false);
                return;
            }
            this.setPhase(PHASES.COMBAT);
        }
        this.updateUI();
    }

    isValidAttackTarget(target) {
        const player = this.players[this.currentPlayer];
        return (
            target.owner !== player.id && // Ensure it's an enemy
            target.owner !== null && // Not unowned (for expansion)
            this.board
                .getNeighbors(target.hex)
                .some((n) => {
                    const neighborTile = this.board.getTileAt(n);
                    return neighborTile && neighborTile.owner === player.id && neighborTile.armies > 0;
                })
        );
    }

    handleCombat(tile) {
        const player = this.players[this.currentPlayer];
        if (!this.state.moveFrom) {
            if (tile.owner !== player.id || tile.armies === 0) {
                this.ui.showMessage("Select a hex with your army to attack from", true);
                this.ui.showActionFeedback("Cannot attack - no army in this hex or not your hex.", false);
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
                this.ui.showActionFeedback("Cannot attack - not an adjacent enemy hex.", false);
                return;
            }
            this.performCombat(this.state.moveFrom, tile);
            this.state.moveFrom.highlight.visible = false;
            this.state.moveFrom = null;
            this.ui.showActionFeedback(`Player ${player.name} attacked an enemy territory!`);
            this.setPhase(PHASES.ACTION);
            this.updateUI();
        }
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
        this.updateTileDisplay(attacker);
        this.updateTileDisplay(defender);
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

        this.ui.showActionFeedback(`Player ${player.name} collected resources!`);
        this.state.phase = PHASES.ACTION;
        this.updateUI();
    }

    endTurn() {
        const player = this.players[this.currentPlayer];
        player.hasMovedArmy = false;
        this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
        this.state.phase = PHASES.RESOURCE_COLLECTION;
        this.state.moveFrom = null;
        this.state.dice = { die1: null, die2: null };
        this.ui.setUndoAvailable(false);
        this.board.tiles.forEach((tile) => {
            tile.highlight.visible = false;
        });
        this.ui.showActionFeedback(`Player ${player.name}'s turn ended.`);
        this.updateUI();
    }

    undoLastAction() {
        if (!this.previousState) return;

        this.board.tiles.forEach((tile, i) => {
            const savedTile = this.previousState.board.tiles[i];
            tile.type = savedTile.type;
            tile.resourceValue = savedTile.resourceValue;
            tile.owner = savedTile.owner;
            tile.armies = savedTile.armies;
            tile.settlement = savedTile.settlement;
        });

        this.players.forEach((player, i) => {
            const savedPlayer = this.previousState.players[i];
            player.resources = { ...savedPlayer.resources };
            player.hexes = savedPlayer.hexes.map((index) => this.board.tiles[index]);
            player.hasMovedArmy = savedPlayer.hasMovedArmy;
        });

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

        this.board.tiles.forEach((tile) => {
            this.updateTileDisplay(tile);
        });

        this.board.tiles.forEach((tile) => {
            tile.highlight.visible = false;
        });
        if (this.state.moveFrom) {
            this.state.moveFrom.highlight.visible = true;
        }

        this.ui.showActionFeedback("Last action undone.");
        this.updateUI();
    }

    updateUI() {
        const player = this.players[this.currentPlayer];
        this.ui.updatePlayerInfo(player);
        this.ui.updatePhase(this.state.phase);
        this.ui.updateLastRoll(this.state.dice.die1, this.state.dice.die2);
        this.ui.updateButtonStates(this.state.phase, player, COSTS, this.board); // Pass board explicitly
        this.ui.showMessage(this.getPhaseInstruction(this.state.phase));
    }
}