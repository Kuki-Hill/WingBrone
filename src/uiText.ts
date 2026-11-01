// Presentation-only language. Sensor and game state strings remain unchanged.
import type { Direction } from "./game";
import { performanceTier, TRIAL } from "./trialConfig";
export const directionLabels: Record<Direction, string> = {
  left: "向左 / LEFT",
  right: "向右 / RIGHT",
  up: "抬頭 / UP",
  down: "低頭 / DOWN",
};
export const cueText: Record<string, string> = {
  rest: "等待蓄力 / WAIT",
  prepare: "準備 / READY",
  dodge: "現在閃避 / GO",
  impact: "斬擊 / STRIKE",
  recover: "回正 / RECENTER",
};
export function statusText(status: string) {
  const known: Record<string, string> = {
    方向键已就绪: "方向鍵已就緒 / KEYBOARD READY",
    "请正视屏幕，保持约两秒": "請正視螢幕約兩秒 / HOLD NEUTRAL",
    "未看到完整人脸，请检查右上角镜头预览": "請讓整張臉入鏡 / FACE NOT FOUND",
    "请保持正视，重新采集…": "請保持正視，重新校準 / HOLD STILL",
    "识别就绪 · 小幅转头即可": "識別就緒，小幅轉頭即可 / TRACKING READY",
    "已重新识别到人脸 · 可以继续": "已重新識別，可繼續 / TRACKING RESTORED",
    识别就绪: "識別就緒 / TRACKING READY",
    摄像头不可用: "攝影機無法使用 / CAMERA ERROR",
    "识别处理暂时无响应 · 请重启摄像头":
      "識別暫無回應，請重啟 / TRACKING STALLED",
    "人脸暂时离开画面 · 已暂停": "未識別到人臉，已暫停 / TRACKING LOST",
    "正在申请摄像头…": "正在請求攝影機 / REQUESTING CAMERA",
    "正在加载本地识别模型…": "正在載入本機模型 / LOADING MODEL",
    "正在启动兼容识别…": "正在啟動相容識別 / COMPATIBILITY MODE",
    "兼容识别已启动 · 请正视屏幕校准": "相容識別已啟動，請正視校準 / CALIBRATE",
  };
  if (known[status]) return known[status];
  if (status.startsWith("正视校准"))
    return `正視校準 / CALIBRATING ${status.match(/\d+%/)?.[0] ?? ""}`;
  return status;
}
export function verdictEnglish(hits: number) {
  const tier = performanceTier(hits);
  if (tier === 4)
    return {
      title: "SUSPICIOUSLY UNTOUCHABLE",
      line: `${TRIAL.attacks} swings. ${TRIAL.attacks} unpaid overtime shifts for your opponent.`,
    };
  if (tier === 3)
    return {
      title: "LEFT THE BLADE ON READ",
      line: "Every strike arrived. You were out of service.",
    };
  if (tier === 2)
    return {
      title: "PART MASTER, PART TARGET",
      line: "The dodges were technique. The rest was audience participation.",
    };
  if (tier === 1)
    return {
      title: "FLYING LICENCE PENDING",
      line: "Your head had ideas. The blade declined them.",
    };
  return {
    title: "DESIGNATED BLADE RECIPIENT",
    line: "Others dodge with skill. You gave every strike a home.",
  };
}
export function traditional(text: string) {
  const from =
    "闪外挂对挥让时剑气读区师脸签躲掉没参与头转得采纳别给个江湖黑历档结果风连击本机照片览识别暂开请检镜维画显浏览器运行说明错误将视准续键试练习摄像这为关载备红绿边斩将从过来钟动数传图络体败选项无响应启拟态还击输入赢经战评";
  const to =
    "閃外掛對揮讓時劍氣讀區師臉簽躲掉沒參與頭轉得採納別給個江湖黑歷檔結果風連擊本機照片覽識別暫開請檢鏡維畫顯瀏覽器運行說明錯誤將視準續鍵試練習攝像這為關載備紅綠邊斬將從過來鐘動數傳圖絡體敗選項無響應啟擬態還擊輸入贏經戰評";
  return [...text]
    .map((c) => {
      const i = from.indexOf(c);
      return i < 0 ? c : to[i];
    })
    .join("");
}
