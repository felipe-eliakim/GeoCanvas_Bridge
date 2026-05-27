import { STATE, UI, CONFIG } from './state.js';

function drawTensionedSpline(points) {
    if (points.length < 2) return;
    const t = points.map(p => ({ x: p.x * STATE.view.scale + STATE.view.offsetX, y: -p.y * STATE.view.scale + STATE.view.offsetY }));
    UI.ctx.moveTo(t[0].x, t[0].y);
    if (t.length === 2) { UI.ctx.lineTo(t[1].x, t[1].y); return; }
    for (let i = 0; i < t.length - 1; i++) {
        const p0 = t[Math.max(0, i-1)], p1 = t[i], p2 = t[i+1], p3 = t[Math.min(t.length-1, i+2)];
        const s = CONFIG.CURVE_TENSION;
        UI.ctx.bezierCurveTo(p1.x+(p2.x-p0.x)*s, p1.y+(p2.y-p0.y)*s, p2.x-(p3.x-p1.x)*s, p2.y-(p3.y-p1.y)*s, p2.x, p2.y);
    }
}

export function renderMinimap() {
    if (STATE.points.length === 0) { UI.minimapContainer.classList.add('hidden'); return; }
    UI.minimapContainer.classList.remove('hidden');
    
    const mCtx = UI.minimapCanvas.getContext('2d');
    const w = UI.minimapCanvas.width;
    const h = UI.minimapCanvas.height;
    mCtx.clearRect(0, 0, w, h);

    const visibleWidthReal = UI.canvas.width / STATE.view.scale;
    const visibleHeightReal = UI.canvas.height / STATE.view.scale;
    const minimapRangeX = visibleWidthReal * CONFIG.MINIMAP_CONTEXT_FACTOR;
    const minimapRangeY = visibleHeightReal * CONFIG.MINIMAP_CONTEXT_FACTOR;
    const camCenterX = (UI.canvas.width / 2 - STATE.view.offsetX) / STATE.view.scale;
    const camCenterY = -(UI.canvas.height / 2 - STATE.view.offsetY) / STATE.view.scale;

    STATE.minimap.scale = Math.min(w / minimapRangeX, h / minimapRangeY);
    STATE.minimap.offsetX = w / 2 - camCenterX * STATE.minimap.scale;
    STATE.minimap.offsetY = h / 2 + camCenterY * STATE.minimap.scale;

    mCtx.strokeStyle = 'rgba(255,255,255,0.08)'; mCtx.lineWidth = 1;
    STATE.connections.forEach(l => {
        mCtx.beginPath();
        mCtx.moveTo(l.a.x * STATE.minimap.scale + STATE.minimap.offsetX, -l.a.y * STATE.minimap.scale + STATE.minimap.offsetY);
        mCtx.lineTo(l.b.x * STATE.minimap.scale + STATE.minimap.offsetX, -l.b.y * STATE.minimap.scale + STATE.minimap.offsetY);
        mCtx.stroke();
    });

    mCtx.fillStyle = '#00ffcc';
    STATE.points.forEach(p => {
        const mx = p.x * STATE.minimap.scale + STATE.minimap.offsetX;
        const my = -p.y * STATE.minimap.scale + STATE.minimap.offsetY;
        if (mx > 0 && mx < w && my > 0 && my < h) mCtx.fillRect(mx - 1, my - 1, 2, 2);
    });

    const rectW = (UI.canvas.width / STATE.view.scale) * STATE.minimap.scale;
    const rectH = (UI.canvas.height / STATE.view.scale) * STATE.minimap.scale;
    mCtx.strokeStyle = '#4CAF50'; mCtx.lineWidth = 2;
    mCtx.strokeRect((w - rectW) / 2, (h - rectH) / 2, rectW, rectH);
    mCtx.fillStyle = 'rgba(76, 175, 80, 0.15)';
    mCtx.fillRect((w - rectW) / 2, (h - rectH) / 2, rectW, rectH);
}

