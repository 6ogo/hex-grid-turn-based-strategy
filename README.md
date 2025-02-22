# Game Concept and Mechanics
- Board: A hex grid where each hex produces resources (e.g., wood, stone, food) or serves as a territory.
- Players: 2–4 players take turns locally on the same device (local multiplayer).
- Resources: Players collect resources from hexes they control, based on a dice roll 
- Units: Players build and move armies to conquer hexes.
- Actions: Build structures (e.g., settlements), move armies, trade resources, or attack.
- Victory: Control a set number of hexes (e.g., 10) or eliminate opponents.

# Core Mechanics
- Turns: Sequential turns for each player.
- Resources: Roll a die (1–6) each turn; hexes with that number produce resources for their controller.
- Building: Spend resources to build settlements (cost: 2 wood, 1 stone) or armies (cost: 1 food, 1 wood).
- Combat: Compare army strength + a dice roll; winner takes the hex.
- Trading: Offer resources to other players during your turn.

# Files
- *Index.html:* main HTML file that sets up the game interface and links to the Phaser library and game scripts.
- *styles.css:* Basic styling for the game UI.
- *constants.js:* Defines game constants for phases and costs.
- *hexBoard.js:* Manages the hex grid using the Honeycomb library. Rendering is moved to Phaser, so this class only handles tile data.
- *player.js:* Manages player data and actions.
- *ui.js:* Manages the HTML-based UI, updated from the Phaser scene.
- *hexGame.js:* The main game logic, now implemented as a Phaser scene.
- *main.js:* Initializes the game and handles the start menu.