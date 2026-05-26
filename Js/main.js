import { STATE, UI, CONFIG } from './state.js';
import { calculateContours } from './engine.js';
import { render } from './render.js';
import { parseDXF } from './dxfImporter.js'; // NOVO: Importação do módulo DXF

// --- HISTÓRICO ---
function saveState() {
    STATE.history.push({ points: JSON.parse(JSON.stringify(STATE.points)), connections: JSON.parse(JSON.stringify(STATE.connections)) });
    if (STATE.history.length > 50) STATE.history.shift();
    STATE.redoStack = []; updateHistoryUI();
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
    UI.undoBtn.disabled = STATE.history.length === 0; UI.redoBtn.disabled = STATE.redoStack.length === 0;
}

// --- CORE & HUD ---
function handleSnap(e = null) {
    const ax = STATE.isTouchDevice ? UI.canvas.width / 2 : STATE.mouse.x;
    const ay = STATE.isTouchDevice ? UI.canvas.height / 2 : STATE.mouse.y;
    let minD = CONFIG.SNAP_TOLERANCE; 
    STATE.focusedPoint = null;
    
    // 1. Procura primeiro nos pontos do Projeto Ativo
    STATE.points.forEach(p => {
        const d = Math.hypot((p.x * STATE.view.scale + STATE.view.offsetX) - ax, (-p.y * STATE.view.scale + STATE.view.offsetY) - ay);
        if (d < minD) { minD = d; STATE.focusedPoint = p; STATE.focusedPoint.isRef = false; }
    });

    // 2. Procura nos pontos da Referência (Overlay)
    STATE.refPoints.forEach(p => {
        const d = Math.hypot((p.x * STATE.view.scale + STATE.view.offsetX) - ax, (-p.y * STATE.view.scale + STATE.view.offsetY) - ay);
        // Se encontrar um mais perto na referência, ele assume o foco
        if (d < minD) { minD = d; STATE.focusedPoint = p; STATE.focusedPoint.isRef = true; }
    });

    updateHUD(ax, ay); render();
}

function executeAction() {
    if (!STATE.focusedPoint) return;
    
    if (STATE.currentTool === 'MEASURE') { 
        STATE.activePoint = STATE.focusedPoint; // Pode medir usando referência normalmente
    }
    else if (STATE.currentTool === 'GROUP') {
        // Trava de Segurança: Não deixar "Ligar" com a referência
        if (STATE.focusedPoint.isRef) {
            alert("Aviso: Não é possível criar ligações físicas com o projeto de Referência. Use a ferramenta Medir para conferências.");
            return; 
        }

        if (!STATE.activePoint) { 
            STATE.activePoint = STATE.focusedPoint; 
        }
        else if (STATE.focusedPoint !== STATE.activePoint) {
            saveState(); STATE.connections.push({ a: STATE.activePoint, b: STATE.focusedPoint });
            STATE.activePoint = STATE.focusedPoint;
        }
    }
    render();
}

