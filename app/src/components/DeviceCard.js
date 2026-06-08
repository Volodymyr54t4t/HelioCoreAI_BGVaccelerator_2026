import { View, Text, StyleSheet } from "react-native"
import { theme, chargeColor } from "../theme"

function fmt(v, d = 1) {
  if (v === null || v === undefined || v === "") return "—"
  const n = parseFloat(v)
  if (Number.isNaN(n)) return "—"
  return n.toFixed(d)
}

function Metric({ label, value, unit, accent }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, accent ? { color: accent } : null]}>
        {value}
        {unit ? <Text style={styles.unit}>{` ${unit}`}</Text> : null}
      </Text>
    </View>
  )
}

export function DeviceCard({ device, selected, onPress }) {
  const charge = parseFloat(device.charge_pct) || 0
  const cColor = chargeColor(charge)
  const time = device.received_at
    ? new Date(device.received_at).toLocaleTimeString("uk-UA")
    : "—"

  return (
    <View
      style={[styles.card, selected ? styles.cardSelected : null]}
      onTouchEnd={onPress}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardId}>{device.device_id}</Text>
          <Text style={styles.cardName}>{device.name || "—"}</Text>
        </View>
        <Text style={styles.cardNode}>{device.hc_node || "—"}</Text>
      </View>

      <View style={styles.metricsGrid}>
        <Metric label="Температура" value={fmt(device.temperature, 1)} unit="°C" />
        <Metric label="Вологість" value={fmt(device.humidity, 1)} unit="%" />
        <Metric label="Освітленість" value={fmt(device.light, 0)} unit="lx" />
        <Metric label="Напруга" value={fmt(device.voltage, 3)} unit="V" />
        <Metric label="Ємність" value={fmt(device.capacity_ah, 2)} unit="Ah" />
        <Metric label="Заряд" value={fmt(device.charge_pct, 0)} unit="%" accent={cColor} />
      </View>

      <View style={styles.chargeBar}>
        <View
          style={[styles.chargeFill, { width: `${Math.min(charge, 100)}%`, backgroundColor: cColor }]}
        />
      </View>

      <Text style={styles.cardTime}>{`Остання передача: ${time}`}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: 16,
    marginBottom: 14,
  },
  cardSelected: {
    borderColor: theme.colors.accent,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  cardId: {
    fontFamily: theme.font.mono,
    color: theme.colors.accent,
    fontSize: 15,
  },
  cardName: {
    color: theme.colors.text,
    fontSize: 13,
    marginTop: 2,
  },
  cardNode: {
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
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metric: {
    width: "33.33%",
    marginBottom: 12,
  },
  metricLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    marginBottom: 3,
  },
  metricValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontFamily: theme.font.mono,
  },
  unit: {
    color: theme.colors.muted,
    fontSize: 11,
  },
  chargeBar: {
    height: 6,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 4,
  },
  chargeFill: {
    height: "100%",
    borderRadius: 3,
  },
  cardTime: {
    color: theme.colors.muted,
    fontFamily: theme.font.mono,
    fontSize: 10,
    marginTop: 10,
  },
})
