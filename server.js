const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dns = require("dns").promises;
const net = require("net");
const cheerio = require("cheerio");
const app = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, "data");
const UPLOADS = path.join(__dirname, "uploads");
fs.mkdirSync(DATA,{recursive:true}); fs.mkdirSync(UPLOADS,{recursive:true});
app.use(express.json({limit:"2mb"}));
// Servir apenas os arquivos públicos do site, que ficam na raiz para facilitar upload pelo celular.
app.get("/", (_,res)=>res.sendFile(path.join(__dirname,"index.html")));
for (const file of ["style.css","app.js","play.html","play.js","manifest.webmanifest"]) {
  app.get("/"+file, (_,res)=>res.sendFile(path.join(__dirname,file)));
}
app.use("/uploads", express.static(UPLOADS));
const storage = multer.diskStorage({
 destination: (_,__,cb)=>cb(null,UPLOADS),
 filename: (_,file,cb)=>cb(null,crypto.randomBytes(10).toString("hex")+path.extname(file.originalname).toLowerCase())
});
const upload = multer({storage, limits:{fileSize:50*1024*1024}, fileFilter:(_,f,cb)=>{
 const ok=/^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm|ogg))$/.test(f.mimetype);
 cb(ok?null:new Error("Envie imagens ou vídeos compatíveis."),ok);
}});
function dbfile(id){return path.join(DATA,id+".json")}

function isPublicIp(ip) {
  if (!net.isIP(ip)) return false;
  // Reject loopback, private, link-local, multicast, unspecified and IPv4-mapped IPv6.
  if (ip.includes(":")) {
    const x=ip.toLowerCase();
    if (x==="::1" || x==="::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80:") || x.startsWith("::ffff:")) return false;
    return true;
  }
  const a=ip.split(".").map(Number);
  return !(a[0]===10 || a[0]===127 || a[0]===0 || a[0]>=224 ||
    (a[0]===169&&a[1]===254) || (a[0]===172&&a[1]>=16&&a[1]<=31) ||
    (a[0]===192&&a[1]===168) || (a[0]===100&&a[1]>=64&&a[1]<=127));
}
async function validatePublicUrl(raw) {
  let u; try { u=new URL(raw); } catch { throw new Error("Link inválido."); }
  if (!["http:","https:"].includes(u.protocol) || u.username || u.password) throw new Error("Use um link público HTTP ou HTTPS.");
  if (u.port && !["80","443"].includes(u.port)) throw new Error("Porta não permitida.");
  const host=u.hostname.toLowerCase();
  if (host==="localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("Endereço local não permitido.");
  if (net.isIP(host)) { if(!isPublicIp(host)) throw new Error("Endereço privado não permitido."); }
  else {
    const records=await dns.lookup(host,{all:true});
    if (!records.length || records.some(x=>!isPublicIp(x.address))) throw new Error("O endereço não parece ser público.");
  }
  return u;
}
async function importPublicPage(raw) {
  let current=await validatePublicUrl(raw), response;
  for(let i=0;i<4;i++){
    response=await fetch(current,{redirect:"manual",headers:{"user-agent":"TrollMasterPreview/1.0 (+public metadata preview)","accept":"text/html,application/xhtml+xml"} ,signal:AbortSignal.timeout(9000)});
    if([301,302,303,307,308].includes(response.status)){
      const loc=response.headers.get("location"); if(!loc) break;
      current=await validatePublicUrl(new URL(loc,current).toString()); continue;
    }
    break;
  }
  if(!response || !response.ok) throw new Error("O site não liberou a leitura da página. Tente outro link ou envie os arquivos manualmente.");
  const type=response.headers.get("content-type")||"";
  if(!type.includes("text/html")) throw new Error("Esse link não é uma página HTML pública.");
  const reader=response.body.getReader(); let chunks=[],size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000){await reader.cancel();throw new Error("Página muito grande para pré-visualizar.");}chunks.push(value);}
  const html=Buffer.concat(chunks).toString("utf8"), $=cheerio.load(html);
  const meta=(...keys)=>{for(const k of keys){const v=$(`meta[property="${k}"],meta[name="${k}"]`).first().attr("content");if(v)return v;}return "";};
  const absolute=(v)=>{if(!v)return "";try{const u=new URL(v,current);return ["http:","https:"].includes(u.protocol)?u.toString():"";}catch{return ""}};
  const title=(meta("og:title","twitter:title")||$("title").first().text()||current.hostname).trim().slice(0,180);
  const description=(meta("og:description","description","twitter:description")||"").trim().slice(0,400);
  const image=absolute(meta("og:image","twitter:image"));
  const video=absolute(meta("og:video:secure_url","og:video","twitter:player:stream"));
  return {source:current.toString(),title,description,items:[...(image?[{url:image,type:"image",external:true}]:[]),...(video?[{url:video,type:"video",external:true}]:[])]};
}

app.post("/api/import-preview",async(req,res)=>{
 try { const data=await importPublicPage(String(req.body.url||"")); res.json(data); }
 catch(e){res.status(400).json({error:e.message||"Não foi possível importar essa página."});}
});
app.post("/api/pranks",upload.array("media",12),(req,res)=>{
 try {
  const id=crypto.randomBytes(5).toString("hex");
  const body=JSON.parse(req.body.settings||"{}");
  const items=(req.files||[]).map(f=>({url:"/uploads/"+f.filename,type:f.mimetype.startsWith("video/")?"video":"image"}));
  const prank={id,title:String(body.title||"Pegadinha").slice(0,60),intensity:["leve","media","forte","insana"].includes(body.intensity)?body.intensity:"media",
   duration:Math.max(15,Math.min(600,Number(body.duration)||60)),revealAfter:Math.max(5,Math.min(300,Number(body.revealAfter)||30)),secret:String(body.secret||"LIBERDADE").slice(0,30),
   items:[...(Array.isArray(body.importItems)?body.importItems.filter(x=>x&&typeof x.url==="string"&&["image","video"].includes(x.type)&&x.external===true).slice(0,2):[]),...items],sourceUrl:typeof body.sourceUrl==="string"?body.sourceUrl.slice(0,2000):"",createdAt:new Date().toISOString()};
  fs.writeFileSync(dbfile(id),JSON.stringify(prank,null,2));
  res.json({id,url:`${req.protocol}://${req.get("host")}/p/${id}`});
 } catch(e){res.status(400).json({error:"Não foi possível criar a pegadinha."})}
});
app.get("/api/pranks/:id",(req,res)=>{
 const p=dbfile(req.params.id);
 if(!fs.existsSync(p))return res.status(404).json({error:"Pegadinha não encontrada."});
 res.json(JSON.parse(fs.readFileSync(p)));
});
app.get("/p/:id",(_,res)=>res.sendFile(path.join(__dirname,"play.html")));
app.use((err,req,res,next)=>res.status(400).json({error:err.message||"Erro no envio."}));
app.listen(PORT,()=>console.log(`Troll Master em http://localhost:${PORT}`));
