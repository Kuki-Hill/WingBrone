import { performanceTier, TRIAL } from "./trialConfig";
export function verdict(hits: number) {
  const tier = performanceTier(hits);
  if (tier === 4)
    return {
      title: "闪避外挂疑似成精",
      line: `对手挥了${TRIAL.attacks}次，你让他加了${TRIAL.attacks}次班。`,
    };
  if (tier === 3)
    return {
      title: "剑气的已读不回",
      line: "剑气每次都来了，你每次都不在服务区。",
    };
  if (tier === 2)
    return {
      title: "半步宗师，半脸签收",
      line: "躲掉的叫身法，没躲掉的叫参与感。",
    };
  if (tier === 1)
    return {
      title: "御剑考驾照未遂",
      line: "头转得很有想法，剑气表示不予采纳。",
    };
  return {
    title: "剑气指定签收人",
    line: "别人靠身法躲剑，你靠脸给剑气一个家。",
  };
}
