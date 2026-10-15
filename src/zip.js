/* Small dependency-free ZIP writer (stored entries; no compression). */
const enc=new TextEncoder();
const table=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0}
const u16=(view,n,v)=>view.setUint16(n,v,true);
const u32=(view,n,v)=>view.setUint32(n,v>>>0,true);
export function createZip(files){
 const parts=[],central=[];let offset=0;const now=new Date(),time=(now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1),date=((Math.max(1980,now.getFullYear())-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
 for(const file of files){const name=enc.encode(file.path.replace(/^\/+/,''));const bytes=file.bytes instanceof Uint8Array?file.bytes:enc.encode(file.value||'');if(name.length>65535||bytes.length>0xffffffff)throw Error('File too large for ZIP');const crc=crc32(bytes);
 const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);u32(v,0,0x04034b50);u16(v,4,20);u16(v,6,0x0800);u16(v,8,0);u16(v,10,time);u16(v,12,date);u32(v,14,crc);u32(v,18,bytes.length);u32(v,22,bytes.length);u16(v,26,name.length);local.set(name,30);parts.push(local,bytes);
 const center=new Uint8Array(46+name.length),d=new DataView(center.buffer);u32(d,0,0x02014b50);u16(d,4,20);u16(d,6,20);u16(d,8,0x0800);u16(d,10,0);u16(d,12,time);u16(d,14,date);u32(d,16,crc);u32(d,20,bytes.length);u32(d,24,bytes.length);u16(d,28,name.length);u32(d,42,offset);center.set(name,46);central.push(center);offset+=local.length+bytes.length}
 const centerSize=central.reduce((sum,a)=>sum+a.length,0),footer=new Uint8Array(22),end=new DataView(footer.buffer);u32(end,0,0x06054b50);u16(end,8,files.length);u16(end,10,files.length);u32(end,12,centerSize);u32(end,16,offset);
 return new Blob([...parts,...central,footer],{type:'application/zip'});
}