import fs from "fs";

const p = "d:/vibevideo/src/components/nodes/VideoMultimodalInputPanel.tsx";
let s = fs.readFileSync(p, "utf8");

const oldBlock = `          {/* 右侧参考素材缩略图（横向滚动列表） */}
          <div className="mmThumbsWrapper">
            {displayThumbnails.length > 0 && (
              <span className="mmThumbsCount">{displayThumbnails.length}</span>
            )}
            <div className="mmThumbs">
              {displayThumbnails.length === 0 ? (
                <span className="mmThumbsEmpty">暂无参考图</span>
              ) : (
                displayThumbnails.map((item, idx) => (`;

const newBlock = `          {/* 右侧参考素材缩略图（有连线素材时才显示） */}
          {displayThumbnails.length > 0 ? (
            <motionless className="mmThumbsWrapper">
              <span className="mmThumbsCount">{displayThumbnails.length}</span>
              <div className="mmThumbs">
                {displayThumbnails.map((item, idx) => (`;

if (!s.includes(oldBlock)) {
  console.error("old block not found");
  process.exit(1);
}

s = s.replace(oldBlock, newBlock.replaceAll("<motionless", "<div").replaceAll("</motionless>", "</div>"));

const closeOld = `                ))
              )}
            </div>
          </div>`;

const closeNew = `                ))}
              </div>
            </div>
          ) : null}`;

if (!s.includes(closeOld)) {
  console.error("close block not found");
  process.exit(1);
}

s = s.replace(closeOld, closeNew);

fs.writeFileSync(p, s, "utf8");
console.log("ok empty removed:", !s.includes("暂无参考图"));
