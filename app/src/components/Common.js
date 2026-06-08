import { View, Text, StyleSheet } from "react-native"
import { theme } from "../theme"

// Заголовок секції у стилі "// Назва"
export function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{`// ${children}`}</Text>
}

// Панель з рамкою (аналог surface-карток у вебі)
export function Panel({ children, style }) {
  return <View style={[styles.panel, style]}>{children}</View>
}

// Підпис-чіп моноширинним шрифтом
export function MonoChip({ children, color }) {
  return (
    <Text style={[styles.chip, color ? { color, borderColor: color } : null]}>
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: theme.font.mono,
    color: theme.colors.accent,
    fontSize: 13,
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 4,
  },
  panel: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: 16,
  },
  chip: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.muted,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
})
