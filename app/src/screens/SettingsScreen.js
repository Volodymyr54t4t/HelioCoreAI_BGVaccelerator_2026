import { useState, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { theme } from "../theme"
import { api, getConfig, saveConfig, loadConfig, DEFAULT_BASE_URL } from "../api"
import { SectionTitle, Panel } from "../components/Common"

export default function SettingsScreen() {
  const [baseUrl, setBaseUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null)

  useFocusEffect(
    useCallback(() => {
      loadConfig().then((c) => {
        setBaseUrl(c.baseUrl)
        setApiKey(c.apiKey)
      })
    }, [])
  )

  const save = async () => {
    const c = await saveConfig({ baseUrl, apiKey })
    setBaseUrl(c.baseUrl)
    Alert.alert("Збережено", "Налаштування підключення оновлено")
  }

  const test = async () => {
    await saveConfig({ baseUrl, apiKey })
    setTesting(true)
    setResult(null)
    try {
      const rows = await api.ping()
      setResult({ ok: true, count: Array.isArray(rows) ? rows.length : 0 })
    } catch (e) {
      setResult({ ok: false, error: e.message })
    } finally {
      setTesting(false)
    }
  }

  const reset = () => {
    setBaseUrl(DEFAULT_BASE_URL)
    setApiKey("")
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionTitle>Підключення до сервера</SectionTitle>
      <Panel>
        <Text style={styles.hint}>
          Адреса вашого backend (server.js). Для емулятора Android локальний сервер —
          http://10.0.2.2:3000, для iOS-симулятора — http://localhost:3000, для реального
          пристрою — IP вашого ПК у локальній мережі.
        </Text>

        <Text style={styles.label}>URL сервера</Text>
        <TextInput
          style={styles.input}
          value={baseUrl}
          onChangeText={setBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://192.168.0.10:3000"
          placeholderTextColor={theme.colors.muted}
        />

        <Text style={styles.label}>API-ключ (x-api-key)</Text>
        <Text style={styles.subhint}>
          Потрібен лише для надсилання даних (POST /api/data). Для перегляду дашборду не
          обов'язковий.
        </Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={theme.colors.muted}
        />

        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, styles.btnSave]} onPress={save}>
            <Text style={styles.btnSaveText}>Зберегти</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnTest]} onPress={test} disabled={testing}>
            {testing ? (
              <ActivityIndicator color={theme.colors.accent} />
            ) : (
              <Text style={styles.btnTestText}>Перевірити</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={reset} style={styles.resetLink}>
          <Text style={styles.resetText}>Скинути до значень за замовчуванням</Text>
        </TouchableOpacity>

        {result ? (
          <View style={[styles.resultBox, result.ok ? styles.resultOk : styles.resultErr]}>
            <Text style={[styles.resultText, { color: result.ok ? theme.colors.accent2 : theme.colors.danger }]}>
              {result.ok
                ? `З'єднання успішне. Пристроїв з даними: ${result.count}`
                : `Помилка: ${result.error}`}
            </Text>
          </View>
        ) : null}
      </Panel>

      <View style={{ height: 18 }} />
      <SectionTitle>Про додаток</SectionTitle>
      <Panel>
        <Text style={styles.about}>HelioCore AI — Mobile</Text>
        <Text style={styles.aboutMuted}>IoT Gateway Dashboard (React Native / Expo)</Text>
        <Text style={styles.aboutMuted}>Версія 1.0.0</Text>
        <Text style={styles.aboutMuted}>
          Працює з backend server.js (Express + PostgreSQL).
        </Text>
      </Panel>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  hint: { color: theme.colors.muted, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  subhint: { color: theme.colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 8 },
  label: { color: theme.colors.text, fontSize: 13, marginBottom: 6, marginTop: 4 },
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
    marginBottom: 14,
  },
  btnRow: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, borderRadius: 8, paddingVertical: 12, alignItems: "center", borderWidth: 1 },
  btnSave: { borderColor: theme.colors.accent2, backgroundColor: "rgba(0,255,157,0.1)" },
  btnSaveText: { color: theme.colors.accent2, fontFamily: theme.font.mono, fontSize: 14 },
  btnTest: { borderColor: theme.colors.accent, backgroundColor: "rgba(0,212,255,0.08)" },
  btnTestText: { color: theme.colors.accent, fontFamily: theme.font.mono, fontSize: 14 },
  resetLink: { marginTop: 14, alignItems: "center" },
  resetText: { color: theme.colors.muted, fontSize: 12, textDecorationLine: "underline" },
  resultBox: { marginTop: 16, borderRadius: 8, borderWidth: 1, padding: 12 },
  resultOk: { borderColor: theme.colors.accent2, backgroundColor: "rgba(0,255,157,0.06)" },
  resultErr: { borderColor: theme.colors.danger, backgroundColor: "rgba(255,59,92,0.06)" },
  resultText: { fontFamily: theme.font.mono, fontSize: 12, lineHeight: 18 },
  about: { color: theme.colors.accent, fontFamily: theme.font.mono, fontSize: 16, marginBottom: 6 },
  aboutMuted: { color: theme.colors.muted, fontSize: 12, lineHeight: 20 },
})
