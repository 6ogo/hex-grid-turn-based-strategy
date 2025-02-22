class Player {
    constructor(id, name, color) {
        this.id = id;
        this.name = name;
        this.color = color;
        // Starting resources
        this.resources = { wood: 5, stone: 5, food: 5 };
        this.hexes = [];
        this.hasMovedArmy = false;
    }

    // Add a hex to the player's owned hexes
    addHex(tile) {
        this.hexes.push(tile);
        tile.owner = this.id;
    }

    // Remove a hex from the player's owned hexes
    removeHex(tile) {
        this.hexes = this.hexes.filter((h) => h !== tile);
        tile.owner = null;
    }

    // Check if the player can afford a cost
    canAfford(cost) {
        return Object.entries(cost).every(
            ([resource, amount]) => this.resources[resource] >= amount
        );
    }

    // Spend resources for an action
    spendResources(cost) {
        Object.entries(cost).forEach(([resource, amount]) => {
            this.resources[resource] -= amount;
        });
    }

    // Check if the player can expand to a tile
    canExpandTo(tile, board) {
        return tile.owner === null && board.isAdjacentToOwned(tile, this.id);
    }
}