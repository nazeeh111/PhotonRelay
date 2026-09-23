/** Reproducible PhotonRelay raster icons; no external image tool required. */
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { PNG_SIGNATURE, pngChunk, concatBytes } from "../shared/png";
const output = new URL("../public/", import.meta.url);
for (const [name, size, scale] of [["icon-192.png",192,1],["icon-512.png",512,1],["icon-maskable-512.png",512,0.72],["apple-touch-icon.png",180,0.85]] as const) {
  const rows = new Uint8Array((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5 - size / 2) / (size * scale), dy = (y + 0.5 - size / 2) / (size * scale);
    const radius = Math.hypot(dx, dy);
    const lit = radius < 0.065 || Math.abs(radius-0.19)<0.018 || Math.abs(radius-0.32)<0.018 || (Math.abs(dy)<0.015 && Math.abs(dx)<0.4);
    const off = y * (size*3+1)+1+x*3;
    rows.set(lit ? [169,162,255] : [8,13,25], off);
  }
  const header = new Uint8Array(13), dv = new DataView(header.buffer);
  dv.setUint32(0,size);dv.setUint32(4,size);header[8]=8;header[9]=2;
  writeFileSync(new URL(name, output),concatBytes([PNG_SIGNATURE,pngChunk("IHDR",header),pngChunk("IDAT",deflateSync(rows)),pngChunk("IEND",new Uint8Array())]));
}

// Original share card, drawn from the same rings and a small pixel alphabet.
// This generates new pixels; no upstream photograph or artwork is edited.
const width=1200,height=630, pixels=new Uint8Array(width*height*3);
for(let i=0;i<pixels.length;i+=3)pixels.set([8,13,25],i);
const put=(x:number,y:number,color:number[])=>{if(x>=0&&x<width&&y>=0&&y<height)pixels.set(color,(y*width+x)*3);};
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const r=Math.hypot(x-210,y-315);
 if(r<22||Math.abs(r-66)<5||Math.abs(r-112)<5||(Math.abs(y-315)<4&&Math.abs(x-210)<140))put(x,y,[169,162,255]);
}
const alphabet:Record<string,string[]>={
 P:['11110','10001','10001','11110','10000','10000','10000'],H:['10001','10001','10001','11111','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],T:['11111','00100','00100','00100','00100','00100','00100'],N:['10001','11001','11001','10101','10011','10011','10001'],R:['11110','10001','10001','11110','10100','10010','10001'],E:['11111','10000','10000','11110','10000','10000','11111'],L:['10000','10000','10000','10000','10000','10000','11111'],A:['01110','10001','10001','11111','10001','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100']};
for(const [i,char]of [...'PHOTONRELAY'].entries())for(const [row,line]of alphabet[char]!.entries())for(const [col,v]of [...line].entries())if(v==='1')for(let dy=0;dy<9;dy++)for(let dx=0;dx<9;dx++)put(410+i*62+col*9+dx,283+row*9+dy,[221,221,245]);
const rows=new Uint8Array((width*3+1)*height);for(let y=0;y<height;y++)rows.set(pixels.subarray(y*width*3,(y+1)*width*3),y*(width*3+1)+1);
const ihdr=new Uint8Array(13), view=new DataView(ihdr.buffer);view.setUint32(0,width);view.setUint32(4,height);ihdr[8]=8;ihdr[9]=2;
writeFileSync(new URL('og.png',output),concatBytes([PNG_SIGNATURE,pngChunk('IHDR',ihdr),pngChunk('IDAT',deflateSync(rows)),pngChunk('IEND',new Uint8Array())]));

// ICO container with our generated 192-pixel PNG (PNG-in-ICO is standard).
const icon=readFileSync(new URL("icon-192.png",output));
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico[6]=192;ico[7]=192;ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(icon.length,14);ico.writeUInt32LE(22,18);
writeFileSync(new URL("favicon.ico",output),Buffer.concat([ico,icon]));
