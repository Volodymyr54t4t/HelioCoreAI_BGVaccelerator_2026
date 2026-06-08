require("dotenv").config();
const { Pool } = require("pg");

// ─────────────────────────────────────────────────────────────
//  HelioCore AI — Телеметричний генератор
//  Знаходить існуючі пристрої в БД та генерує для них дані
//  на основі schema їхньої моделі. Жодного жорстко прописаного
//  набору полів — усе зчитується зі schema моделі динамічно.
// ─────────────────────────────────────────────────────────────

const API_BASE = process.env.GENERATOR_API_BASE || `http://localhost:${process.env.PORT || 3000}`;
const API_KEY = process.env.API_KEY;
const INTERVAL_MS = parseInt(process.env.GENERATOR_INTERVAL_MS || "5000", 10);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let packetsSent = 0;

// ─── Генерація значення для одного поля schema ────────────────
// Підтримує формати:
//   { "temperature": { "min": 20, "max": 35 } }
//   { "temperature": { "min": 20, "max": 35, "decimals": 2 } }
//   { "status": { "values": ["ok", "warn", "fail"] } }   ← вибір зі списку
//   { "voltage": 3.7 }                                    ← фіксоване значення
function generateValue(spec) {
  if (spec === null || spec === undefined) return null;

  // Фіксоване значення (число або рядок)
  if (typeof spec === "number" || typeof spec === "string") return spec;

  // Вибір зі списку
  if (Array.isArray(spec.values) && spec.values.length) {
    return spec.values[Math.floor(Math.random() * spec.values.length)];
  }

  // Діапазон min/max
  if (typeof spec.min === "number" && typeof spec.max === "number") {
    const decimals = Number.isInteger(spec.decimals) ? spec.decimals : 2;
    const raw = spec.min + Math.random() * (spec.max - spec.min);
    return parseFloat(raw.toFixed(decimals));
  }

  return null;
}

// ─── Генерація payload для пристрою на основі schema ──────────
function buildPayload(device) {
  const schema = device.model_schema || {};
  const payload = { device_id: device.device_id };
  for (const field of Object.keys(schema)) {
    payload[field] = generateValue(schema[field]);
  }
  return payload;
}

// ─── Відправка статусу на сервер (для сторінки "Генератор") ───
async function reportStatus(extra) {
  try {
    await fetch(`${API_BASE}/api/generator/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({
        running: true,
        packets_sent: packetsSent,
        interval_ms: INTERVAL_MS,
        ...extra,
      }),
    });
  } catch {
    /* сервер може бути недоступний — ігноруємо */
  }
}

// ─── Один цикл генерації ──────────────────────────────────────
async function tick() {
  let devices = [];
  try {
    const { rows } = await pool.query(`
      SELECT d.device_id, d.name, d.model_id, m.name AS model_name, m.schema AS model_schema
      FROM devices d
      LEFT JOIN models m ON m.id = d.model_id
      ORDER BY d.device_id
    `);
    devices = rows;
  } catch (err) {
    console.error("❌ Помилка читання пристроїв:", err.message);
    return;
  }

  const withSchema = devices.filter(
    (d) => d.model_schema && Object.keys(d.model_schema).length > 0
  );

  if (!withSchema.length) {
    console.log(
      `⏳ Знайдено ${devices.length} пристроїв, але жоден не має моделі зі schema. Пропуск.`
    );
    await reportStatus({ device_count: devices.length });
    return;
  }

  let lastPayload = null;
  for (const device of withSchema) {
    const payload = buildPayload(device);
    lastPayload = payload;
    try {
      const res = await fetch(`${API_BASE}/api/data`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        packetsSent++;
      } else {
        const body = await res.json().catch(() => ({}));
        console.error(`⚠ ${device.device_id}: ${res.status} ${body.error || ""}`);
      }
    } catch (err) {
      console.error(`⚠ ${device.device_id}: ${err.message}`);
    }
  }

  console.log(
    `📤 Відправлено пакетів за цикл: ${withSchema.length} | Всього: ${packetsSent} | Пристроїв зі schema: ${withSchema.length}/${devices.length}`
  );

  await reportStatus({
    device_count: devices.length,
    last_generation: new Date().toISOString(),
    last_payload: lastPayload,
  });
}

// ─── Старт ────────────────────────────────────────────────────
console.log("🛰  HelioCore AI — Генератор телеметрії");
console.log(`   API: ${API_BASE}`);
console.log(`   Інтервал: ${INTERVAL_MS} мс`);

tick();
const timer = setInterval(tick, INTERVAL_MS);

// Коректне завершення
async function shutdown() {
  clearInterval(timer);
  try {
    await fetch(`${API_BASE}/api/generator/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
      body: JSON.stringify({ running: false, packets_sent: packetsSent }),
    });
  } catch {
    /* ignore */
  }
  await pool.end().catch(() => {});
  console.log("\n🛑 Генератор зупинено");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
