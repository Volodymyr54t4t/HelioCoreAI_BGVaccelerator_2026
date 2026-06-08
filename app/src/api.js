import AsyncStorage from "@react-native-async-storage/async-storage"

// ─── Конфігурація підключення до server.js ──────────────────────
// Базовий URL та API-ключ зберігаються локально (AsyncStorage),
// щоб користувач міг вказати адресу свого сервера прямо в додатку.

const KEY_BASE_URL = "heliocore.baseUrl"
const KEY_API_KEY = "heliocore.apiKey"

// Значення за замовчуванням. Для емулятора Android локальний сервер
// зазвичай доступний за 10.0.2.2, для iOS-симулятора — localhost.
export const DEFAULT_BASE_URL = "http://10.0.2.2:3000"

let config = {
  baseUrl: DEFAULT_BASE_URL,
  apiKey: "",
}

export async function loadConfig() {
  try {
    const [url, key] = await Promise.all([
      AsyncStorage.getItem(KEY_BASE_URL),
      AsyncStorage.getItem(KEY_API_KEY),
    ])
    config.baseUrl = url || DEFAULT_BASE_URL
    config.apiKey = key || ""
  } catch (e) {
    // ігноруємо — лишаємо дефолти
  }
  return { ...config }
}

export function getConfig() {
  return { ...config }
}

export async function saveConfig({ baseUrl, apiKey }) {
  config.baseUrl = (baseUrl || "").replace(/\/+$/, "") || DEFAULT_BASE_URL
  config.apiKey = apiKey || ""
  await Promise.all([
    AsyncStorage.setItem(KEY_BASE_URL, config.baseUrl),
    AsyncStorage.setItem(KEY_API_KEY, config.apiKey),
  ])
  return { ...config }
}

// ─── Базовий fetch з обробкою помилок та таймаутом ──────────────
async function request(path, options = {}) {
  const url = `${config.baseUrl}${path}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    })
    const text = await res.text()
    const data = text ? JSON.parse(text) : null
    if (!res.ok) {
      throw new Error((data && data.error) || `HTTP ${res.status}`)
    }
    return data
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Ендпоінти (дзеркало server.js) ─────────────────────────────
export const api = {
  // Дашборд
  devicesLatest: () => request("/api/devices/latest"),
  deviceHistory: (deviceId, limit = 50) =>
    request(`/api/devices/${encodeURIComponent(deviceId)}/history?limit=${limit}`),

  // Керування
  devices: () => request("/api/devices"),
  models: () => request("/api/models"),
  createModel: (name, schema) =>
    request("/api/models", {
      method: "POST",
      body: JSON.stringify({ name, schema }),
    }),
  createDevice: (device) =>
    request("/api/devices", {
      method: "POST",
      body: JSON.stringify(device),
    }),
  seed: () => request("/api/seed", { method: "POST" }),

  // Генератор телеметрії
  generatorStatus: () => request("/api/generator/status"),
  generatorStart: (intervalMs) =>
    request("/api/generator/start", {
      method: "POST",
      body: JSON.stringify(intervalMs ? { interval_ms: intervalMs } : {}),
    }),
  generatorStop: () => request("/api/generator/stop", { method: "POST" }),

  // Перевірка зв'язку
  ping: () => request("/api/devices/latest"),
}
