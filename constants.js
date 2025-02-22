// Game phases
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

// Resource costs for actions
const COSTS = {
    settlement: { wood: 5, stone: 5 },
    army: { food: 10 },
    territory: { wood: 3, stone: 2 },
};