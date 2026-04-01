const path = require('path');
const fs   = require('fs');

const svgSrc = `<svg width="256" height="256" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5b7cf6"/>
      <stop offset="100%" stop-color="#7c5cf6"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="56" fill="url(#g)"/>
  <path d="M80 64L208 128L80 192V64Z" fill="white"/>
</svg>`;

const outDir = path.join(__dirname, '../assets');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

(async () => {
  let sharp;
  try { sharp = require('sharp'); } catch {
    console.error('sharp not installed. Run: npm install --save-dev sharp');
    process.exit(1);
  }

  const svgBuf = Buffer.from(svgSrc);

  await sharp(svgBuf).resize(256, 256).png().toFile(path.join(outDir, 'icon.png'));
  console.log('assets/icon.png created');

  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBufs = await Promise.all(
    sizes.map(s => sharp(svgBuf).resize(s, s).png().toBuffer())
  );

  const icoPath = path.join(outDir, 'icon.ico');
  fs.writeFileSync(icoPath, buildIco(sizes, pngBufs));
  console.log('assets/icon.ico created');
})();

function buildIco(sizes, pngBufs) {
  const count = sizes.length;
  const headerSize  = 6;
  const dirEntrySize = 16;
  const dataOffset  = headerSize + dirEntrySize * count;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);    
  header.writeUInt16LE(1, 2);     
  header.writeUInt16LE(count, 4); 

  let offset = dataOffset;
  const entries = [];
  for (let i = 0; i < count; i++) {
    const s   = sizes[i];
    const buf = pngBufs[i];
    const e   = Buffer.alloc(16);
    e.writeUInt8(s === 256 ? 0 : s, 0);  
    e.writeUInt8(s === 256 ? 0 : s, 1); 
    e.writeUInt8(0, 2);                   
    e.writeUInt8(0, 3);           
    e.writeUInt16LE(1, 4);            
    e.writeUInt16LE(32, 6);           
    e.writeUInt32LE(buf.length, 8);      
    e.writeUInt32LE(offset, 12);  
    entries.push(e);
    offset += buf.length;
  }

  return Buffer.concat([header, ...entries, ...pngBufs]);
}
