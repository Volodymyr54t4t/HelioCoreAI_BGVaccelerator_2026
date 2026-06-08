import { useState, useCallback, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { theme } from "../theme"
import { api } from "../api"
import { SectionTitle, Panel } from "../components/Common"
import { DeviceCard } from "../components/DeviceCard"
import { LineChart } from "../components/LineChart"

const FIELDS = [
  { key: "temperature", label: "Температура", color: theme.colors.accent },
  { key: "humidity", label: "Вологість", color: theme.colors.accent },
  { key: "light", label: "Освітленість", color: theme.colors.warn },
  { key: "voltage", label: "Напруга", color: theme.colors.accent2 },
  { key: "charge_pct", label: "Заряд %", color: theme.colors.accent2 },
]

const POLL_MS = 5000

export default function DashboardScreen() {
  const { width } = useWindowDimensions()
  const [devices, setDevices] = useState([])
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [field, setField] = useState("temperature")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const fieldRef = useRef(field)
  const selectedRef = useRef(selected)
  fieldRef.current = field
  selectedRef.current = selected

  const loadDevices = useCallback(async () => {
    try {
      const rows = await api.devicesLatest()
      setDevices(rows || [])
      setError(null)
      const sel = selectedRef.current || (rows && rows[0] && rows[0].device_id)
      if (sel) {
        if (!selectedRef.current) setSelected(sel)
        const hist = await api.deviceHistory(sel, 50)
        setHistory(hist || [])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadHistory = useCallback(async (deviceId) => {
    try {
      const hist = await api.deviceHistory(deviceId, 50)
      setHistory(hist || [])
    } catch (e) {
      // тиха помилка для графіка
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadDevices()
      const timer = setInterval(loadDevices, POLL_MS)
      return () => clearInterval(timer)
    }, [loadDevices])
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadDevices()
    setRefreshing(false)
  }, [loadDevices])

  const onSelect = useCallback(
    (id) => {
      setSelected(id)
      loadHistory(id)
    },
    [loadHistory]
  )

  const activeField = FIELDS.find((f) => f.key === field) || FIELDS[0]

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.accent}
          colors={[theme.colors.accent]}
        />
      }
    >
      <View style={styles.archRow}>
        <Text style={styles.archBox}>[HC Пристрої]</Text>
        <Text style={styles.archArrow}>→</Text>
        <Text style={styles.archBox}>[Gateway API]</Text>
        <Text style={styles.archArrow}>→</Text>
        <Text style={[styles.archBox, styles.archBoxActive]}>[Mobile]</Text>
      </View>

      <SectionTitle>Графік історії — {selected || "пристрій не обрано"}</SectionTitle>
      <Panel style={styles.chartPanel}>
        <View style={styles.tabs}>
          {FIELDS.map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setField(f.key)}
              style={[styles.tab, field === f.key ? styles.tabActive : null]}
            >
              <Text style={[styles.tabText, field === f.key ? styles.tabTextActive : null]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <LineChart
          data={history}
          field={field}
          width={width - 64}
          height={200}
          color={activeField.color}
        />
      </Panel>

      <View style={{ height: 18 }} />
      <SectionTitle>Пристрої — остання передача</SectionTitle>

      {loading ? (
        <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 30 }} />
      ) : error ? (
        <Panel>
          <Text style={styles.errorText}>{`Помилка з'єднання: ${error}`}</Text>
          <Text style={styles.errorHint}>
            Перевірте URL сервера у вкладці «Налаштування».
          </Text>
        </Panel>
      ) : devices.length === 0 ? (
        <Panel>
          <Text style={styles.emptyText}>Немає даних від пристроїв</Text>
        </Panel>
      ) : (
        devices.map((d) => (
          <DeviceCard
            key={d.device_id}
            device={d}
            selected={selected === d.device_id}
            onPress={() => onSelect(d.device_id)}
          />
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  archRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: 18,
  },
  archBox: {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.colors.muted,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  archBoxActive: {
    color: theme.colors.accent2,
    borderColor: theme.colors.accent2,
  },
  archArrow: {
    color: theme.colors.muted,
    marginHorizontal: 6,
  },
  chartPanel: {
    paddingTop: 12,
  },
  tabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
    gap: 6,
  },
  tab: {
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tabActive: {
    borderColor: theme.colors.accent,
    backgroundColor: "rgba(0,212,255,0.08)",
  },
  tabText: {
    color: theme.colors.muted,
    fontSize: 12,
  },
  tabTextActive: {
    color: theme.colors.accent,
  },
  errorText: {
    color: theme.colors.danger,
    fontFamily: theme.font.mono,
    fontSize: 13,
  },
  errorHint: {
    color: theme.colors.muted,
    fontSize: 12,
    marginTop: 8,
  },
  emptyText: {
    color: theme.colors.muted,
    fontFamily: theme.font.mono,
    fontSize: 13,
  },
})
