import { STATE } from './state.js';
import { render } from './render.js';

/**
 * Remove um ponto específico do sistema e limpa todas as conexões amarradas a ele.
 * @param {Object} pointToDelete Objeto do ponto que será removido.
 */
export function deletePoint(pointToDelete) {
    if (!pointToDelete || pointToDelete.isRef) return;

    // 1. Salva o estado atual na árvore de histórico (mecanismo Undo/Ctrl+Z)
    STATE.history.push({ 
        points: JSON.parse(JSON.stringify(STATE.points)), 
        connections: JSON.parse(JSON.stringify(STATE.connections)) 
    });
    if (STATE.history.length > 50) STATE.history.shift();
    STATE.redoStack = [];

    // 2. Filtra o array de pontos removendo o ponto selecionado
    STATE.points = STATE.points.filter(p => p.id !== pointToDelete.id);

    // 3. Filtra as conexões removendo qualquer linha que usava esse ponto como quina (origem ou destino)
    STATE.connections = STATE.connections.filter(c => c.a.id !== pointToDelete.id && c.b.id !== pointToDelete.id);

    // 4. Se o ponto apagado era o nó ativo de uma medição/ligação, reseta o estado
    if (STATE.activePoint && STATE.activePoint.id === pointToDelete.id) {
        STATE.activePoint = null;
    }

    // 5. Limpa o foco para fechar o HUD
    STATE.focusedPoint = null;

    // 6. Atualiza o estado visual dos botões de desfazer/refazer na tela
    const undoBtn = document.getElementById('btn-undo');
    if (undoBtn) undoBtn.disabled = STATE.history.length === 0;

    // 7. Redesenha o Canvas limpo
    render();
}