/**
 * MÓDULO DE IMPORTAÇÃO DXF PRO (CAMINHO B)
 * Extrai vértices discretos para o mecanismo de Snap (Ímã)
 * e reconstrói as entidades originais para desenho fluido na planta de fundo.
 */

export function parseDXF(fileContent) {
    return new Promise((resolve, reject) => {
        try {
            const parser = new DxfParser();
            const dxf = parser.parseSync(fileContent);
            
            const pts = [];
            const conns = [];
            const visualEntities = [];
            let pointIdCounter = 1;

            if (!dxf || !dxf.entities) {
                reject("Arquivo DXF inválido ou sem entidades gráficas.");
                return;
            }

            dxf.entities.forEach(entity => {
                // 1. Extração de Pontos Nativos (POINT)
                if (entity.type === 'POINT') {
                    const p = {
                        id: `DXF-P${pointIdCounter++}`,
                        x: entity.position.x,
                        y: entity.position.y,
                        z: entity.position.z || 0
                    };
                    pts.push(p);
                    visualEntities.push({ type: 'POINT', x: p.x, y: p.y });
                }
                
                // 2. Extração de Linhas Simples (LINE)
                else if (entity.type === 'LINE') {
                    const p1 = { id: `DXF-V${pointIdCounter++}`, x: entity.vertices[0].x, y: entity.vertices[0].y, z: entity.vertices[0].z || 0 };
                    const p2 = { id: `DXF-V${pointIdCounter++}`, x: entity.vertices[1].x, y: entity.vertices[1].y, z: entity.vertices[1].z || 0 };
                    
                    pts.push(p1, p2);
                    conns.push({ a: p1, b: p2 });
                    visualEntities.push({
                        type: 'LINE',
                        start: { x: p1.x, y: p1.y },
                        end: { x: p2.x, y: p2.y }
                    });
                }

                // 3. Extração de Polilinhas complexas (POLYLINE / LWPOLYLINE)
                else if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
                    if (entity.vertices && entity.vertices.length > 1) {
                        const polyPts = [];
                        entity.vertices.forEach(v => {
                             const p = { id: `DXF-V${pointIdCounter++}`, x: v.x, y: v.y, z: v.z || 0 };
                             pts.push(p);
                             polyPts.push(p);
                        });

                        for (let i = 0; i < polyPts.length - 1; i++) {
                            conns.push({ a: polyPts[i], b: polyPts[i + 1] });
                        }
                        if (entity.shape) {
                             conns.push({ a: polyPts[polyPts.length - 1], b: polyPts[0] });
                        }

                        visualEntities.push({
                            type: 'POLYLINE',
                            vertices: polyPts.map(p => ({ x: p.x, y: p.y })),
                            closed: !!entity.shape
                        });
                    }
                }

                // 4. Extração de Círculos (CIRCLE)
                else if (entity.type === 'CIRCLE') {
                    if (entity.center) {
                        visualEntities.push({
                            type: 'CIRCLE',
                            center: { x: entity.center.x, y: entity.center.y },
                            radius: entity.radius
                        });
                        // Cria um ponto invisível no centro para permitir travar o teodolito/estação nele
                        pts.push({ id: `DXF-CTR${pointIdCounter++}`, x: entity.center.x, y: entity.center.y, z: entity.center.z || 0 });
                    }
                }

                // 5. Extração de Arcos (ARC)
                else if (entity.type === 'ARC') {
                    if (entity.center) {
                        visualEntities.push({
                            type: 'ARC',
                            center: { x: entity.center.x, y: entity.center.y },
                            radius: entity.radius,
                            startAngle: entity.startAngle,
                            endAngle: entity.endAngle
                        });
                    }
                }

                // 6. Extração de Textos e Notas Auxiliares (TEXT / MTEXT)
                else if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
                    const pos = entity.startPoint || entity.position;
                    if (pos && entity.text) {
                        visualEntities.push({
                            type: 'TEXT',
                            position: { x: pos.x, y: pos.y },
                            text: entity.text
                        });
                    }
                }
            });

            resolve({ pts, conns, visualEntities });

        } catch (error) {
            console.error("Erro crítico no processamento do DXF:", error);
            reject("Falha ao ler o modelo DXF. Certifique-se de que exportou como ASCII 2013.");
        }
    });
}