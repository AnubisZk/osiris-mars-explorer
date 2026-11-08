// Real Mars terrain import: GeoTIFF digital terrain model (e.g. a HiRISE DTM of Jezero from
// https://www.uahirise.org/dtm/ or the USGS Mars 2020 TRN HiRISE DTM mosaic) → app terrain files.
//
//   node tools/import-dtm.mjs <dtm.tif> --name jezero --size 1200 --cells 512 [--center px,py]
//        --title "..." --url "..." --credit "NASA/JPL/University of Arizona/USGS"
//
// Writes app/public/terrain/<name>.bin (Float32 heights, metres, relative to the window mean) and
// <name>.json (grid, source, licence, credit). Open the app with ?terrain=<name>.
// Elevations are resampled bilinearly from the DTM's own pixel size; no-data cells are filled with
// the nearest valid neighbour along the row (counted in the metadata).
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fromArrayBuffer} from 'geotiff';

const args=process.argv.slice(2),get=(k,d)=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:d;};
export async function importDtm(buffer,{name,size=1200,cells=512,center=null,title='',url='',credit='',license='NASA data: public domain (credit requested)'}){
  const tiff=await fromArrayBuffer(buffer),img=await tiff.getImage(),W=img.getWidth(),H=img.getHeight();
  const res=img.getResolution?.()??[1,-1],px=Math.abs(res[0]),py=Math.abs(res[1]);
  const nodata=img.getGDALNoData?.()??null,[raster]=await img.readRasters({interleave:false});
  const cx=center?center[0]:W/2,cy=center?center[1]:H/2,half=size/2;
  if(size/px>W||size/py>H)throw new RangeError(`Requested ${size} m window exceeds the DTM (${(W*px).toFixed(0)} × ${(H*py).toFixed(0)} m)`);
  const valid=v=>Number.isFinite(v)&&v>-1e30&&(nodata==null||v!==nodata);
  const at=(x,y)=>{const i=Math.max(0,Math.min(W-1,Math.round(x))),j=Math.max(0,Math.min(H-1,Math.round(y)));return raster[i+j*W];};
  const sample=(x,y)=>{const i=Math.floor(x),j=Math.floor(y),u=x-i,v=y-j,a=at(i,j),b=at(i+1,j),c=at(i,j+1),d=at(i+1,j+1);
    if([a,b,c,d].every(valid))return (1-u)*(1-v)*a+u*(1-v)*b+(1-u)*v*c+u*v*d;const n=[a,b,c,d].filter(valid);return n.length?n[0]:NaN;};
  const n=cells,heights=new Float32Array((n+1)*(n+1));let filled=0,sum=0,count=0;
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    // grid x east, z south: pixel columns grow east, rows grow south (north-up rasters)
    const x=cx+((i/n-.5)*size)/px,y=cy+((j/n-.5)*size)/py,h=sample(x,y);heights[i+j*(n+1)]=h;if(Number.isFinite(h)){sum+=h;count++;}
  }
  if(!count)throw new RangeError('No valid elevations in the window');
  const mean=sum/count;let last=0;
  for(let k=0;k<heights.length;k++){if(Number.isFinite(heights[k])){last=heights[k]-mean;heights[k]=last;}else{heights[k]=last;filled++;}}
  const meta={name,source:'dtm',title,url,credit,license,nx:n,nz:n,size:[size,size],pixelSize:[px,py],center:[cx,cy],referenceElevation:mean,filledCells:filled,
    procedural:false,label:{en:`Real terrain: ${title||name} (${credit||'DTM'})`,tr:`Gerçek arazi: ${title||name} (${credit||'DTM'})`}};
  return {meta,heights};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const file=args[0];if(!file||file.startsWith('--')){console.error('Kullanım: node tools/import-dtm.mjs <dtm.tif> --name jezero [--size 1200] [--cells 512]');process.exit(1);}
  const name=get('name','dtm'),buf=readFileSync(file);
  const {meta,heights}=await importDtm(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),{name,size:+get('size',1200),cells:+get('cells',512),
    center:get('center',null)?.split(',').map(Number)??null,title:get('title',''),url:get('url',''),credit:get('credit','')});
  mkdirSync('app/public/terrain',{recursive:true});
  writeFileSync(`app/public/terrain/${name}.bin`,Buffer.from(heights.buffer));writeFileSync(`app/public/terrain/${name}.json`,JSON.stringify(meta,null,1)+'\n');
  console.log(`Yazıldı: app/public/terrain/${name}.{bin,json} · ${meta.nx}×${meta.nz} hücre, ${meta.size[0]} m, piksel ${meta.pixelSize[0]} m, doldurulan ${meta.filledCells}`);
}