function updateHUD(ax, ay) {
    const acts = document.getElementById('hud-actions'); const a1 = document.getElementById('btn-acao-1'); const a2 = document.getElementById('btn-acao-2');
    acts.classList.add('hidden'); a1.classList.add('hidden'); a2.classList.add('hidden');
    UI.meshSlider.parentElement.classList.add('hidden');

    if (STATE.focusedPoint) {
        const p = STATE.focusedPoint;
        // TAG Visual para pontos do Overlay
        UI.hudText.innerHTML = `📌 <strong>${p.isRef ? '<span style="color:#ff9800">[REF]</span> ' : ''}${p.id}</strong><br>N: ${p.y.toFixed(3)} | E: ${p.x.toFixed(3)} | Z: ${p.z.toFixed(3)}`;
        
        if (STATE.currentTool === 'MEASURE' || STATE.currentTool === 'GROUP') {
            acts.classList.remove('hidden');
            if (!STATE.activePoint) {
                if (STATE.isTouchDevice) { a1.innerHTML = "📍 Iniciar"; a1.classList.remove('hidden'); }
                else { UI.hudText.innerHTML += `<br><small style="color:#aaa;">Clique p/ iniciar | Del p/ apagar</small>`; }
            } else {
                if (STATE.isTouchDevice) { 
                    a1.innerHTML = (STATE.currentTool === 'MEASURE') ? "📍 Nova Medida" : "🔗 Conectar"; 
                    a1.classList.remove('hidden'); 
                    a2.innerHTML = "❌ Parar"; a2.classList.remove('hidden'); 
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
        const rX = (ax - STATE.view.offsetX) / STATE.view.scale; const rY = -(ay - STATE.view.offsetY) / STATE.view.scale;
        UI.hudText.innerHTML = `DE: <strong>${STATE.activePoint.id}</strong><hr style="border-color:#444; margin:8px 0;"><strong>DIST: ${Math.hypot(rX-STATE.activePoint.x, rY-STATE.activePoint.y).toFixed(3)}m</strong>`;
        acts.classList.remove('hidden'); if (STATE.isTouchDevice) a2.classList.remove('hidden');
        if (!STATE.isTouchDevice) UI.hudText.innerHTML += `<br><small style="color:#aaa;"><b>Enter</b> p/ soltar</small>`;
    }
    if (STATE.currentTool === 'CONTOUR') { UI.hudText.innerHTML = `〰️ <strong>Curvas de Nível</strong>`; UI.meshSlider.parentElement.classList.remove('hidden'); acts.classList.remove('hidden'); a1.innerHTML = STATE.showMesh ? "👁️ Ocultar Malha" : "👁️ Mostrar Malha"; a1.classList.remove('hidden'); }
    UI.hud.classList.toggle('hidden', !STATE.focusedPoint && !STATE.activePoint && STATE.currentTool !== 'CONTOUR');
}

function centerView() {
    if(STATE.points.length===0) return;
    let minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    STATE.points.forEach(p => { if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x; if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y; });
    STATE.view.scale = Math.min((UI.canvas.width-100)/Math.max(maxX-minX,1), (UI.canvas.height-100)/Math.max(maxY-minY,1));
    STATE.view.offsetX = (UI.canvas.width/2) - ((minX+maxX)/2)*STATE.view.scale;
    STATE.view.offsetY = (UI.canvas.height/2) + ((minY+maxY)/2)*STATE.view.scale;
    import('./render.js').then(module => module.render());
}

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
        STATE.focusedPoint = null; handleSnap();
    }
    if (e.key === 'ArrowUp')    { STATE.view.offsetY += CONFIG.PAN_STEP; import('./render.js').then(module => module.render()); }
    if (e.key === 'ArrowDown')  { STATE.view.offsetY -= CONFIG.PAN_STEP; import('./render.js').then(module => module.render()); }
    if (e.key === 'ArrowLeft')  { STATE.view.offsetX += CONFIG.PAN_STEP; import('./render.js').then(module => module.render()); }
    if (e.key === 'ArrowRight') { STATE.view.offsetX -= CONFIG.PAN_STEP; import('./render.js').then(module => module.render()); }
});

// --- NAVEGAÇÃO DESKTOP ---
UI.canvas.addEventListener('mousedown', e => { 
    if (STATE.isTouchDevice) return; 
    STATE.mouse.isDragging = true; 
    UI.canvas.style.cursor = 'grabbing'; // Vira a "mãozinha" segurando o mapa
    STATE.mouse.lastX = e.clientX; 
    STATE.mouse.lastY = e.clientY; 
    STATE.mouse.moved = false; 
});

window.addEventListener('mousemove', e => {
    const rect = UI.canvas.getBoundingClientRect(); STATE.mouse.x = e.clientX - rect.left; STATE.mouse.y = e.clientY - rect.top;
    if (STATE.mouse.isDragging && !STATE.isTouchDevice) { STATE.view.offsetX += e.clientX - STATE.mouse.lastX; STATE.view.offsetY += e.clientY - STATE.mouse.lastY; STATE.mouse.lastX = e.clientX; STATE.mouse.lastY = e.clientY; STATE.mouse.moved = true; import('./render.js').then(module => module.render()); }
    if (UI.searchContainer.classList.contains('hidden')) handleSnap();
});

window.addEventListener('mouseup', e => { 
    if (STATE.isTouchDevice) return; 
    STATE.mouse.isDragging = false; 
    UI.canvas.style.cursor = ''; // Volta ao cursor padrão ao soltar
    if (!STATE.mouse.moved && e.button === 0 && STATE.focusedPoint) executeAction(); 
});

UI.canvas.addEventListener('wheel', e => { 
    e.preventDefault(); 
    // Zoom suave (8% em vez de 15%)
    const delta = e.deltaY > 0 ? 0.92 : 1.08; 
    const prevScale = STATE.view.scale; 
    STATE.view.scale *= delta; 
    STATE.view.offsetX = STATE.mouse.x - (STATE.mouse.x - STATE.view.offsetX) * (STATE.view.scale / prevScale); 
    STATE.view.offsetY = STATE.mouse.y - (STATE.mouse.y - STATE.view.offsetY) * (STATE.view.scale / prevScale); 
    import('./render.js').then(module => module.render()); 
}, { passive: false });

// --- TOUCH MOBILE BLINDADO ---
let initialPinchDist = null, initialScale = 1;
const elCrosshair = document.getElementById('crosshair'); 
if (elCrosshair) elCrosshair.style.transition = 'opacity 0.2s'; // Garante que a cruz suma e volte com suavidade

