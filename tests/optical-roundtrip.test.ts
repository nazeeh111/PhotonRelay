// Actual optical codec path: production QR raster -> vendored WASM decoder.
// Synthetic pixels exercise the image decoder, not just frame serialization.
// This is not a camera/lighting/rolling-shutter hardware test.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import DecimenCodec, { type DecimenModule } from "../vendor/decimen-codec/decimen_codec.js";
import { createFrameQr, QUIET_ZONE_MODULES } from "../send/qr-frame.ts";
import { rasterizeQr } from "../shared/qr-raster.ts";
import { effectiveFrameBytes } from "../shared/send-settings.ts";
import { blockLength } from "../shared/frame-capacity.ts";
import { LTEncoder, LTDecoder } from "../shared/fountain.ts";
import { fnv1a, packFile, packFrame, parseFrame, splitmix32, unpackFile, verifyFile } from "../shared/protocol.ts";
import { packSnippet, snippetText } from "../shared/snippet.ts";
import { DecodeWorkerPool, type PoolWorker } from "../shared/worker-pool.ts";

const wasm = new WebAssembly.Module(readFileSync(new URL("../vendor/decimen-codec/decimen_codec.wasm", import.meta.url)));
const ready = DecimenCodec({instantiateWasm(imports, done) {
  done(new WebAssembly.Instance(wasm, imports), wasm);
  return {};
}});

/** Bilinear camera-like resampling, including noninteger module scale. */
function resample(pixels: Uint32Array, side: number, scale: number): { rgba: Uint8Array; side: number } {
  const size = Math.round(side*scale);
  const out = new Uint8Array(size*size*4);
  const gray = (x: number, y: number) => pixels[Math.max(0,Math.min(side-1,y))*side+Math.max(0,Math.min(side-1,x))]! & 0xff;
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const sx=(x+.5)*side/size-.5, sy=(y+.5)*side/size-.5;
    const ix=Math.floor(sx), iy=Math.floor(sy), fx=sx-ix, fy=sy-iy;
    const value=Math.round((1-fy)*((1-fx)*gray(ix,iy)+fx*gray(ix+1,iy))+fy*((1-fx)*gray(ix,iy+1)+fx*gray(ix+1,iy+1)));
    const pos=(y*size+x)*4;out[pos]=out[pos+1]=out[pos+2]=value;out[pos+3]=255;
  }
  return {rgba:out,side:size};
}

function decodePixels(codec: DecimenModule, wire: Uint8Array, scale: number): Uint8Array {
  const qr=createFrameQr(wire,"L",undefined);
  const raster=rasterizeQr(qr.modules.size,qr.modules.data,QUIET_ZONE_MODULES);
  const capture=resample(raster.pixels,raster.size,scale);
  const ptr=codec._malloc(capture.rgba.length);
  try {
    codec.HEAPU8.set(capture.rgba,ptr);
    const symbols=codec.readFull(ptr,capture.side,capture.side,true,12,true);
    try {
      for(let i=0;i<symbols.size();i++) {
        const symbol=symbols.get(i);
        if(symbol.valid && symbol.bytes.length) return new Uint8Array(symbol.bytes);
      }
      assert.fail(`WASM failed to decode QR version ${qr.version} at ${scale} pixels/module`);
    } finally {symbols.delete();}
  } finally {codec._free(ptr);}
}

