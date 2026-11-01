import { TRIAL } from "./trialConfig";
import { screen } from "./visualTheme";
import { verdict } from "./verdict";
import { traditional, verdictEnglish } from "./uiText";

// Static text raster, not a video filter. Small copy stays solid and readable.
function rasterText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
) {
  const layer = document.createElement("canvas");
  const font = `700 ${size}px ${screen.mono}`;
  ctx.font = font;
  layer.width = Math.ceil(ctx.measureText(text).width) + 8;
  layer.height = Math.ceil(size * 1.5);
  const ink = layer.getContext("2d")!;
  ink.font = font;
  ink.fillStyle = screen.paper;
  ink.fillText(text, 4, size);
  ink.globalCompositeOperation = "destination-out";
  ink.fillStyle = "rgba(0,0,0,.42)";
  for (let row = 0; row < layer.height; row += 5)
    ink.fillRect(0, row, layer.width, 1);
  ctx.drawImage(layer, x - 4, y - size);
}
export function drawCRTCard(
  x: CanvasRenderingContext2D,
  frame: HTMLCanvasElement | null,
  stats: { combo: number; hits: number; best: number },
) {
  x.fillStyle = screen.ink;
  x.fillRect(0, 0, 1280, 1000);
  x.strokeStyle = "#E8E1D255";
  x.lineWidth = 1;
  x.strokeRect(24.5, 24.5, 1231, 951);
  rasterText(x, "WIND//01", 48, 91, 64);
  x.fillStyle = screen.paper;
  x.font = `16px ${screen.mono}`;
  x.fillText("御風 / PARTICLE INTERCEPTION SYSTEM", 50, 122);
  x.textAlign = "right";
  x.fillText("留影存檔 / LOCAL KEEPSAKE", 1230, 63);
  x.fillText("ARCHIVE — 01 / ON DEVICE", 1230, 91);
  x.textAlign = "left";
  const left = 48,
    top = 146,
    width = 1184,
    height = 490;
  if (frame) {
    const scale = Math.min(width / frame.width, height / frame.height);
    const w = frame.width * scale,
      h = frame.height * scale;
    x.drawImage(frame, left + (width - w) / 2, top + (height - h) / 2, w, h);
  } else {
    x.fillStyle = "#0C0E10";
    x.fillRect(left, top, width, height);
    x.strokeStyle = "#E8E1D211";
    for (let col = left; col < left + width; col += 32) {
      x.beginPath();
      x.moveTo(col, top);
      x.lineTo(col, top + height);
      x.stroke();
    }
    for (let row = top; row < top + height; row += 32) {
      x.beginPath();
      x.moveTo(left, row);
      x.lineTo(left + width, row);
      x.stroke();
    }
    x.fillStyle = screen.paper;
    x.textAlign = "center";
    x.font = `700 32px ${screen.mono}`;
    x.fillText("本局未拍到人臉", 640, 370);
    x.font = `20px ${screen.mono}`;
    x.fillText("NO PORTRAIT CAPTURED", 640, 408);
    x.fillStyle = screen.muted;
    x.font = `16px ${screen.mono}`;
    x.fillText(
      "攝影機未開啟或人臉未入鏡 / Camera off or face out of frame",
      640,
      448,
    );
    x.textAlign = "left";
  }
  x.fillStyle = "rgba(3,5,6,.08)";
  for (let row = top; row < top + height; row += 4)
    x.fillRect(left, row, width, 1);
  x.strokeStyle = screen.paper;
  x.lineWidth = 2;
  for (const [cx, cy, dx, dy] of [
    [left, top, 1, 1],
    [left + width, top, -1, 1],
    [left, top + height, 1, -1],
    [left + width, top + height, -1, -1],
  ]) {
    x.beginPath();
    x.moveTo(cx, cy + 20 * dy);
    x.lineTo(cx, cy);
    x.lineTo(cx + 20 * dx, cy);
    x.stroke();
  }
  x.fillStyle = screen.muted;
  x.font = `15px ${screen.mono}`;
  x.fillText("江湖鑑定 / PERFORMANCE VERDICT", 48, 675);
  rasterText(x, traditional(verdict(stats.hits).title), 48, 730, 44);
  x.fillStyle = screen.paper;
  x.font = `16px ${screen.mono}`;
  x.fillText(verdictEnglish(stats.hits).title, 48, 758);
  x.font = `23px ${screen.mono}`;
  x.fillText(traditional(verdict(stats.hits).line), 48, 797);
  x.fillStyle = screen.muted;
  x.font = `16px ${screen.mono}`;
  x.fillText(verdictEnglish(stats.hits).line, 48, 826);
  x.strokeStyle = "#E8E1D255";
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(48, 850);
  x.lineTo(1232, 850);
  x.stroke();
  const statsColumns = [
    ["避開 / EVADED", `${stats.hits} / ${TRIAL.attacks}`],
    ["成功率 / RATE", `${Math.round((stats.hits / TRIAL.attacks) * 100)}%`],
    ["最高連擊 / BEST", String(stats.best)],
  ];
  statsColumns.forEach(([label, value], i) => {
    const col = 48 + i * 400;
    x.fillStyle = screen.muted;
    x.font = `15px ${screen.mono}`;
    x.fillText(label, col, 882);
    rasterText(x, value, col, 938, 44);
  });
  x.fillStyle = screen.muted;
  x.font = `13px ${screen.mono}`;
  x.fillText(
    frame
      ? `瞬間連擊 / MOMENT CHAIN ${stats.combo} — LOCAL PORTRAIT`
      : "無照片 / NO PHOTO — SCORE CARD",
    48,
    968,
  );
}
