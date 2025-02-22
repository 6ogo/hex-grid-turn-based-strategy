class UI {
    constructor() {
        // Store references to HTML elements
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

    // Update player information in the UI
    updatePlayerInfo(player) {
        this.elements.playerName.textContent = player.name;
        this.elements.playerName.style.color = player.color;
        this.elements.wood.textContent = player.resources.wood;
        this.elements.stone.textContent = player.resources.stone;
        this.elements.food.textContent = player.resources.food;
    }

    // Update the current phase display
    updatePhase(phase) {
        this.elements.phase.textContent = phase;
    }

    // Update the last dice roll display
    updateLastRoll(die1, die2) {
        this.elements.lastRoll.textContent =
            die1 && die2 ? `${die1}, ${die2}` : "-";
    }

    // Show a message in the action info area
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

    // Update button states based on phase and player resources
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

    // Set whether undo is available
    setUndoAvailable(available) {
        this.undoAvailable = available;
        this.elements.undo.disabled = !available;
    }
}