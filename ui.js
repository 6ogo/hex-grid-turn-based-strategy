class UI {
    constructor(gameInstance) {
        this.game = gameInstance; // Store the HexGame instance
        this.elements = {
            playerName: document.getElementById("playerName"),
            wood: document.getElementById("wood"),
            stone: document.getElementById("stone"),
            food: document.getElementById("food"),
            phase: document.getElementById("phase"),
            lastRoll: document.getElementById("lastRoll"),
            actionInfo: document.getElementById("actionInfo"),
            actionFeedback: document.getElementById("actionFeedback"), // New element for feedback
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

    showActionFeedback(message, isSuccess = true) {
        this.elements.actionFeedback.textContent = message;
        this.elements.actionFeedback.style.color = isSuccess ? "#4CAF50" : "#ff4444";
        setTimeout(() => (this.elements.actionFeedback.textContent = ""), 3000); // Clear after 3 seconds
    }

    updateButtonStates(phase, player, costs, board) {
        const disableAll =
            phase !== PHASES.ACTION &&
            phase !== PHASES.RESOURCE_COLLECTION &&
            phase !== PHASES.SETUP_SELECTION;
        const canMove = !disableAll && !player.hasMovedArmy;
        const canAttack = !disableAll && player.hexes.some(t => t.armies > 0);

        this.elements.rollDice.disabled = phase !== PHASES.RESOURCE_COLLECTION;
        this.elements.buildArmy.disabled =
            disableAll || !player.canAfford(costs.army);
        this.elements.buildSettlement.disabled =
            disableAll || !player.canAfford(costs.settlement);
        this.elements.expandTerritory.disabled =
            disableAll || !player.canAfford(costs.territory) || !this.canExpand(player, board);
        this.elements.moveArmy.disabled = !canMove;
        this.elements.attack.disabled = !canAttack || !this.canAttack(player, board);
        this.elements.undo.disabled = !this.undoAvailable;
        this.elements.endTurn.disabled = disableAll;
    }

    setUndoAvailable(available) {
        this.undoAvailable = available;
        this.elements.undo.disabled = !available;
    }

    // Helper to check if player can expand to an unowned adjacent hex
    canExpand(player, board) {
        return board.tiles.some(tile => 
            tile.owner === null && 
            board.isAdjacentToOwned(tile, player.id) && 
            player.canAfford(COSTS.territory)
        );
    }

    // Helper to check if player can attack an enemy territory
    canAttack(player, board) {
        return board.tiles.some(tile => 
            tile.owner !== player.id && 
            tile.owner !== null && // Ensure it's an enemy, not unowned
            board.getNeighbors(tile.hex).some(neighbor => {
                const neighborTile = board.getTileAt(neighbor);
                return neighborTile && neighborTile.owner === player.id && neighborTile.armies > 0;
            })
        );
    }
}