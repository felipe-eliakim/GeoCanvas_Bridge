import { STATE, UI, CONFIG } from './state.js';
import { calculateContours } from './engine.js';
import { render } from './render.js';
import { parseDXF } from './dxfImporter.js';

// --- HISTÓRICO ---
function saveState() {
    STATE.history.push({ points: JSON.parse(JSON.stringify(STATE.points)), connections: JSON.parse(JSON.stringify(STATE.connections)) });
    if (STATE.history.length > 50) STATE.history.shift();
    STATE.redoStack = []; 
    updateHistoryUI();
}

function undo() {
    if (STATE.history.length > 0) {
        STATE.redoStack.push({ points: JSON.parse(JSON.stringify(STATE.points)), connections: JSON.parse(JSON.stringify(STATE.connections)) });
        const last = STATE.history.pop();
        STATE.points = last.points; STATE.connections = last.connections;
        updateHistoryUI(); render();
    }
}

function redo() {
    if (STATE.redoStack.length > 0) {
        STATE.history.push({ points: JSON.parse(JSON.stringify(STATE.points)), connections: JSON.parse(JSON.stringify(STATE.connections)) });
        const next = STATE.redoStack.pop();
        STATE.points = next.points; STATE.connections = next.connections;
        updateHistoryUI(); render();
    }
}

function updateHistoryUI() {
    if (UI.undoBtn) UI.undoBtn.disabled = STATE.history.length === 0; 
    if (UI.redoBtn) UI.redoBtn.disabled = STATE.redoStack.length === 0;
}

// --- CORE & HUD ---
function handleSnap(e = null) {
    const ax = STATE.isTouchDevice ? UI.canvas.width / 2 : STATE.mouse.x;
    const ay = STATE.isTouchDevice ? UI.canvas.height / 2 : STATE.mouse.y;
    let minD = CONFIG.SNAP_TOLERANCE; 
    STATE.focusedPoint = null;
    
    STATE.points.forEach(p => {
        const d = Math.hypot((p.x * STATE.view.scale + STATE.view.offsetX) - ax, (-p.y * STATE.view.scale + STATE.view.offsetY) - ay);
        if (d < minD) { minD = d; STATE.focusedPoint = p; STATE.focusedPoint.isRef = false; }
    });

    STATE.refPoints.forEach(p => {
        const d = Math.hypot((p.x * STATE.view.scale + STATE.view.offsetX) - ax, (-p.y * STATE.view.scale + STATE.view.offsetY) - ay);
        if (d < minD) { minD = d; STATE.focusedPoint = p; STATE.focusedPoint.isRef = true; }
    });

    updateHUD(ax, ay); 
    render();
}

function executeAction() {
    if (!STATE.focusedPoint) return;
    
    if (STATE.currentTool === 'MEASURE') { 
        STATE.activePoint = STATE.focusedPoint;
    }
    else if (STATE.currentTool === 'GROUP') {
        if (STATE.focusedPoint.isRef) {
            alert("Aviso: Não é possível criar ligações físicas com o projeto de Referência. Use a ferramenta Medir para conferências.");
            return; 
        }
        if (!STATE.activePoint) { 
            STATE.activePoint = STATE.focusedPoint; 
        }
        else if (STATE.focusedPoint !== STATE.activePoint) {
            saveState(); 
            STATE.connections.push({ a: STATE.activePoint, b: STATE.focusedPoint });
            STATE.activePoint = STATE.focusedPoint;
        }
    }
    render();
}

