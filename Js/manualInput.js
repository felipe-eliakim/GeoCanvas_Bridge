/**
 * MÓDULO DE NAVEGAÇÃO DO GEOCANVAS
 * Responsável por gerenciar o Pan (arrastar) e Zoom (aproximar/afastar)
 */

// IMPORTANTE: Aqui você importa a sua função que desenha os pontos na tela!
// Troque './render.js' para o arquivo correto onde a sua função render() mora.
import { render } from './render.js'; 

// === ESTADO GLOBAL DA CÂMERA ===
export const camera = {
  x: 0,       
  y: 0,       
  scale: 1,   
};

// === ESTADO INTERNO ===
let isDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

// Função tradutora para Mouse e Touch
function getPointerPos(e) {
  if (e.touches && e.touches.length > 0) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
}

// INÍCIO DO CLIQUE/TOQUE
const handlePointerDown = (e) => {
  if (e.type === 'touchstart') e.preventDefault();
  if (e.type === 'mousedown' && e.button !== 0 && e.button !== 1) return;

  isDragging = true;
  const pos = getPointerPos(e);
  lastPointerX = pos.x;
  lastPointerY = pos.y;
};

// MOVIMENTO DO MOUSE/DEDO
const handlePointerMove = (e) => {
  if (!isDragging) return;
  e.preventDefault();

  const pos = getPointerPos(e);
  const deltaX = pos.x - lastPointerX;
  const deltaY = pos.y - lastPointerY;

  // Atualiza a posição da câmera
  camera.x += deltaX;
  camera.y += deltaY;

  lastPointerX = pos.x;
  lastPointerY = pos.y;

  // GATILHO: Manda o Canvas se redesenhar com a nova posição da câmera
  render(); 
};

// FIM DO CLIQUE/TOQUE
const handlePointerUp = () => {
  isDragging = false;
};

// ZOOM PELO SCROLL
const handleWheel = (e) => {
  e.preventDefault(); 
  const zoomFactor = 1.1;
  const direction = e.deltaY > 0 ? -1 : 1; 
  const oldScale = camera.scale;

  if (direction > 0) {
    camera.scale = Math.min(camera.scale * zoomFactor, 10);
  } else {
    camera.scale = Math.max(camera.scale / zoomFactor, 0.1);
  }

  const mouseX = e.clientX;
  const mouseY = e.clientY;

  camera.x = mouseX - (mouseX - camera.x) * (camera.scale / oldScale);
  camera.y = mouseY - (mouseY - camera.y) * (camera.scale / oldScale);

  // GATILHO: Manda o Canvas se redesenhar com o novo zoom
  render();
};

// FUNÇÃO DE INICIALIZAÇÃO
export function initNavigation(canvas) {
  canvas.addEventListener('mousedown', handlePointerDown);
  canvas.addEventListener('mousemove', handlePointerMove);
  canvas.addEventListener('mouseup', handlePointerUp);
  canvas.addEventListener('mouseleave', handlePointerUp); 
  canvas.addEventListener('wheel', handleWheel, { passive: false }); 

  canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
  canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
  canvas.addEventListener('touchend', handlePointerUp);
  canvas.addEventListener('touchcancel', handlePointerUp);
}