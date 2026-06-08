import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── 1. 解析中文 README，提取 youmindId → { title, description } 映射 ──
function parseChineseReadme(text) {
  const map = new Map();
  // 按 --- 或 ### 分割条目
  const blocks = text.split(/\n(?=### )/);
  for (const block of blocks) {
    const titleMatch = block.match(/^### (.+)/m);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    // 提取 youmindId
    const idMatch = block.match(/seedance-2-0-prompts\?id=(\d+)/);
    if (!idMatch) continue;
    const youmindId = idMatch[1];

    // 提取描述（blockquote > 后面的内容）
    let description = "";
    // 先找 #### 📖 描述 / #### 📖 Description 区域
    const descSection = block.match(/📖 描述\s*\n+([\s\S]*?)(?=\n+####|\n+---|\n+\*\*\[|\n+\>\s)/);
    if (descSection) {
      description = descSection[1].trim();
    } else {
      // 尝试 blockquote >
      const blockquote = block.match(/^> (.+)/m);
      if (blockquote) {
        description = blockquote[1].trim();
      }
    }

    map.set(youmindId, { title, description });
  }
  return map;
}

// ── 2. 针对未匹配的 8 个条目，手动提供中文翻译 ──
const MANUAL_TRANSLATIONS = {
  "5571": {
    title: "宇航员火星高跟鞋广告",
    description: "一支创意的奢侈品广告提示词，讲述宇航员在沙漠星球发现红色高跟鞋，并在低重力环境下翩翩起舞的故事。"
  },
  "5611": {
    title: "可食用蛋糕产品变身",
    description: "将上传的产品转化为超写实的可食用蛋糕，保持原本外形，表面呈现哑光慕斯质感，内部是海绵蛋糕层。"
  },
  "5542": {
    title: "泰式搞笑反转广告",
    description: "一支创意视频脚本，开头是紧张的拆弹场景，突然反转成明亮幽默的电饭煲广告，充满泰式夸张风格。"
  },
  "5510": {
    title: "动漫风格蛋炒饭烹饪",
    description: "一段高能量的动画烹饪场景提示词，聚焦黄金蛋炒饭的动态制作过程，电影级光照和美食动画质感。"
  },
  "5528": {
    title: "医院走廊生物恐怖",
    description: "一个详细的 12 秒恐怖序列提示词，设定在废弃医院，包含悬疑反转和高冲击力的生物跳跃惊吓。"
  },
  "5570": {
    title: "外星飞船轨道对决",
    description: "一段战术科幻提示词，描绘高速轨道上外星主力舰之间的战斗，强调物理真实的运动感和战术定位。"
  },
  "5539": {
    title: "MMA 格斗比赛集锦",
    description: "一段专业的 UFC 风格体育转播提示词，展示光头男选手与体型较大的女选手之间的真实格斗比赛。"
  },
  "5517": {
    title: "Nike 运动鞋生活广告",
    description: "一段综合性的多镜头生活广告提示词，展示 Nike 运动鞋，包括微距产品镜头、穿搭展示和行走跟拍。"
  }
};

// ── 3. 缩略图 URL 构建 ──
// 5 个有视频的精选条目
const VIDEO_YOUMIND_IDS = new Set(["1402", "594", "288", "189", "1403"]);
const THUMB_BASE = "/style-thumbnails";

function buildLocalPaths(youmindId) {
  if (VIDEO_YOUMIND_IDS.has(youmindId)) {
    return {
      thumbnailUrl: `${THUMB_BASE}/${youmindId}.jpg`,
      videoUrl: `${THUMB_BASE}/${youmindId}.mp4`,
    };
  }
  return { thumbnailUrl: null, videoUrl: null };
}

// ── 4. 主流程 ──
function main() {
  // 读取中文 README
  const zhPath = resolve(ROOT, "scripts", "seedance-prompts-zh.txt");
  const zhText = readFileSync(zhPath, "utf-8");
  const zhMap = parseChineseReadme(zhText);
  console.log(`从中文 README 中提取了 ${zhMap.size} 个条目`);

  // 读取当前 styleLibrary.json
  const libPath = resolve(ROOT, "public", "styleLibrary.json");
  const library = JSON.parse(readFileSync(libPath, "utf-8"));

  // 更新每个条目
  let matched = 0;
  let manual = 0;
  for (const entry of library) {
    const id = entry.youmindId;
    const zh = zhMap.get(id) || MANUAL_TRANSLATIONS[id];

    if (zh) {
      entry.title = zh.title;
      entry.hints = [zh.description || entry.hints[0] || ""];
      if (zhMap.has(id)) matched++;
      else manual++;
    } else {
      console.warn(`未找到翻译: ${id} (${entry.title})`);
    }

    // 设置本地缩略图和视频路径
    const paths = buildLocalPaths(id);
    entry.thumbnailUrl = paths.thumbnailUrl;
    entry.videoUrl = paths.videoUrl;
    entry.hasVideo = paths.videoUrl !== null;
  }

  console.log(`中文 README 匹配: ${matched}, 手动翻译: ${manual}`);

  // 写入更新后的文件
  writeFileSync(libPath, JSON.stringify(library, null, 2) + "\n", "utf-8");
  console.log(`已写入 ${libPath}`);
}

main();