function updateHUD(ax, ay) {
    if (!UI.hud) return;
    
    const acts = document.getElementById('hud-actions'); 
    const a1 = document.getElementById('btn-acao-1'); 
    const a2 = document.getElementById('btn-acao-2');
    
    if(acts) acts.classList.add('hidden'); 
    if(a1) a1.classList.add('hidden'); 
    if(a2) a2.classList.add('hidden');
    if(UI.meshSlider) UI.meshSlider.parentElement.classList.add('hidden');

    if (STATE.focusedPoint) {
        const p = STATE.focusedPoint;
        UI.hudText.innerHTML = `📌 <strong>${p.isRef ? '<span style="color:#ff9800">[REF]</span> ' : ''}${p.id}</strong><br>N: ${p.y.toFixed(3)} | E: ${p.x.toFixed(3)} | Z: ${p.z.toFixed(3)}`;
        
        if (STATE.currentTool === 'MEASURE' || STATE.currentTool === 'GROUP') {
            if(acts) acts.classList.remove('hidden');
            if (!STATE.activePoint) {
                if (STATE.isTouchDevice && a1) { a1.innerHTML = "📍 Iniciar"; a1.classList.remove('hidden'); }
                else { UI.hudText.innerHTML += `<br><small style="color:#aaa;">Clique p/ iniciar | Del p/ apagar</small>`; }
            } else {
                if (STATE.isTouchDevice) { 
                    if(a1) { a1.innerHTML = (STATE.currentTool === 'MEASURE') ? "📍 Nova Medida" : "🔗 Conectar"; a1.classList.remove('hidden'); }
                    if(a2) { a2.innerHTML = "❌ Parar"; a2.classList.remove('hidden'); }
                }
                if (STATE.currentTool === 'MEASURE') {
                    UI.hudText.innerHTML += `<hr style="border-color:#444; margin:8px 0;"><strong>📏 DIST: ${Math.hypot(p.x-STATE.activePoint.x, p.y-STATE.activePoint.y).toFixed(3)}m</strong>`;
                    if (!STATE.isTouchDevice) UI.hudText.innerHTML += `<br><small style="color:#aaa;"><b>Enter</b> soltar | Clique nova medida</small>`;
                } else { 
                    if (!STATE.isTouchDevice) UI.hudText.innerHTML += `<br><small style="color:#aaa;"><b>Enter</b> soltar | Clique conectar</small>`; 
                }
            }
        }
    } else if (STATE.activePoint) {
        const rX = (ax - STATE.view.offsetX) / STATE.view.scale; 
        const rY = -(ay - STATE.view.offsetY) / STATE.view.scale;
        UI.hudText.innerHTML = `DE: <strong>${STATE.activePoint.id}</strong><hr style="border-color:#444; margin:8px 0;"><strong>DIST: ${Math.hypot(rX-STATE.activePoint.x, rY-STATE.activePoint.y).toFixed(3)}m</strong>`;
        if(acts) acts.classList.remove('hidden'); 
        if (STATE.isTouchDevice && a2) a2.classList.remove('hidden');
        if (!STATE.isTouchDevice) UI.hudText.innerHTML += `<br><small style="color:#aaa;"><b>Enter</b> p/ soltar</small>`;
    }
    
    if (STATE.currentTool === 'CONTOUR') { 
        UI.hudText.innerHTML = `〰️ <strong>Curvas de Nível</strong>`; 
        if(UI.meshSlider) UI.meshSlider.parentElement.classList.remove('hidden'); 
        if(acts) acts.classList.remove('hidden'); 
        if(a1) { a1.innerHTML = STATE.showMesh ? "👁️ Ocultar Malha" : "👁️ Mostrar Malha"; a1.classList.remove('hidden'); }
    }
    
    if (STATE.currentTool === 'COLLECT' && !STATE.focusedPoint) { 
        UI.hudText.innerHTML = `📍 <strong>Modo Coletor</strong><br><small style="color:#aaa;">Toque em qualquer ponto vazio do mapa para cadastrar.</small>`; 
    }
    
    UI.hud.classList.toggle('hidden', !STATE.focusedPoint && !STATE.activePoint && STATE.currentTool !== 'CONTOUR' && STATE.currentTool !== 'COLLECT');
}

function centerView() {
    if(STATE.points.length === 0 && STATE.refPoints.length === 0) return;
    const targetArr = STATE.points.length > 0 ? STATE.points : STATE.refPoints;
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    targetArr.forEach(p => { if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x; if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y; });
    STATE.view.scale = Math.min((UI.canvas.width-100)/Math.max(maxX-minX,1), (UI.canvas.height-100)/Math.max(maxY-minY,1));
    STATE.view.offsetX = (UI.canvas.width/2) - ((minX+maxX)/2)*STATE.view.scale;
    STATE.view.offsetY = (UI.canvas.height/2) + ((minY+maxY)/2)*STATE.view.scale;
    render();
}

