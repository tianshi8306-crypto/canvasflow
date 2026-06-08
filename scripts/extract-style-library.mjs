/**
 * 从 awesome-seedance-2-prompts README 提取风格库 JSON
 * 用法: node scripts/extract-style-library.mjs
 * 输出: public/styleLibrary.json
 */
import fs from "node:fs";
import path from "node:path";

const README = path.resolve("scripts/seedance-prompts.txt");
const OUTPUT = path.resolve("public/styleLibrary.json");

const CATEGORY_RULES = [
  { id: "cinematic", keys: ["cinematic","film","movie","hollywood","imax","photorealistic","fpv","drone","documentary","blockbuster"] },
  { id: "anime",     keys: ["anime","manga","sakuga","cel","shonen","shrine maiden","otaku","jump","anime-style"] },
  { id: "fantasy",   keys: ["fantasy","magic","dragon","spell","witch","sci-fi","cyberpunk","neon","cybernetic","mecha","demon","dark fantasy","haute couture"] },
  { id: "ugc",       keys: ["vlog","selfie","handheld","social media","tiktok","first person","pov","festival"] },
  { id: "ads",       keys: ["advertisement","commercial","product","ad ","promo","showcase","pizza"] },
  { id: "meme",      keys: ["meme","funny","rapper","comedic","unexpected","parody"] },
  { id: "food",      keys: ["food","cooking","kitchen","takoyaki","recipe","dish","restaurant","chef"] },
];

const TAG_DEFS = [
  ["电影级",/cinematic|film|hollywood|blockbuster/i],
  ["动漫",/anime|manga|sakuga/i],
  ["赛博朋克",/cyberpunk|neon/i],
  ["奇幻",/fantasy|magic|dragon|witch/i],
  ["科幻",/sci-fi|futuristic|robot|mecha/i],
  ["治愈",/healing|peaceful|serene|warm.*light/i],
  ["动作",/action|fight|combat|battle|chase/i],
  ["美食",/food|cook|kitchen|recipe/i],
  ["UGC",/vlog|selfie|handheld|social/i],
  ["广告",/advertisement|commercial|product|ad /i],
  ["暗黑",/dark|gothic|horror/i],
  ["古风",/ancient|traditional|chinese/i],
  ["FPV",/first.?person|fpv|pov|drone/i],
  ["慢动作",/slow.?motion/i],
  ["极速",/speed|fast|rapid|quick/i],
  ["变身",/transform/i],
  ["自然",/nature|forest|mountain|ocean|sunset|sunrise/i],
  ["城市",/city|urban|street|megacity/i],
  ["人物",/person|character|model|actor|girl|boy|teen/i],
];

function classify(title, desc, prompt) {
  const t = (title+" "+desc+" "+prompt.slice(0,300)).toLowerCase();
  for (const r of CATEGORY_RULES) {
    if (r.keys.some(k => t.includes(k))) return r.id;
  }
  return "cinematic";
}

function extractTags(title, vs) {
  const tags=[];
  const t=(title+" "+vs).toLowerCase();
  for (const [tg,rx] of TAG_DEFS) {
    if (rx.test(t) && tags.length<4) tags.push(tg);
  }
  return tags;
}

function extractVisualStyle(body) {
  const vs = body.match(/##\s*Visual\s*Style\s*\n([\s\S]*?)(?=##\s|$)/i);
  if (vs) return vs[1].replace(/^\*\s*/gm,"").replace(/\n+/g,", ").replace(/, $/,"").trim();
  const il = body.match(/\[Style\]\s*(.+?)(?:\n|$)/i)||body.match(/^Style:\s*(.+)$/im);
  if (il) return il[1].trim();
  const lines = body.split("\n").reverse();
  const rx = /cinematic|lighting|color|quality|photoreal|texture|atmos|realistic|high-quality|rendering/i;
  for (const l of lines) {
    if (l.trim().length>=60 && rx.test(l)) return l.trim();
  }
  return "";
}

function extractNegative(body) {
  const np = body.match(/##\s*Negative\s*Prompt\s*\n([\s\S]*?)(?=##\s|$)/i);
  if (np) return np[1].replace(/^\*\s*/gm,"").replace(/\n+/g,", ").replace(/, $/,"").trim();
  const il = body.match(/^Negative\s*Prompt:\s*(.+)$/im);
  if (il) return il[1].trim();
  const av = body.match(/(?:Avoid|No)\s*[:;]\s*(.+?)(?:\n\n|$)/im);
  if (av) return av[1].trim();
  return "";
}

function slug(t) {
  return t.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g,"-").replace(/^-|-$/g,"").slice(0,64);
}

function parse(text) {
  const lines=text.split("\n");
  const out=[];
  let i=0;
  while (i<lines.length) {
    if (!/^### [^#]/.test(lines[i])) { i++; continue; }
    const title=lines[i].replace(/^### /,"").trim();
    if (/[📖📊🤔🌐🔥]/.test(title)) { i++; continue; }
    let j=i+1;
    while (j<lines.length && !/^### /.test(lines[j])) j++;
    const body=lines.slice(i+1,j).join("\n");

    let desc="";
    const bq=body.match(/^> (.+)$/m);
    if (bq) desc=bq[1].trim();
    else {
      const ds=body.match(/#### 📖 Description\n\n([\s\S]*?)(?=\n####|$)/);
      if (ds) desc=ds[1].replace(/\n/g," ").trim().slice(0,200);
    }

    const pi=body.indexOf("#### 📝 Prompt");
    if (pi<0) { i=j; continue; }
    const cd=body.slice(pi).match(/```\n?([\s\S]*?)```/);
    if (!cd) { i=j; continue; }
    const promptBody=cd[1].trim();
    if (promptBody.length<100) { i=j; continue; }

    const cat=classify(title,desc,promptBody);
    const vs=extractVisualStyle(promptBody);
    if (vs.length<30) { i=j; continue; }

    const np=extractNegative(promptBody);
    const tags=extractTags(title,vs);
    const ym=body.match(/youmind\.com\/[\w-]+\/seedance-2-0-prompts\?id=(\d+)/);

    out.push({
      id: slug(title),
      title,
      category: cat,
      tags,
      hints: [desc].filter(Boolean),
      youmindId: ym?ym[1]:null,
      visualStyle: vs,
      negativePrompt: np,
    });
    i=j;
  }
  return out;
}

const text=fs.readFileSync(README,"utf-8");
const all=parse(text);

const seen=new Set();
const unique=all.filter(e=>{if(seen.has(e.title))return false;seen.add(e.title);return true});

const byCat={};
for(const e of unique) (byCat[e.category]??=[]).push(e);
const capped=Object.values(byCat).flatMap(a=>a.slice(0,20));
capped.sort((a,b)=>a.category.localeCompare(b.category)||a.title.localeCompare(b.title));

fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
fs.writeFileSync(OUTPUT,JSON.stringify(capped,null,2),"utf-8");
console.log(`✅ styleLibrary.json: ${capped.length} entries (${Object.keys(byCat).length} categories)`);
for(const[k,a] of Object.entries(byCat).sort()) console.log(`  ${k}: ${Math.min(a.length,20)}/${a.length}`);
