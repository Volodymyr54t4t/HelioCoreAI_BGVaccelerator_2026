import { useState, useCallback, useRef } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { theme } from "../theme"
import { api } from "../api"
import { SectionTitle, Panel } from "../components/Common"

const DEFAULT_SCHEMA = `{
  "temperature": { "min": 20, "max": 35 },
  "humidity":    { "min": 40, "max": 80 },
  "light":       { "min": 100, "max": 1000 },
  "voltage":     { "min": 3.5, "max": 4.2, "decimals": 3 },
  "capacity_ah": { "min": 5, "max": 10, "decimals": 3 },
  "charge_pct":  { "min": 40, "max": 100 }
}`

const POLL_MS = 4000

export default function GeneratorScreen() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [interval, setIntervalMs] = useState("60000")
  const [busy, setBusy] = useState(false)

  // Форма моделі
  const [modelName, setModelName] = useState("")
  const [modelSchema, setModelSchema] = useState(DEFAULT_SCHEMA)
  // Форма пристрою
  const [devId, setDevId] = useState("")
  const [devName, setDevName] = useState("")
  const [devNode, setDevNode] = useState("")
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(null)

  const mounted = useRef(true)

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.generatorStatus()
      setStatus(s)
    } catch (e) {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadModels = useCallback(async () => {
    try {
      const m = await api.models()
      setModels(m || [])
    } catch (e) {
      // ignore
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      mounted.current = true
      loadStatus()
      loadModels()
      const timer = setInterval(loadStatus, POLL_MS)
      return () => {
        mounted.current = false
        clearInterval(timer)
      }
    }, [loadStatus, loadModels])
  )

  const start = async () => {
    setBusy(true)
    try {
      const ms = parseInt(interval, 10)
      await api.generatorStart(ms >= 500 ? ms : undefined)
      await loadStatus()
    } catch (e) {
      Alert.alert("Помилка", e.message)
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    setBusy(true)
    try {
      await api.generatorStop()
      await loadStatus()
    } catch (e) {
      Alert.alert("Помилка", e.message)
    } finally {
      setBusy(false)
    }
  }

  const createModel = async () => {
    if (!modelName.trim()) return Alert.alert("Вкажіть назву моделі")
    let schemaObj
    try {
      schemaObj = JSON.parse(modelSchema)
    } catch (e) {
      return Alert.alert("Помилка JSON", "Schema має бути валідним JSON")
    }
    try {
      await api.createModel(modelName.trim(), schemaObj)
      Alert.alert("Готово", `Модель "${modelName}" збережено`)
      setModelName("")
      loadModels()
    } catch (e) {
      Alert.alert("Помилка", e.message)
    }
  }

  const createDevice = async () => {
    if (!devId.trim()) return Alert.alert("Вкажіть серійний номер")
    try {
      await api.createDevice({
        device_id: devId.trim(),
        name: devName.trim() || devId.trim(),
        hc_node: devNode.trim() || null,
        model_id: selectedModel,
      })
      Alert.alert("Готово", `Пристрій "${devId}" збережено`)
      setDevId("")
      setDevName("")
      setDevNode("")
    } catch (e) {
      Alert.alert("Помилка", e.message)
    }
  }

  const seed = async () => {
    try {
      await api.seed()
      Alert.alert("Готово", "Демо-набір створено (1 модель + 3 пристрої)")
      loadModels()
      loadStatus()
    } catch (e) {
      Alert.alert("Помилка", e.message)
    }
  }

  const running = status && status.running

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionTitle>Генератор телеметрії — керування</SectionTitle>
      <Panel>
        {loading ? (
          <ActivityIndicator color={theme.colors.accent} />
        ) : (
          <>
            <View style={styles.statRow}>
              <Stat label="Статус генератора" value={running ? "ПРАЦЮЄ" : "ЗУПИНЕНО"} color={running ? theme.colors.accent2 : theme.colors.danger} />
              <Stat label="Знайдено пристроїв" value={status ? String(status.device_count) : "—"} />
            </View>
            <View style={styles.statRow}>
              <Stat label="Пакетів надіслано" value={status ? String(status.packets_sent) : "—"} />
              <Stat
                label="Остання генерація"
                value={status && status.last_generation ? new Date(status.last_generation).toLocaleTimeString("uk-UA") : "—"}
              />
            </View>

            <Text style={styles.label}>Інтервал (мс)</Text>
            <TextInput
              style={styles.input}
              value={interval}
              onChangeText={setIntervalMs}
              keyboardType="numeric"
              placeholder="60000"
              placeholderTextColor={theme.colors.muted}
            />

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnStart, (busy || running) ? styles.btnDisabled : null]}
                onPress={start}
                disabled={busy || running}
              >
                <Text style={styles.btnStartText}>Запустити</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnStop, (busy || !running) ? styles.btnDisabled : null]}
                onPress={stop}
                disabled={busy || !running}
              >
                <Text style={styles.btnStopText}>Зупинити</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Panel>

      {status && status.last_payload ? (
        <>
          <View style={{ height: 18 }} />
          <SectionTitle>Останній згенерований пакет</SectionTitle>
          <Panel>
            <Text style={styles.code}>{JSON.stringify(status.last_payload, null, 2)}</Text>
          </Panel>
        </>
      ) : null}

      <View style={{ height: 18 }} />
      <SectionTitle>Додати модель</SectionTitle>
      <Panel>
        <Text style={styles.hint}>Назва моделі + schema (JSON), що описує які поля генерувати.</Text>
        <TextInput
          style={styles.input}
          value={modelName}
          onChangeText={setModelName}
          placeholder="Назва моделі (напр. Solar Sensor)"
          placeholderTextColor={theme.colors.muted}
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          value={modelSchema}
          onChangeText={setModelSchema}
          multiline
          placeholder="JSON schema"
          placeholderTextColor={theme.colors.muted}
        />
        <TouchableOpacity style={[styles.btn, styles.btnManage]} onPress={createModel}>
          <Text style={styles.btnManageText}>+ Зберегти модель</Text>
        </TouchableOpacity>
      </Panel>

      <View style={{ height: 18 }} />
      <SectionTitle>Додати пристрій</SectionTitle>
      <Panel>
        <Text style={styles.hint}>Серійний номер пристрою та прив'язка до моделі.</Text>
        <TextInput
          style={styles.input}
          value={devId}
          onChangeText={setDevId}
          placeholder="Серійний номер (напр. DEV-0001)"
          placeholderTextColor={theme.colors.muted}
        />
        <TextInput
          style={styles.input}
          value={devName}
          onChangeText={setDevName}
          placeholder="Назва пристрою"
          placeholderTextColor={theme.colors.muted}
        />
        <TextInput
          style={styles.input}
          value={devNode}
          onChangeText={setDevNode}
          placeholder="HC Node (напр. HC-Node-A)"
          placeholderTextColor={theme.colors.muted}
        />
        <Text style={styles.label}>Модель</Text>
        <View style={styles.modelChips}>
          <TouchableOpacity
            style={[styles.chip, selectedModel === null ? styles.chipActive : null]}
            onPress={() => setSelectedModel(null)}
          >
            <Text style={[styles.chipText, selectedModel === null ? styles.chipTextActive : null]}>
              без моделі
            </Text>
          </TouchableOpacity>
          {models.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.chip, selectedModel === m.id ? styles.chipActive : null]}
              onPress={() => setSelectedModel(m.id)}
            >
              <Text style={[styles.chipText, selectedModel === m.id ? styles.chipTextActive : null]}>
                {m.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.btn, styles.btnManage]} onPress={createDevice}>
          <Text style={styles.btnManageText}>+ Зберегти пристрій</Text>
        </TouchableOpacity>
      </Panel>

      <View style={{ height: 18 }} />
      <Panel>
        <Text style={styles.hint}>
          Створює демо-модель «Solar Sensor» та 3 пристрої одним кліком — для тесту генератора.
        </Text>
        <TouchableOpacity style={[styles.btn, styles.btnSeed]} onPress={seed}>
          <Text style={styles.btnSeedText}>Створити демо-набір</Text>
        </TouchableOpacity>
      </Panel>
    </ScrollView>
  )
}