// --- ENGINE ALFANUMÉRICO DE SEQUÊNCIA (REGEXP) ---
function generateNextName(lastId) {
    if (!lastId) return "M1";
    // Tenta quebrar o ID em duas partes: Texto (1) e Número final (2)
    const match = lastId.match(/^([a-zA-ZÀ-ÿ_-]*?)(\d+)$/);
    if (match) {
        const prefix = match[1];
        const currentNumber = parseInt(match[2], 10);
        return prefix + (currentNumber + 1);
    } else {
        // Se o usuário digitou apenas texto (ex: "P"), a sequência vira "P1"
        return lastId + "1";
    }
}

// --- SISTEMA DE COLETA DE PONTO (Z + ID MODAL) ---
let pendingPoint = null;
const modalZ = document.getElementById('modal-z-input');
const inputZ = document.getElementById('input-z-value');
const inputId = document.getElementById('input-ponto-id');

function openZPrompt(wX, wY) {
    if(!modalZ || !inputZ || !inputId) return;
    pendingPoint = { x: wX, y: wY };
    
    // Calcula dinamicamente a sugestão com base no ÚLTIMO ponto inserido pelo coletor
    const collected = STATE.points.filter(p => p.isCollected);
    let defaultSuggestion = "M1";
    if (collected.length > 0) {
        const lastCollectedPoint = collected[collected.length - 1];
        defaultSuggestion = generateNextName(lastCollectedPoint.id);
    }
    
    inputId.value = defaultSuggestion;
    inputZ.value = ''; 
    modalZ.classList.remove('hidden');
    
    // Dá foco automático na cota para agilizar a digitação (Notebook)
    inputZ.focus(); 
}

function confirmCollectPoint() {
    if (!pendingPoint || !inputZ || !inputId || !modalZ) return;
    
    const finalId = inputId.value.trim() || `M${STATE.points.filter(p => p.isCollected).length + 1}`;
    const zVal = parseFloat(inputZ.value.replace(',', '.')) || 0;
    
    // Trava antifraude de ID duplicado na lista ativa
    if (STATE.points.some(p => p.id === finalId)) {
        alert(`Aviso: Já existe um ponto com o nome "${finalId}" no projeto. Escolha uma identificação única.`);
        return;
    }

    saveState();
    STATE.points.push({ 
        id: finalId, 
        x: pendingPoint.x, 
        y: pendingPoint.y, 
        z: zVal, 
        isRef: false,
        isCollected: true 
    });
    
    pendingPoint = null;
    modalZ.classList.add('hidden');
    render();
}

const btnConfirmZ = document.getElementById('btn-confirm-z');
const btnCancelZ = document.getElementById('btn-cancel-z');
if (btnConfirmZ) btnConfirmZ.addEventListener('click', confirmCollectPoint);
if (btnCancelZ) btnCancelZ.addEventListener('click', () => { pendingPoint = null; modalZ.classList.add('hidden'); });

// Atalho de teclado: Apertar Enter em qualquer caixa do modal salva o ponto
if (inputZ) inputZ.addEventListener('keydown', e => { if (e.key === 'Enter') confirmCollectPoint(); });
if (inputId) inputId.addEventListener('keydown', e => { if (e.key === 'Enter') confirmCollectPoint(); });


