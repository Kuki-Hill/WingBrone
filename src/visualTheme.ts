export type VisualTheme = "crt" | "classic";
export const THEME_KEY = "windborne.visual-theme";
export const screen = {
  ink: "#030506",
  paper: "#E8E1D2",
  muted: "#AAA69E",
  violet: "#49316D",
  mono: 'Consolas, "Cascadia Mono", "Microsoft JhengHei", "Microsoft YaHei", monospace',
};
export function readVisualTheme(): VisualTheme {
  const query = new URLSearchParams(location.search).get("theme");
  if (query === "classic" || query === "crt") return query;
  try {
    return localStorage.getItem(THEME_KEY) === "classic" ? "classic" : "crt";
  } catch {
    return "crt";
  }
}
