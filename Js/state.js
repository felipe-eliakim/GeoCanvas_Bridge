export const CONFIG = {
    MAX_TRIANGLE_LENGTH: 10,
    CURVE_TENSION: 0.10,
    SNAP_TOLERANCE: 25,
    CROSS_SIZE: 0.05,
    PAN_STEP: 40,
    MINIMAP_CONTEXT_FACTOR: 3
};

export const STATE = {
    points: [],
    connections: [],
    history: [],
    redoStack: [],
    contours: [],
    tinMesh: [],
    refPoints: [],
    refConnections: [],
    showMesh: false,
    currentTool: 'VIEW',
    activePoint: null,
    focusedPoint: null,
    view: { offsetX: 0, offsetY: 0, scale: 1 },
    mouse: { x: 0, y: 0, isDragging: false, lastX: 0, lastY: 0, moved: false },
    isTouchDevice: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
    minimap: { scale: 1, offsetX: 0, offsetY: 0 }
};

export const UI = {
    canvas: document.getElementById('topoCanvas'),
    ctx: document.getElementById('topoCanvas').getContext('2d'),
    hud: document.getElementById('hud-info'),
    hudText: document.getElementById('hud-text'),
    undoBtn: document.getElementById('btn-undo'),
    redoBtn: document.getElementById('btn-redo'),
    dropdown: document.getElementById('dropdown-menu'),
    searchContainer: document.getElementById('search-container'),
    searchInput: document.getElementById('search-input'),
    searchResults: document.getElementById('search-results'),
    modalTutorial: document.getElementById('modal-tutorial'),
    minimapContainer: document.getElementById('minimap-container'),
    minimapCanvas: document.getElementById('minimapCanvas'),
    meshSlider: document.getElementById('mesh-filter-slider'),
    meshValue: document.getElementById('mesh-filter-value')
};