// --- EVENTOS NAVEGAÇÃO / TECLADO ---
window.addEventListener('keydown', e => {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if (isCtrl && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    if (e.key === 'Enter' || e.key === 'Escape') { STATE.activePoint = null; handleSnap(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && STATE.focusedPoint && !STATE.focusedPoint.isRef) { 
        saveState();
        STATE.points = STATE.points.filter(p => p.id !== STATE.focusedPoint.id);
        STATE.connections = STATE.connections.filter(c => c.a.id !== STATE.focusedPoint.id && c.b.id !== STATE.focusedPoint.id);
        STATE.focusedPoint = null; 
        handleSnap();
    }
    if (e.key === 'ArrowUp')    { STATE.view.offsetY += CONFIG.PAN_STEP; render(); }
    if (e.key === 'ArrowDown')  { STATE.view.offsetY -= CONFIG.PAN_STEP; render(); }
    if (e.key === 'ArrowLeft')  { STATE.view.offsetX += CONFIG.PAN_STEP; render(); }
    if (e.key === 'ArrowRight') { STATE.view.offsetX -= CONFIG.PAN_STEP; render(); }
});

// --- NAVEGAÇÃO DESKTOP ---
if (UI.canvas) {
    UI.canvas.addEventListener('mousedown', e => { 
        if (STATE.isTouchDevice) return; 
        STATE.mouse.isDragging = true; 
        UI.canvas.style.cursor = 'grabbing'; 
        STATE.mouse.lastX = e.clientX; 
        STATE.mouse.lastY = e.clientY; 
        STATE.mouse.moved = false; 
    });

    UI.canvas.addEventListener('wheel', e => { 
        e.preventDefault(); 
        const delta = e.deltaY > 0 ? 0.92 : 1.08; 
        const prevScale = STATE.view.scale; 
        STATE.view.scale *= delta; 
        STATE.view.offsetX = STATE.mouse.x - (STATE.mouse.x - STATE.view.offsetX) * (STATE.view.scale / prevScale); 
        STATE.view.offsetY = STATE.mouse.y - (STATE.mouse.y - STATE.view.offsetY) * (STATE.view.scale / prevScale); 
        render(); 
    }, { passive: false });
}

window.addEventListener('mousemove', e => {
    if (!UI.canvas) return;
    const rect = UI.canvas.getBoundingClientRect(); 
    STATE.mouse.x = e.clientX - rect.left; 
    STATE.mouse.y = e.clientY - rect.top;
    
    if (STATE.mouse.isDragging && !STATE.isTouchDevice) { 
        STATE.view.offsetX += e.clientX - STATE.mouse.lastX; 
        STATE.view.offsetY += e.clientY - STATE.mouse.lastY; 
        STATE.mouse.lastX = e.clientX; 
        STATE.mouse.lastY = e.clientY; 
        STATE.mouse.moved = true; 
        render(); 
    }
    const sCont = document.getElementById('search-container');
    if (sCont && sCont.classList.contains('hidden')) handleSnap();
});

window.addEventListener('mouseup', e => { 
    if (STATE.isTouchDevice || !UI.canvas) return; 
    STATE.mouse.isDragging = false; 
    UI.canvas.style.cursor = ''; 
    
    if (!STATE.mouse.moved && e.button === 0) {
        if (STATE.currentTool === 'COLLECT' && modalZ && modalZ.classList.contains('hidden')) {
            if (e.target !== UI.canvas) return; 
            const targetX = STATE.focusedPoint ? STATE.focusedPoint.x : (STATE.mouse.x - STATE.view.offsetX) / STATE.view.scale;
            const targetY = STATE.focusedPoint ? STATE.focusedPoint.y : -(STATE.mouse.y - STATE.view.offsetY) / STATE.view.scale;
            openZPrompt(targetX, targetY);
        } else if (STATE.focusedPoint) {
            executeAction();
        }
    }
});

// --- TOUCH MOBILE BLINDADO ---
const elCrosshair = document.getElementById('crosshair'); 
let initialPinchDist = null, initialScale = 1;
if (elCrosshair) elCrosshair.style.transition = 'opacity 0.2s'; 

if (UI.canvas) {
    UI.canvas.addEventListener('touchstart', e => { 
        if (!STATE.isTouchDevice) return; 
        e.preventDefault(); 
        if (e.touches.length === 1) { 
            STATE.mouse.isDragging = true; 
            STATE.mouse.moved = false; 
            if (elCrosshair) elCrosshair.style.opacity = '0'; 
            STATE.mouse.lastX = e.touches[0].clientX; 
            STATE.mouse.lastY = e.touches[0].clientY; 
        } else if (e.touches.length === 2) { 
            initialPinchDist = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); 
            initialScale = STATE.view.scale; 
        } 
    }, { passive: false });

    UI.canvas.addEventListener('touchmove', e => { 
        if (!STATE.isTouchDevice) return; 
        e.preventDefault(); 
        if (STATE.mouse.isDragging && e.touches.length === 1) { 
            STATE.mouse.moved = true; 
            STATE.view.offsetX += e.touches[0].clientX - STATE.mouse.lastX; 
            STATE.view.offsetY += e.touches[0].clientY - STATE.mouse.lastY; 
            STATE.mouse.lastX = e.touches[0].clientX; 
            STATE.mouse.lastY = e.touches[0].clientY; 
            handleSnap(); 
        } else if (e.touches.length === 2) { 
            const d = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY); 
            const pS = STATE.view.scale; 
            STATE.view.scale = initialScale * (d/initialPinchDist); 
            STATE.view.offsetX = (UI.canvas.width/2) - (UI.canvas.width/2 - STATE.view.offsetX)*(STATE.view.scale/pS); 
            STATE.view.offsetY = (UI.canvas.height/2) - (UI.canvas.height/2 - STATE.view.offsetY)*(STATE.view.scale/pS); 
            render(); 
        } 
    }, { passive: false });

    UI.canvas.addEventListener('touchend', e => { 
        if (e.cancelable) e.preventDefault();
        
        if (!STATE.mouse.moved && STATE.mouse.isDragging && e.touches.length === 0) {
            if (STATE.currentTool === 'COLLECT' && modalZ && modalZ.classList.contains('hidden')) {
                const targetX = STATE.focusedPoint ? STATE.focusedPoint.x : (UI.canvas.width / 2 - STATE.view.offsetX) / STATE.view.scale;
                const targetY = STATE.focusedPoint ? STATE.focusedPoint.y : -(UI.canvas.height / 2 - STATE.view.offsetY) / STATE.view.scale;
                openZPrompt(targetX, targetY);
            }
        }

        STATE.mouse.isDragging = false; 
        if (elCrosshair) elCrosshair.style.opacity = '1'; 
        initialPinchDist = null; 
    });
}

