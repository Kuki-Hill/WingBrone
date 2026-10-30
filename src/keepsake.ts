export async function postcard(
  frame: HTMLCanvasElement,
  stats: { combo: number; hits: number; best: number },
) {
  await document.fonts.ready;
  const c = document.createElement("canvas");
  c.width = 1280;
  c.height = 880;
  const x = c.getContext("2d");
  if (!x) throw Error("图片合成不可用");
  x.drawImage(frame, 0, 0);
  x.fillStyle = "#07110f";
  x.fillRect(0, 720, 1280, 160);
  x.fillStyle = "#cfdfc4";
  x.font = "36px Georgia, serif";
  x.fillText("御风 / WINDBORNE", 48, 780);
  x.font = "18px sans-serif";
  x.fillText(
    stats.combo ? `精彩瞬间 · ${stats.combo} 连击` : "初次御风 · 向风而行",
    48,
    824,
  );
  x.textAlign = "right";
  x.fillText(
    `本局避开 ${stats.hits} / 12     最高连击 ${stats.best}`,
    1232,
    800,
  );
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? resolve(b) : reject(Error("PNG 导出失败"))),
      "image/png",
    ),
  );
}
