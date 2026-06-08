import { useMemo } from "react"
import { View, Text, StyleSheet } from "react-native"
import Svg, { Polyline, Line, Circle, Defs, LinearGradient, Stop, Polygon } from "react-native-svg"
import { theme } from "../theme"

// Лінійний графік однієї метрики історії пристрою.
export function LineChart({ data, field, width, height = 200, color = theme.colors.accent }) {
  const points = useMemo(
    () =>
      (data || [])
        .map((d) => parseFloat(d[field]))
        .filter((v) => !Number.isNaN(v)),
    [data, field]
  )

  if (!points.length) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Немає даних для графіка</Text>
      </View>
    )
  }

  const pad = 12
  const w = width || 320
  const h = height
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0

  const coords = points.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (h - pad * 2) * (1 - (v - min) / range)
    return { x, y }
  })

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(" ")
  const area = `${pad},${h - pad} ${polyline} ${pad + (points.length - 1) * stepX},${h - pad}`

  const gridLines = [0.25, 0.5, 0.75].map((t) => pad + (h - pad * 2) * t)

  return (
    <Svg width={w} height={h}>
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {gridLines.map((y, i) => (
        <Line key={i} x1={pad} y1={y} x2={w - pad} y2={y} stroke={theme.colors.border} strokeWidth="1" />
      ))}

      <Polygon points={area} fill="url(#grad)" />
      <Polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.length <= 40 &&
        coords.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r="2.5" fill={color} />
        ))}
    </Svg>
  )
}

const styles = StyleSheet.create({
  empty: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: theme.colors.muted,
    fontFamily: theme.font.mono,
    fontSize: 12,
  },
})