// --- EVENTOS UI ---
if (UI.minimapCanvas) {
    UI.minimapCanvas.addEventListener('mousedown', e => {
        const rect = UI.minimapCanvas.getBoundingClientRect();
        const clickX = (e.clientX - rect.left) * (UI.minimapCanvas.width / rect.width);
        const clickY = (e.clientY - rect.top) * (UI.minimapCanvas.height / rect.height);
        const realX = (clickX - STATE.minimap.offsetX) / STATE.minimap.scale;
        const realY = -(clickY - STATE.minimap.offsetY) / STATE.minimap.scale;
        STATE.view.offsetX = (UI.canvas.width / 2) - realX * STATE.view.scale; 
        STATE.view.offsetY = (UI.canvas.height / 2) + realY * STATE.view.scale; 
        render();
    });
}

const menuBtn = document.getElementById('menu-btn');
if (menuBtn) menuBtn.addEventListener('click', () => UI.dropdown.classList.toggle('hidden'));

const btnTutorial = document.getElementById('btn-tutorial');
if (btnTutorial) btnTutorial.addEventListener('click', () => { if(UI.modalTutorial) UI.modalTutorial.classList.remove('hidden'); UI.dropdown.classList.add('hidden'); });

const btnCloseTut = document.getElementById('btn-close-tutorial');
if (btnCloseTut) btnCloseTut.addEventListener('click', () => { if(UI.modalTutorial) UI.modalTutorial.classList.add('hidden'); });

const btnRecenter = document.getElementById('btn-recenter');
if (btnRecenter) btnRecenter.addEventListener('click', centerView);

if (UI.undoBtn) UI.undoBtn.addEventListener('click', undo); 
if (UI.redoBtn) UI.redoBtn.addEventListener('click', redo);

const btnAcao1 = document.getElementById('btn-acao-1');
if (btnAcao1) btnAcao1.addEventListener('click', () => { 
    if(STATE.currentTool==='CONTOUR'){ 
        STATE.showMesh=!STATE.showMesh; 
        render(); 
        return; 
    } 
    executeAction(); 
});

const btnAcao2 = document.getElementById('btn-acao-2');
if (btnAcao2) btnAcao2.addEventListener('click', () => { STATE.activePoint = null; handleSnap(); });

document.querySelectorAll('.tool-btn').forEach(btn => btn.addEventListener('click', e => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); 
    e.currentTarget.classList.add('active');
    STATE.currentTool = e.currentTarget.dataset.tool; 
    STATE.activePoint = null;
    
    const searchContainer = document.getElementById('search-container');
    if (searchContainer) {
        searchContainer.classList.toggle('hidden', STATE.currentTool !== 'SEARCH');
        if (STATE.currentTool === 'SEARCH') {
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.focus();
        }
    }
    if(STATE.currentTool === 'CONTOUR') {
        calculateContours();
    }
    handleSnap();
}));