UI.canvas.addEventListener('touchstart', e => { 
    if (!STATE.isTouchDevice) return; 
    e.preventDefault(); 
    
    if (e.touches.length === 1) { 
        STATE.mouse.isDragging = true; 
        if (elCrosshair) elCrosshair.style.opacity = '0'; // Esconde a cruz ao tocar
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
        import('./render.js').then(module => module.render()); 
    } 
}, { passive: false });

UI.canvas.addEventListener('touchend', e => { 
    if (e.cancelable) e.preventDefault();
    STATE.mouse.isDragging = false; 
    if (elCrosshair) elCrosshair.style.opacity = '1'; // A cruz reaparece no centro para a mira
    initialPinchDist = null; 
});

// --- EVENTOS UI E ARQUIVOS ---
UI.minimapCanvas.addEventListener('mousedown', e => {
    const rect = UI.minimapCanvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (UI.minimapCanvas.width / rect.width), clickY = (e.clientY - rect.top) * (UI.minimapCanvas.height / rect.height);
    const realX = (clickX - STATE.minimap.offsetX) / STATE.minimap.scale, realY = -(clickY - STATE.minimap.offsetY) / STATE.minimap.scale;
    STATE.view.offsetX = (UI.canvas.width / 2) - realX * STATE.view.scale; STATE.view.offsetY = (UI.canvas.height / 2) + realY * STATE.view.scale; import('./render.js').then(module => module.render());
});

document.getElementById('menu-btn').addEventListener('click', () => UI.dropdown.classList.toggle('hidden'));
document.getElementById('btn-tutorial').addEventListener('click', () => { UI.modalTutorial.classList.remove('hidden'); UI.dropdown.classList.add('hidden'); });
document.getElementById('btn-close-tutorial').addEventListener('click', () => UI.modalTutorial.classList.add('hidden'));
document.getElementById('btn-recenter').addEventListener('click', centerView);
UI.undoBtn.addEventListener('click', undo); UI.redoBtn.addEventListener('click', redo);
document.getElementById('btn-acao-1').addEventListener('click', () => { if(STATE.currentTool==='CONTOUR'){ STATE.showMesh=!STATE.showMesh; import('./render.js').then(module => module.render()); return; } executeAction(); });
document.getElementById('btn-acao-2').addEventListener('click', () => { STATE.activePoint = null; handleSnap(); });

document.querySelectorAll('.tool-btn').forEach(btn => btn.addEventListener('click', e => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active');
    STATE.currentTool = e.currentTarget.dataset.tool; STATE.activePoint = null;
    UI.searchContainer.classList.toggle('hidden', STATE.currentTool !== 'SEARCH');
    if(STATE.currentTool === 'SEARCH') UI.searchInput.focus();
    if(STATE.currentTool === 'CONTOUR') import('./engine.js').then(module => module.calculateContours());
    handleSnap();
}));

UI.meshSlider.addEventListener('input', e => { CONFIG.MAX_TRIANGLE_LENGTH = parseInt(e.target.value); UI.meshValue.innerText = CONFIG.MAX_TRIANGLE_LENGTH; if(STATE.currentTool==='CONTOUR') { import('./engine.js').then(module => module.calculateContours()); import('./render.js').then(module => module.render()); } });

UI.searchInput.addEventListener('input', e => {
    const t = e.target.value.trim().toLowerCase(); UI.searchResults.innerHTML = ''; if(!t) return;
    STATE.points.filter(p => p.id.toLowerCase().includes(t)).forEach(p => {
        const d = document.createElement('div'); d.className='search-item'; d.innerHTML=`📍 <strong>${p.id}</strong> (Z: ${p.z.toFixed(2)})`;
        d.onclick = () => { STATE.view.scale = 2.0; STATE.view.offsetX = (UI.canvas.width/2)-p.x*STATE.view.scale; STATE.view.offsetY = (UI.canvas.height/2)-(-p.y*STATE.view.scale); STATE.focusedPoint=p; UI.searchContainer.classList.add('hidden'); handleSnap(); };
        UI.searchResults.appendChild(d);
    });
});

function parseFileContent(content, isJson) {
    let pts = [], conns = [];
    if (isJson) { try { const data = JSON.parse(content); if (data.pontos) pts = data.pontos; if (data.linhas) conns = data.linhas; } catch (e) { alert("Erro ao ler JSON."); } } 
    else { content.split('\n').forEach(line => { const c = line.trim().split(/[;\t\s,]+/); if (c.length >= 3) { const y = parseFloat(c[1].replace(',','.')), x = parseFloat(c[2].replace(',','.')), z = c[3] ? parseFloat(c[3].replace(',','.')) : 0; if (!isNaN(x) && !isNaN(y)) pts.push({ id: c[0], y, x, z }); } }); }
    return { pts, conns };
}

