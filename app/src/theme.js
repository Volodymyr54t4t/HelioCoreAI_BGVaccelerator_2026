// Дизайн-токени з оригінального HelioCore AI веб-дашборду.
// Неоновий "кібер" стиль: темне тло, cyan/green акценти, моноширинні підписи.

export const theme = {
  colors: {
    bg: "#080c10",
    surface: "#0d1520",
    surfaceAlt: "#0a1118",
    border: "#1a2d42",
    accent: "#00d4ff",
    accent2: "#00ff9d",
    warn: "#ff9500",
    danger: "#ff3b5c",
    text: "#c8dce8",
    muted: "#4a6278",
  },
  glow: {
    accent: "rgba(0, 212, 255, 0.35)",
    accent2: "rgba(0, 255, 157, 0.35)",
  },
  font: {
    // Моноширинний акцентний шрифт замінено системним monospace,
    // основний текст — системний sans-serif (Rajdhani-подібний).
    mono: "monospace",
  },
  radius: 10,
}

// Колір заряду батареї за відсотком
export function chargeColor(pct) {
  if (pct >= 60) return theme.colors.accent2
  if (pct >= 30) return theme.colors.warn
  return theme.colors.danger
}
