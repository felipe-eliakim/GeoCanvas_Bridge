/**
 * MÓDULO DE IMPORTAÇÃO DXF
 * Responsável por ler arquivos .dxf e extrair pontos e conexões (linhas).
 */

export function parseDXF(fileContent) {
    return new Promise((resolve, reject) => {
        try {
            // Instancia o parser fornecido pela biblioteca dxf-parser
            const parser = new DxfParser();
            const dxf = parser.parseSync(fileContent);
            
            const pts = [];
            const conns = [];
            let pointIdCounter = 1;

            if (!dxf || !dxf.entities) {
                reject("Arquivo DXF inválido ou sem entidades.");
                return;
            }

            dxf.entities.forEach(entity => {
                // 1. Extrair Pontos (POINT)
                if (entity.type === 'POINT') {
                    pts.push({
                        id: `DXF-P${pointIdCounter++}`,
                        x: entity.position.x,
                        y: entity.position.y,
                        z: entity.position.z || 0
                    });
                }
                
                // 2. Extrair Linhas Simples (LINE)
                else if (entity.type === 'LINE') {
                    const p1 = {
                        id: `DXF-L${pointIdCounter++}a`,
                        x: entity.vertices[0].x,
                        y: entity.vertices[0].y,
                        z: entity.vertices[0].z || 0
                    };
                    const p2 = {
                        id: `DXF-L${pointIdCounter++}b`,
                        x: entity.vertices[1].x,
                        y: entity.vertices[1].y,
                        z: entity.vertices[1].z || 0
                    };
                    
                    pts.push(p1, p2);
                    conns.push({ a: p1, b: p2 });
                }

                // 3. Extrair Polilinhas (POLYLINE / LWPOLYLINE)
                else if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
                    if (entity.vertices && entity.vertices.length > 1) {
                        const polyPts = [];
                        entity.vertices.forEach(v => {
                             const p = {
                                id: `DXF-PL${pointIdCounter++}`,
                                x: v.x,
                                y: v.y,
                                z: v.z || 0
                            };
                            pts.push(p);
                            polyPts.push(p);
                        });

                        for (let i = 0; i < polyPts.length - 1; i++) {
                            conns.push({ a: polyPts[i], b: polyPts[i + 1] });
                        }
                        
                        if (entity.shape) {
                             conns.push({ a: polyPts[polyPts.length - 1], b: polyPts[0] });
                        }
                    }
                }
            });

            resolve({ pts, conns });

        } catch (error) {
            console.error("Erro ao processar o arquivo DXF:", error);
            reject("Falha ao ler o formato DXF. Verifique se o arquivo está corrompido.");
        }
    });
}