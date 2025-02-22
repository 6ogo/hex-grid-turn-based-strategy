class HexBoard {
    constructor(hexFactory, gridSize) {
        this.factory = hexFactory;
        // Create a rectangular hex grid using Honeycomb
        this.grid = Honeycomb.defineGrid(hexFactory).rectangle({
            width: gridSize,
            height: gridSize,
        });
        this.tiles = this.initializeTiles();
    }

    // Initialize tiles with terrain types and resource values
    initializeTiles() {
        return Array.from(this.grid).map((hex) => ({
            hex,
            type: ["grass", "forest", "mountain"][Math.floor(Math.random() * 3)],
            resourceValue: Math.floor(Math.random() * 6) + 1,
            owner: null,
            armies: 0,
            settlement: false,
            // Will be populated by Phaser objects in HexGame
            container: null,
            resourceText: null,
            settlementSprite: null,
            armySprite: null,
            armyText: null,
            highlight: null,
        }));
    }

    // Find a tile at specific hex coordinates
    getTileAt(hex) {
        return this.tiles.find((t) => t.hex.equals(hex));
    }

    // Get neighboring hexes of a given hex
    getNeighbors(hex) {
        return Array.from(this.grid.neighborsOf(hex));
    }

    // Check if a tile is adjacent to any hex owned by the player
    isAdjacentToOwned(tile, playerId) {
        const neighbors = this.getNeighbors(tile.hex);
        return neighbors.some((neighbor) => {
            const neighborTile = this.getTileAt(neighbor);
            return neighborTile && neighborTile.owner === playerId;
        });
    }
}