async function transfer(container: Uint8Array, scale: number, loss=false) {
  const codec=await ready;
  const bytes=effectiveFrameBytes(1465,container.length), blockLen=blockLength(bytes), sessionId=0xbabe;
  const encoder=new LTEncoder(container,blockLen,sessionId), payloadFnv=fnv1a(container);
  let decoder: LTDecoder | undefined;
  let decodedFrames=0, dropped=0, duplicated=0;
  for(let seq=0; !decoder?.isComplete; seq++) {
    assert.ok(seq<300,"optical transfer did not complete within its frame bound");
    // Drop the first systematic frame too, proving recovery through redundancy.
    if(loss && seq%4===0) {dropped++;continue;}
    const wire=packFrame({sessionId,seq,k:encoder.k,blockLen,totalLen:container.length,payloadFnv,flags:0},encoder.encode(seq));
    const optical=decodePixels(codec,wire,scale);
    assert.deepEqual(optical,wire,"QR decoder must reproduce every wire byte");
    const parsed=parseFrame(optical);assert.ok(parsed);
    decoder??=new LTDecoder(parsed.header.k,parsed.header.blockLen,parsed.header.sessionId,parsed.header.totalLen);
    decoder.addFrame(parsed.header.seq,parsed.block);decodedFrames++;
    if(loss && seq%3===0) {decoder.addFrame(parsed.header.seq,parsed.block);duplicated++;}
  }
  const recovered=decoder!.assemble();assert.ok(recovered);
  assert.equal(fnv1a(recovered),payloadFnv);
  assert.deepEqual(recovered,container);
  const file=await unpackFile(recovered);assert.ok(await verifyFile(file));
  return {file,decodedFrames,dropped,duplicated,k:encoder.k};
}

test("production WASM decodes a small UTF-8 snippet from QR pixels",async()=>{
  const text="PhotonRelay: quantum → photons 🔬 مرحباً";
  const packed=await packSnippet(text);
  const recovered=await transfer(packed.container,4);
  assert.equal(snippetText(recovered.file),text);
  assert.equal(recovered.k,1);
});

test("binary and Unicode filename survive actual QR decoding with dropped and duplicate frames",async()=>{
  const bytes=new Uint8Array(24000), random=splitmix32(7731);
  for(let i=0;i<bytes.length;i++)bytes[i]=random()&255;
  const packed=await packFile("résumé-量子.bin","application/octet-stream",bytes);
  const recovered=await transfer(packed.container,3.25,true);
  assert.ok(recovered.k>10);
  assert.ok(recovered.dropped>0 && recovered.duplicated>0);
  assert.equal(recovered.file.name,"résumé-量子.bin");
  assert.deepEqual(recovered.file.bytes,bytes);
});

test("production WASM reads maximum-size QR wire bytes at 3 pixels/module",async()=>{
  const codec=await ready;
  const wire=new Uint8Array(2953), random=splitmix32(919);
  for(let i=0;i<wire.length;i++)wire[i]=random()&255;
  assert.deepEqual(decodePixels(codec,wire,3),wire);
});

class FailingWorker implements PoolWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  terminated = false;
  throwOnSend = false;
  postMessage() {if(this.throwOnSend)throw Error("worker stopped");}
  terminate() {this.terminated=true;}
}

for(const mode of ["initialization", "worker-error", "message-error", "send-error"] as const) {
  test(`decoder ${mode} releases busy slots and reports a visible failure callback`,()=>{
    const workers: FailingWorker[]=[];
    let failures=0;
    const pool=new DecodeWorkerPool(()=>{const w=new FailingWorker();workers.push(w);return w;},()=>assert.fail("no payload expected"),undefined,undefined,()=>failures++);
    pool.resize(2);
    const first=workers[0]!;
    if(mode==="send-error")first.throwOnSend=true;
    pool.submit({id:1},[]);
    if(mode==="initialization")first.onmessage?.({data:{id:-1,error:"decoder-unavailable",symbols:[]}} as MessageEvent);
    if(mode==="worker-error")first.onerror?.({preventDefault(){}} as ErrorEvent);
    if(mode==="message-error")first.onmessageerror?.({} as MessageEvent);
    assert.equal(failures,1);assert.equal(pool.size,0);assert.equal(pool.busyCount,0);
    assert.ok(workers.every(w=>w.terminated));assert.equal(pool.submit({id:2},[]),false);
    // A late error from a retired worker must not destroy a newly created pool.
    pool.resize(1);first.onerror?.({preventDefault(){}} as ErrorEvent);
    assert.equal(pool.size,1);assert.equal(failures,1);
    pool.resize(0);
  });
}

test("synchronous Worker construction failure becomes a reported pool failure",()=>{
  let failures=0;
  const pool=new DecodeWorkerPool(()=>{throw Error("worker blocked");},()=>{},undefined,undefined,()=>failures++);
  assert.doesNotThrow(()=>pool.resize(2));assert.equal(failures,1);assert.equal(pool.size,0);
});
