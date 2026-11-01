import { TRIAL } from "./trialConfig";
import { drawCRTCard } from "./crtCard";
import type { VisualTheme } from "./visualTheme";
import { verdict } from "./verdict";
import { traditional, verdictEnglish } from "./uiText";
export async function postcard(
  frame: HTMLCanvasElement | null,
  stats: { combo: number; hits: number; best: number },
  theme: VisualTheme = "classic",
) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 1000;
  const x = canvas.getContext("2d");
  if (!x) throw Error("图片合成不可用");
  if (theme === "crt") {
    drawCRTCard(x, frame, stats);
  } else {
    x.fillStyle = "#07110f";
    x.fillRect(0, 0, 1280, 1000);
    x.fillStyle = "#a6c8ad";
    x.font = "18px sans-serif";
    x.fillText("WIND//01 — 御風 / LOCAL KEEPSAKE", 48, 48);
    if (frame) {
      // Contain the entire camera frame, preserving face proportions and margins.
      const scale = Math.min(1184 / frame.width, 620 / frame.height);
      const w = frame.width * scale,
        h = frame.height * scale;
      x.drawImage(frame, (1280 - w) / 2, 76 + (620 - h) / 2, w, h);
    } else {
      x.fillStyle = "#13271f";
      x.fillRect(48, 76, 1184, 620);
      x.fillStyle = "#bdd1bd";
      x.textAlign = "center";
      x.font = "32px sans-serif";
      x.fillText("本局未拍到人臉 / NO PORTRAIT CAPTURED", 640, 360);
      x.font = "20px sans-serif";
      x.fillText(
        "未開啟攝影機或人臉未入鏡 / Camera off or face out of frame",
        640,
        408,
      );
      x.textAlign = "left";
    }
    const review = verdict(stats.hits);
    x.fillStyle = "#d5bc8c";
    x.font = "24px sans-serif";
    x.fillText("江湖鑑定 / PERFORMANCE VERDICT", 48, 746);
    x.fillStyle = "#e1edcc";
    x.font = "48px Georgia, serif";
    x.fillText(traditional(review.title), 48, 816);
    x.font = "26px sans-serif";
    x.fillStyle = "#c4d4bf";
    x.fillText(traditional(review.line), 48, 866);
    x.font = "18px sans-serif";
    x.fillText(verdictEnglish(stats.hits).line, 48, 890);
    x.strokeStyle = "#45634e";
    x.beginPath();
    x.moveTo(48, 905);
    x.lineTo(1232, 905);
    x.stroke();
    x.font = "19px sans-serif";
    x.fillText(
      `避開 / EVADED ${stats.hits}/${TRIAL.attacks} · 最高連擊 / BEST ${stats.best}`,
      48,
      947,
    );
    x.textAlign = "right";
    x.font = "15px sans-serif";
    x.fillText(
      frame
        ? `瞬間 / CHAIN ${stats.combo} · 本機 / LOCAL`
        : "無照片 / NO PHOTO · SCORE CARD",
      1232,
      947,
    );
  }
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error("PNG 导出失败"))),
      "image/png",
    ),
  );
}
