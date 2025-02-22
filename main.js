document.addEventListener("DOMContentLoaded", () => {
    // Handle player setup fields based on number of players
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
                    <input type="color" id="player${i}color" value="${getDefaultColor(i)}">
                </div>`;
        }
    };

    // Default player colors
    const getDefaultColor = (index) => {
        return ["#ff4444", "#44ff44", "#4444ff", "#ffff44"][index] || "#ffffff";
    };

    document
        .getElementById("numPlayers")
        .addEventListener("change", updateFields);
    updateFields();

    // Start game button handler
    document.getElementById("startGame").addEventListener("click", (e) => {
        e.preventDefault();
        const gridSize = parseInt(document.getElementById("gridSize").value);
        const numPlayers = parseInt(document.getElementById("numPlayers").value);
        const playersData = [];
        for (let i = 0; i < numPlayers; i++) {
            const name =
                document.getElementById(`player${i}name`).value ||
                `Player ${i + 1}`;
            const color = document.getElementById(`player${i}color`).value;
            playersData.push({ name, color });
        }

        // Validate player names and colors
        if (
            new Set(playersData.map((p) => p.name)).size !== playersData.length ||
            new Set(playersData.map((p) => p.color)).size !== playersData.length
        ) {
            alert("Player names and colors must be unique!");
            return;
        }

        // Hide start menu and show game UI
        document.getElementById("startMenu").style.display = "none";
        document.getElementById("gameCanvas").style.display = "block";
        document.getElementById("gameUI").classList.remove("hidden");

        // Phaser game configuration
        const config = {
            type: Phaser.AUTO,
            width: window.innerWidth,
            height: window.innerHeight,
            scene: HexGame,
            parent: "gameCanvas",
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH,
            },
        };

        // Start Phaser game
        const game = new Phaser.Game(config);
        // Store game settings in registry
        game.registry.set("gridSize", gridSize);
        game.registry.set("playersData", playersData);
    });
});