const meshSlider = document.getElementById('mesh-filter-slider');
if (meshSlider) {
    meshSlider.addEventListener('input', e => { 
        CONFIG.MAX_TRIANGLE_LENGTH = parseInt(e.target.value); 
        const mValue = document.getElementById('mesh-filter-value');
        if (mValue) mValue.innerText = CONFIG.MAX_TRIANGLE_LENGTH; 
        if(STATE.currentTool==='CONTOUR') { 
            calculateContours(); 
            render(); 
        } 
    });
}

const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', e => {
        const t = e.target.value.trim().toLowerCase(); 
        const searchResults = document.getElementById('search-results');
        if (!searchResults) return;
        searchResults.innerHTML = ''; 
        if(!t) return;
        
        STATE.points.filter(p => p.id.toLowerCase().includes(t)).forEach(p => {
            const d = document.createElement('div'); d.className='search-item'; d.innerHTML=`📍 <strong>${p.id}</strong> (Z: ${p.z.toFixed(2)})`;
            d.onclick = () => { STATE.view.scale = 2.0; STATE.view.offsetX = (UI.canvas.width/2)-p.x*STATE.view.scale; STATE.view.offsetY = (UI.canvas.height/2)-(-p.y*STATE.view.scale); STATE.focusedPoint=p; document.getElementById('search-container').classList.add('hidden'); handleSnap(); };
            searchResults.appendChild(d);
        });
    });
}

function parseFileContent(content, isJson) {
    let pts = [], conns = [];
    if (isJson) { 
        try { 
            const data = JSON.parse(content); 
            if (data.pontos) pts = data.pontos; 
            if (data.linhas) conns = data.linhas; 
        } catch (e) { alert("Erro ao ler JSON."); } 
    } else { 
        content.split('\n').forEach(line => { 
            const c = line.trim().split(/[;\t\s,]+/); 
            if (c.length >= 3) { 
                const y = parseFloat(c[1].replace(',','.')), x = parseFloat(c[2].replace(',','.')), z = c[3] ? parseFloat(c[3].replace(',','.')) : 0; 
                if (!isNaN(x) && !isNaN(y)) pts.push({ id: c[0], y, x, z }); 
            } 
        }); 
    }
    return { pts, conns };
}

function handleFileUpload(e, isReference = false) {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = async (ev) => {
        const content = ev.target.result;
        let data = { pts: [], conns: [] };

        try {
            if (fileName.endsWith('.dxf')) {
                data = await parseDXF(content);
            } else {
                const isJson = fileName.endsWith('.json');
                data = parseFileContent(content, isJson);
            }

            if (isReference) {
                STATE.refPoints = data.pts;
                STATE.refConnections = data.conns;
                STATE.refVisualEntities = data.visualEntities || [];
                render();
                centerView();
            } else {
                STATE.points = data.pts;
                STATE.connections = data.conns;
                STATE.refVisualEntities = data.visualEntities || [];
                STATE.history = [];
                STATE.redoStack = [];
                STATE.refPoints = [];
                STATE.refConnections = [];
                centerView();
            }
        } catch (error) {
            alert(error);
        }
        
        if (UI.dropdown) UI.dropdown.classList.add('hidden');
        e.target.value = ''; 
    };

    reader.readAsText(file);
}

const fileUpload = document.getElementById('file-upload');
if (fileUpload) fileUpload.addEventListener('change', (e) => handleFileUpload(e, false));

const refUpload = document.getElementById('ref-upload');
if (refUpload) refUpload.addEventListener('change', (e) => handleFileUpload(e, true));

window.addEventListener('resize', () => { 
    if (UI.canvas) {
        UI.canvas.width = UI.canvas.parentElement.clientWidth; 
        UI.canvas.height = UI.canvas.parentElement.clientHeight; 
        render(); 
    }
});

if (UI.canvas) {
    UI.canvas.width = UI.canvas.parentElement.clientWidth; 
    UI.canvas.height = UI.canvas.parentElement.clientHeight;
}