function Stat({ label, value, color }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  statRow: { flexDirection: "row", marginBottom: 14 },
  stat: { flex: 1 },
  statLabel: { color: theme.colors.muted, fontSize: 11, marginBottom: 4 },
  statValue: { color: theme.colors.text, fontFamily: theme.font.mono, fontSize: 18 },
  label: { color: theme.colors.muted, fontSize: 12, marginBottom: 6, marginTop: 6 },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: theme.colors.text,
    fontFamily: theme.font.mono,
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  textarea: { minHeight: 140, textAlignVertical: "top" },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 6 },
  btn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  btnStart: { borderColor: theme.colors.accent2, backgroundColor: "rgba(0,255,157,0.1)" },
  btnStartText: { color: theme.colors.accent2, fontFamily: theme.font.mono, fontSize: 14 },
  btnStop: { borderColor: theme.colors.danger, backgroundColor: "rgba(255,59,92,0.1)" },
  btnStopText: { color: theme.colors.danger, fontFamily: theme.font.mono, fontSize: 14 },
  btnDisabled: { opacity: 0.4 },
  btnManage: { borderColor: theme.colors.accent, backgroundColor: "rgba(0,212,255,0.08)", marginTop: 4 },
  btnManageText: { color: theme.colors.accent, fontFamily: theme.font.mono, fontSize: 14 },
  btnSeed: { borderColor: theme.colors.warn, backgroundColor: "rgba(255,149,0,0.08)", marginTop: 4 },
  btnSeedText: { color: theme.colors.warn, fontFamily: theme.font.mono, fontSize: 14 },
  hint: { color: theme.colors.muted, fontSize: 12, marginBottom: 12, lineHeight: 18 },
  code: { color: theme.colors.accent2, fontFamily: theme.font.mono, fontSize: 12, lineHeight: 18 },
  modelChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: {
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: { borderColor: theme.colors.accent, backgroundColor: "rgba(0,212,255,0.08)" },
  chipText: { color: theme.colors.muted, fontSize: 12 },
  chipTextActive: { color: theme.colors.accent },
})