export function render() {
    UI.ctx.clearRect(0, 0, UI.canvas.width, UI.canvas.height);

    const scale = STATE.view.scale;
    const offsetX = STATE.view.offsetX;
    const offsetY = STATE.view.offsetY;

    // === DESENHAR PLANTA DE FUNDO CAD ===
    if (STATE.refVisualEntities && STATE.refVisualEntities.length > 0) {
        UI.ctx.lineWidth = 1;
        UI.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; 

        // 1. Linhas e Polilinhas
        UI.ctx.beginPath();
        STATE.refVisualEntities.forEach(ent => {
            if (ent.type === 'LINE') {
                UI.ctx.moveTo(ent.start.x * scale + offsetX, -ent.start.y * scale + offsetY);
                UI.ctx.lineTo(ent.end.x * scale + offsetX, -ent.end.y * scale + offsetY);
            } 
            else if (ent.type === 'POLYLINE') {
                if (ent.vertices.length < 2) return;
                UI.ctx.moveTo(ent.vertices[0].x * scale + offsetX, -ent.vertices[0].y * scale + offsetY);
                for (let i = 1; i < ent.vertices.length; i++) {
                    UI.ctx.lineTo(ent.vertices[i].x * scale + offsetX, -ent.vertices[i].y * scale + offsetY);
                }
                if (ent.closed) {
                    UI.ctx.lineTo(ent.vertices[0].x * scale + offsetX, -ent.vertices[0].y * scale + offsetY);
                }
            }
        });
        UI.ctx.stroke(); 

        // 2. Arcos e Círculos
        UI.ctx.beginPath();
        STATE.refVisualEntities.forEach(ent => {
            if (ent.type === 'CIRCLE') {
                UI.ctx.moveTo(ent.center.x * scale + offsetX + ent.radius * scale, -ent.center.y * scale + offsetY);
                UI.ctx.arc(ent.center.x * scale + offsetX, -ent.center.y * scale + offsetY, ent.radius * scale, 0, 2 * Math.PI);
            } 
            else if (ent.type === 'ARC') {
                const startRad = -ent.startAngle * Math.PI / 180;
                const endRad = -ent.endAngle * Math.PI / 180;
                const startX = ent.center.x * scale + offsetX + (ent.radius * scale) * Math.cos(startRad);
                const startY = -ent.center.y * scale + offsetY + (ent.radius * scale) * Math.sin(startRad);
                UI.ctx.moveTo(startX, startY);
                UI.ctx.arc(ent.center.x * scale + offsetX, -ent.center.y * scale + offsetY, ent.radius * scale, startRad, endRad, true);
            }
        });
        UI.ctx.stroke();

        // 3. Textos Otimizados (PADRÃO COERENTE DE CORES E SIZES)
        if (scale > 0.8) { 
            UI.ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
            UI.ctx.font = '11px Roboto, sans-serif'; // FIXO: Mesmo tamanho para evitar disparidades
            
            STATE.refVisualEntities.forEach(ent => {
                if (ent.type === 'TEXT') {
                    const tx = ent.position.x * scale + offsetX;
                    const ty = -ent.position.y * scale + offsetY;
                    if (tx > -50 && tx < UI.canvas.width + 50 && ty > -50 && ty < UI.canvas.height + 50) {
                        UI.ctx.fillText(ent.text, tx, ty);
                    }
                }
            });
        }
    }

    // Vértices de atração ocultos
    if (STATE.refPoints.length > 0 && scale > 1.5) {
        UI.ctx.fillStyle = 'rgba(255, 152, 0, 0.15)';
        STATE.refPoints.forEach(p => {
            const tx = p.x * scale + offsetX, ty = -p.y * scale + offsetY;
            if (tx > 0 && tx < UI.canvas.width && ty > 0 && ty < UI.canvas.height) {
                UI.ctx.fillRect(tx - 1, ty - 1, 2, 2);
            }
        });
    }

    if (STATE.points.length === 0) return;

    // Curvas de nível
    if (STATE.currentTool === 'CONTOUR') {
        if (STATE.showMesh) {
            UI.ctx.strokeStyle = 'rgba(255,255,255,0.03)'; UI.ctx.lineWidth = 1; UI.ctx.beginPath();
            STATE.tinMesh.forEach(tr => {
                UI.ctx.moveTo(tr.a.x * scale + offsetX, -tr.a.y * scale + offsetY);
                UI.ctx.lineTo(tr.b.x * scale + offsetX, -tr.b.y * scale + offsetY);
                UI.ctx.lineTo(tr.c.x * scale + offsetX, -tr.c.y * scale + offsetY);
                UI.ctx.closePath();
            });
            UI.ctx.stroke();
        }
        STATE.contours.forEach(poly => {
            UI.ctx.beginPath(); const isMestra = poly.z % 5 === 0;
            UI.ctx.strokeStyle = isMestra ? 'rgba(255,152,0,0.9)' : 'rgba(255,152,0,0.4)'; UI.ctx.lineWidth = isMestra ? 2.5 : 1.2;
            drawTensionedSpline(poly.points); UI.ctx.stroke();
        });
    }

    // Linhas de conexões do usuário
    UI.ctx.strokeStyle = '#ffffff'; UI.ctx.lineWidth = 1.5;
    STATE.connections.forEach(l => {
        UI.ctx.beginPath();
        UI.ctx.moveTo(l.a.x * scale + offsetX, -l.a.y * scale + offsetY);
        UI.ctx.lineTo(l.b.x * scale + offsetX, -l.b.y * scale + offsetY);
        UI.ctx.stroke();
    });

    // Pontos do Levantamento Ativo (PADRONIZADO TAMBÉM EM 11PX)
    STATE.points.forEach(p => {
        const tx = p.x * scale + offsetX, ty = -p.y * scale + offsetY;
        if (tx < -100 || tx > UI.canvas.width + 100 || ty < -100 || ty > UI.canvas.height + 100) return;
        UI.ctx.strokeStyle = '#00ffcc'; UI.ctx.lineWidth = 1.5; UI.ctx.beginPath();
        UI.ctx.moveTo(tx-5, ty); UI.ctx.lineTo(tx+5, ty); UI.ctx.moveTo(tx, ty-5); UI.ctx.lineTo(tx, ty+5); UI.ctx.stroke();
        if(scale > 0.08) { 
            UI.ctx.fillStyle = p.isCollected ? '#00ffcc' : '#ffffff'; // Destaca pontos coletados em turquesa
            UI.ctx.font = '11px Roboto, sans-serif'; // FIXO: Idêntico ao padrão adotado
            UI.ctx.fillText(p.id, tx+7, ty-7); 
        }
    });

    const ax = STATE.isTouchDevice ? UI.canvas.width / 2 : STATE.mouse.x;
    const ay = STATE.isTouchDevice ? UI.canvas.height / 2 : STATE.mouse.y;

    if (STATE.activePoint && (STATE.currentTool === 'MEASURE' || STATE.currentTool === 'GROUP')) {
        UI.ctx.beginPath(); UI.ctx.setLineDash([5, 5]);
        UI.ctx.strokeStyle = STATE.currentTool === 'MEASURE' ? '#ffeb3b' : '#2196F3';
        UI.ctx.moveTo(STATE.activePoint.x * scale + offsetX, -STATE.activePoint.y * scale + offsetY);
        UI.ctx.lineTo(STATE.focusedPoint ? STATE.focusedPoint.x * scale + offsetX : ax, STATE.focusedPoint ? -STATE.focusedPoint.y * scale + offsetY : ay);
        UI.ctx.stroke(); UI.ctx.setLineDash([]);
    }

    if (STATE.focusedPoint) {
        const tx = STATE.focusedPoint.x * scale + offsetX, ty = -STATE.focusedPoint.y * scale + offsetY;
        UI.ctx.strokeStyle = STATE.focusedPoint.isRef ? '#ff9800' : '#ffff00'; 
        UI.ctx.lineWidth = 2; 
        UI.ctx.strokeRect(tx-8, ty-8, 16, 16);
    }
    renderMinimap();
}