// EXPORTS
const btnSalvar = document.getElementById('btn-salvar-projeto');
if (btnSalvar) btnSalvar.addEventListener('click', () => { const nA = (prompt("Nome do Backup:", "backup") || "backup").trim(); const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ pontos: STATE.points, linhas: STATE.connections })); a.download = nA + ".json"; a.click(); if(UI.dropdown) UI.dropdown.classList.add('hidden'); });

const btnExportarEstacao = document.getElementById('btn-exportar-estacao');
if (btnExportarEstacao) btnExportarEstacao.addEventListener('click', () => { 
    const collectedPoints = STATE.points.filter(p => p.isCollected);
    if (collectedPoints.length === 0) { alert("Aviso: Nenhum ponto foi capturado no Modo Coletor (📍) ainda."); return; }
    const nA = (prompt("Nome do arquivo para a Estação Total:", "LOCACAO") || "LOCACAO").trim(); 
    let csvData = "Ponto,Este(X),Norte(Y),Cota(Z),Descricao\n";
    collectedPoints.forEach(p => { csvData += `${p.id},${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)},M\n`; }); 
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8" }); 
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nA + ".csv"; a.click(); 
    if(UI.dropdown) UI.dropdown.classList.add('hidden'); 
});

const btnExportarPDF = document.getElementById('btn-exportar-pdf');
if (btnExportarPDF) btnExportarPDF.addEventListener('click', () => { if (STATE.points.length === 0) return; const nO = prompt("Nome da Obra:", "LEVANTAMENTO") || "RELATORIO"; const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.setFillColor(30,30,30); doc.rect(0,0,210,35,'F'); doc.setTextColor(76,175,80); doc.setFontSize(22); doc.text("GEOCANVAS REPORT", 15, 18); const tC = document.createElement('canvas'); tC.width=UI.canvas.width; tC.height=UI.canvas.height; const tCtx = tC.getContext('2d'); tCtx.fillStyle='#121212'; tCtx.fillRect(0,0,tC.width,tC.height); tCtx.drawImage(UI.canvas,0,0); doc.addImage(tC.toDataURL('image/jpeg',0.8), 'JPEG', 15, 45, 180, 100); doc.autoTable({ startY: 155, head: [['ID', 'NORTE', 'ESTE', 'COTA']], body: STATE.points.map(p => [p.id, p.y.toFixed(3), p.x.toFixed(3), p.z.toFixed(3)]), headStyles: { fillColor: [76, 175, 80] } }); doc.save(nO + ".pdf"); if(UI.dropdown) UI.dropdown.classList.add('hidden'); });

const btnExportarDXF = document.getElementById('btn-exportar-dxf');
if (btnExportarDXF) btnExportarDXF.addEventListener('click', () => { if (STATE.points.length === 0) return; const nA = (prompt("Nome do arquivo DXF:", "projeto") || "projeto").trim(); let d = "0\nSECTION\n2\nENTITIES\n"; STATE.points.forEach(p => { d += `0\nPOINT\n8\nPONTOS\n10\n${p.x}\n20\n${p.y}\n30\n${p.z}\n`; const s = CONFIG.CROSS_SIZE; d += `0\nLINE\n8\nPONTOS_SYM\n10\n${p.x-s}\n20\n${p.y}\n30\n${p.z}\n11\n${p.x+s}\n21\n${p.y}\n31\n${p.z}\n`; d += `0\nLINE\n8\nPONTOS_SYM\n10\n${p.x}\n20\n${p.y-s}\n30\n${p.z}\n11\n${p.x}\n21\n${p.y+s}\n31\n${p.z}\n`; d += `0\nTEXT\n8\nPONTOS_ID\n10\n${p.x+0.15}\n20\n${p.y+0.15}\n30\n${p.z}\n40\n0.8\n1\n${p.id}\n`; }); STATE.connections.forEach(l => d += `0\nLINE\n8\nLIGACOES\n10\n${l.a.x}\n20\n${l.a.y}\n30\n${l.a.z}\n11\n${l.b.x}\n21\n${l.b.y}\n31\n${l.b.z}\n`); d += "0\nENDSEC\n0\nEOF\n"; const blob = new Blob([d], { type: "application/dxf" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nA + ".dxf"; a.click(); if(UI.dropdown) UI.dropdown.classList.add('hidden'); });