// --- NOVO SISTEMA DE UPLOAD (Incluindo DXF) ---
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
                // Rota para DXF (Assíncrono)
                data = await parseDXF(content);
            } else {
                // Rota Clássica (JSON, TXT, CSV)
                const isJson = fileName.endsWith('.json');
                data = parseFileContent(content, isJson);
            }

            if (isReference) {
                STATE.refPoints = data.pts;
                STATE.refConnections = data.conns;
                import('./render.js').then(module => module.render());
            } else {
                STATE.points = data.pts;
                STATE.connections = data.conns;
                STATE.history = [];
                STATE.redoStack = [];
                STATE.refPoints = [];
                STATE.refConnections = [];
                centerView();
            }
        } catch (error) {
            alert(error);
        }
        
        UI.dropdown.classList.add('hidden');
        e.target.value = ''; // Reseta o input
    };

    reader.readAsText(file);
}

document.getElementById('file-upload').addEventListener('change', (e) => handleFileUpload(e, false));
document.getElementById('ref-upload').addEventListener('change', (e) => handleFileUpload(e, true));

window.addEventListener('resize', () => { UI.canvas.width = UI.canvas.parentElement.clientWidth; UI.canvas.height = UI.canvas.parentElement.clientHeight; import('./render.js').then(module => module.render()); });
UI.canvas.width = UI.canvas.parentElement.clientWidth; UI.canvas.height = UI.canvas.parentElement.clientHeight;

// EXPORTS
document.getElementById('btn-salvar-projeto').addEventListener('click', () => { const nA = (prompt("Nome do Backup:", "backup") || "backup").trim(); const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ pontos: STATE.points, linhas: STATE.connections })); a.download = nA + ".json"; a.click(); UI.dropdown.classList.add('hidden'); });
document.getElementById('btn-exportar-pdf').addEventListener('click', () => { if (STATE.points.length === 0) return; const nO = prompt("Nome da Obra:", "LEVANTAMENTO") || "RELATORIO"; const { jsPDF } = window.jspdf; const doc = new jsPDF(); doc.setFillColor(30,30,30); doc.rect(0,0,210,35,'F'); doc.setTextColor(76,175,80); doc.setFontSize(22); doc.text("GEOCANVAS REPORT", 15, 18); const tC = document.createElement('canvas'); tC.width=UI.canvas.width; tC.height=UI.canvas.height; const tCtx = tC.getContext('2d'); tCtx.fillStyle='#121212'; tCtx.fillRect(0,0,tC.width,tC.height); tCtx.drawImage(UI.canvas,0,0); doc.addImage(tC.toDataURL('image/jpeg',0.8), 'JPEG', 15, 45, 180, 100); doc.autoTable({ startY: 155, head: [['ID', 'NORTE', 'ESTE', 'COTA']], body: STATE.points.map(p => [p.id, p.y.toFixed(3), p.x.toFixed(3), p.z.toFixed(3)]), headStyles: { fillColor: [76, 175, 80] } }); doc.save(nO + ".pdf"); UI.dropdown.classList.add('hidden'); });
document.getElementById('btn-exportar-dxf').addEventListener('click', () => { if (STATE.points.length === 0) return; const nA = (prompt("Nome do arquivo DXF:", "projeto") || "projeto").trim(); let d = "0\nSECTION\n2\nENTITIES\n"; STATE.points.forEach(p => { d += `0\nPOINT\n8\nPONTOS\n10\n${p.x}\n20\n${p.y}\n30\n${p.z}\n`; const s = CONFIG.CROSS_SIZE; d += `0\nLINE\n8\nPONTOS_SYM\n10\n${p.x-s}\n20\n${p.y}\n30\n${p.z}\n11\n${p.x+s}\n21\n${p.y}\n31\n${p.z}\n`; d += `0\nLINE\n8\nPONTOS_SYM\n10\n${p.x}\n20\n${p.y-s}\n30\n${p.z}\n11\n${p.x}\n21\n${p.y+s}\n31\n${p.z}\n`; d += `0\nTEXT\n8\nPONTOS_ID\n10\n${p.x+0.15}\n20\n${p.y+0.15}\n30\n${p.z}\n40\n0.8\n1\n${p.id}\n`; }); STATE.connections.forEach(l => d += `0\nLINE\n8\nLIGACOES\n10\n${l.a.x}\n20\n${l.a.y}\n30\n${l.a.z}\n11\n${l.b.x}\n21\n${l.b.y}\n31\n${l.b.z}\n`); d += "0\nENDSEC\n0\nEOF\n"; const blob = new Blob([d], { type: "application/dxf" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nA + ".dxf"; a.click(); UI.dropdown.classList.add('hidden'); });