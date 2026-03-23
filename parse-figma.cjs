const fs = require('fs');
const d = JSON.parse(fs.readFileSync('C:/DATASAID/PAKYAIR/GUIDEDGROWTHMVP-NEW/figma-voice.json', 'utf8'));
const nodes = d.nodes;
for (const [k, v] of Object.entries(nodes)) {
  console.log('\n========= NODE:', k, '=========');
  extract(v.document, 0);
}
function extract(node, depth) {
  const indent = '  '.repeat(depth);
  const bb = node.absoluteBoundingBox;
  const w = bb ? Math.round(bb.width) : '';
  const h = bb ? Math.round(bb.height) : '';
  const r = node.cornerRadius;
  const fills = (node.fills || []).filter(f => f.visible !== false);
  let fillStr = '';
  for (const f of fills) {
    if (f.type === 'SOLID' && f.color) {
      const c = f.color;
      fillStr += ` fill:rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${c.a.toFixed(2)})`;
    } else if (f.type && f.type.includes('GRADIENT')) {
      const stops = (f.gradientStops || []).map(s => {
        const c = s.color;
        return `${Math.round(s.position*100)}%:rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${c.a.toFixed(2)})`;
      });
      fillStr += ` gradient:[${stops.join(',')}]`;
    }
  }
  const effects = (node.effects || []).filter(e => e.visible !== false);
  let effectStr = '';
  for (const e of effects) {
    if (e.color) {
      const c = e.color;
      effectStr += ` ${e.type}(${e.offset?.x||0},${e.offset?.y||0},${e.radius||0},rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${c.a.toFixed(2)}))`;
    }
  }
  let textStr = '';
  if (node.characters) textStr = ` "${node.characters}"`;
  if (node.style) textStr += ` font:${node.style.fontFamily}/${node.style.fontSize}/${node.style.fontWeight}`;
  const opacity = node.opacity != null && node.opacity < 1 ? ` opacity:${node.opacity.toFixed(2)}` : '';
  console.log(`${indent}[${node.type}] "${node.name}" ${w}x${h} ${r?'r:'+r:''}${fillStr}${effectStr}${opacity}${textStr}`);
  if (node.children && depth < 6) node.children.forEach(c => extract(c, depth+1));
}
