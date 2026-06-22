require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "")));

// ─── PostgreSQL Pool ─────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── Ініціалізація БД ────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    // Таблиця моделей пристроїв (назва + schema для генерації)
    await client.query(`
      CREATE TABLE IF NOT EXISTS models (
        id           SERIAL PRIMARY KEY,
        name         VARCHAR(100) UNIQUE NOT NULL,
        schema       JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at   TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id           SERIAL PRIMARY KEY,
        device_id    VARCHAR(50) UNIQUE NOT NULL,
        name         VARCHAR(100),
        hc_node      VARCHAR(50),
        model_id     INTEGER REFERENCES models(id),
        created_at   TIMESTAMP DEFAULT NOW()
      );
    `);

    // Міграція: додаємо model_id до існуючої таблиці devices, якщо його ще нема
    await client.query(`
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS model_id INTEGER REFERENCES models(id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sensor_data (
        id            SERIAL PRIMARY KEY,
        device_id     VARCHAR(50) NOT NULL,
        temperature   NUMERIC(5,2),
        humidity      NUMERIC(5,2),
        light         NUMERIC(8,2),
        voltage       NUMERIC(5,3),
        capacity_ah   NUMERIC(6,3),
        charge_pct    NUMERIC(5,2),
        received_at   TIMESTAMP DEFAULT NOW()
      );
    `);

    // ⚠️ Жодного автоматичного створення пристроїв чи демо-даних.
    // Усі моделі, пристрої та серійні номери додаються вручну (адмінпанель / SQL).

    console.log("✅ БД ініціалізовано");
  } finally {
    client.release();
  }
}

// ─── API: прийом даних від ESP / HC (POST) ───────────────────
// Формат запиту від ESP:
// POST /api/data
// Headers: x-api-key: <API_KEY>
// Body JSON:
// {
//   "device_id": "DEV-0001",
//   "temperature": 24.5,
//   "humidity": 60.2,
//   "light": 450.0,
//   "voltage": 3.85,
//   "capacity_ah": 8.2,
//   "charge_pct": 72.5
// }
app.post("/api/data", async (req, res) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Невірний API ключ" });
  }

  const { device_id, temperature, humidity, light, voltage, capacity_ah, charge_pct } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: "device_id обовʼязковий" });
  }

  try {
    // Пристрій має існувати в БД — жодного авто-створення.
    const dev = await pool.query(
      "SELECT 1 FROM devices WHERE device_id = $1",
      [device_id]
    );
    if (dev.rowCount === 0) {
      return res.status(404).json({ error: `Пристрій ${device_id} не знайдено в БД` });
    }

    const result = await pool.query(`
      INSERT INTO sensor_data
        (device_id, temperature, humidity, light, voltage, capacity_ah, charge_pct)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [device_id, temperature, humidity, light, voltage, capacity_ah, charge_pct]);

    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("DB error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── API: останні дані по кожному пристрою ───────────────────
app.get("/api/devices/latest", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (sd.device_id)
        d.device_id, d.name, d.hc_node,
        sd.temperature, sd.humidity, sd.light,
        sd.voltage, sd.capacity_ah, sd.charge_pct,
        sd.received_at
      FROM sensor_data sd
      JOIN devices d ON d.device_id = sd.device_id
      ORDER BY sd.device_id, sd.received_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: історія по конкретному пристрою ────────────────────
app.get("/api/devices/:device_id/history", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  try {
    const result = await pool.query(`
      SELECT temperature, humidity, light, voltage, capacity_ah, charge_pct, received_at
      FROM sensor_data
      WHERE device_id = $1
      ORDER BY received_at DESC
      LIMIT $2
    `, [req.params.device_id, limit]);
    res.json(result.rows.reverse()); // хронологічний порядок
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: список пристроїв (з моделлю) ───────────────────────
app.get("/api/devices", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, m.name AS model_name, m.schema AS model_schema
      FROM devices d
      LEFT JOIN models m ON m.id = d.model_id
      ORDER BY d.created_at
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: список моделей ─────────────────────────────────────
app.get("/api/models", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM models ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: створення моделі ───────────────────────────────────
app.post("/api/models", async (req, res) => {
  const { name, schema } = req.body;
  if (!name) return res.status(400).json({ error: "name обовʼязковий" });
  try {
    const result = await pool.query(
      `INSERT INTO models (name, schema) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET schema = EXCLUDED.schema
       RETURNING *`,
      [name, schema || {}]
    );
    res.json({ ok: true, model: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: створення пристрою ─────────────────────────────────
app.post("/api/devices", async (req, res) => {
  const { device_id, name, hc_node, model_id } = req.body;
  if (!device_id) return res.status(400).json({ error: "device_id обовʼязковий" });
  try {
    const result = await pool.query(
      `INSERT INTO devices (device_id, name, hc_node, model_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (device_id) DO UPDATE
         SET name = EXCLUDED.name, hc_node = EXCLUDED.hc_node, model_id = EXCLUDED.model_id
       RETURNING *`,
      [device_id, name || device_id, hc_node || null, model_id || null]
    );
    res.json({ ok: true, device: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: швидкий демо-набір (модель + 3 пристрої) ───────────
app.post("/api/seed", async (req, res) => {
  try {
    const m = await pool.query(
      `INSERT INTO models (name, schema) VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET schema = EXCLUDED.schema RETURNING id`,
      [
        "Solar Sensor",
        {
          temperature: { min: 20, max: 35 },
          humidity: { min: 40, max: 80 },
          light: { min: 100, max: 1000 },
          voltage: { min: 3.5, max: 4.2, decimals: 3 },
          capacity_ah: { min: 5, max: 10, decimals: 3 },
          charge_pct: { min: 40, max: 100 },
        },
      ]
    );
    const modelId = m.rows[0].id;
    const devs = [
      ["DEV-0001", "Пристрій №0001", "HC-Node-A"],
      ["DEV-0002", "Пристрій №0002", "HC-Node-A"],
      ["DEV-0003", "Пристрій №0003", "HC-Node-B"],
    ];
    for (const [id, name, node] of devs) {
      await pool.query(
        `INSERT INTO devices (device_id, name, hc_node, model_id)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (device_id) DO UPDATE SET model_id = EXCLUDED.model_id`,
        [id, name, node, modelId]
      );
    }
    res.json({ ok: true, model_id: modelId, devices: devs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Вбудований генератор телеметрії ─────────────────────────
// Працює всередині процесу сервера (керується кнопками на дашборді),
// тому окремий термінал не потрібен.
const generator = {
  running: false,
  timer: null,
  intervalMs: parseInt(process.env.GENERATOR_INTERVAL_MS || "60000", 10),
  packetsSent: 0,
  deviceCount: 0,
  lastGeneration: null,
  lastPayload: null,
};

// Генерація одного значення зі специфікації поля schema
function generateValue(spec) {
  if (spec === null || spec === undefined) return null;
  if (typeof spec === "number" || typeof spec === "string") return spec;
  if (Array.isArray(spec.values) && spec.values.length) {
    return spec.values[Math.floor(Math.random() * spec.values.length)];
  }
  if (typeof spec.min === "number" && typeof spec.max === "number") {
    const decimals = Number.isInteger(spec.decimals) ? spec.decimals : 2;
    const raw = spec.min + Math.random() * (spec.max - spec.min);
    return parseFloat(raw.toFixed(decimals));
  }
  return null;
}

function buildPayload(device) {
  const schema = device.model_schema || {};
  const payload = { device_id: device.device_id };
  for (const field of Object.keys(schema)) {
    payload[field] = generateValue(schema[field]);
  }
  return payload;
}

async function generatorTick() {
  let devices = [];
  try {
    const { rows } = await pool.query(`
      SELECT d.device_id, d.name, m.name AS model_name, m.schema AS model_schema
      FROM devices d
      LEFT JOIN models m ON m.id = d.model_id
      ORDER BY d.device_id
    `);
    devices = rows;
  } catch (err) {
    console.error("❌ Генератор: читання пристроїв:", err.message);
    return;
  }

  generator.deviceCount = devices.length;
  const withSchema = devices.filter(
    (d) => d.model_schema && Object.keys(d.model_schema).length > 0
  );

  if (!withSchema.length) {
    console.log("⏳ Генератор: немає пристроїв з моделлю/schema. Пропуск.");
    return;
  }

  let lastPayload = null;
  for (const device of withSchema) {
    const p = buildPayload(device);
    lastPayload = p;
    try {
      await pool.query(
        `INSERT INTO sensor_data
           (device_id, temperature, humidity, light, voltage, capacity_ah, charge_pct)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          p.device_id,
          p.temperature ?? null,
          p.humidity ?? null,
          p.light ?? null,
          p.voltage ?? null,
          p.capacity_ah ?? null,
          p.charge_pct ?? null,
        ]
      );
      generator.packetsSent++;
    } catch (err) {
      console.error(`⚠ Генератор ${device.device_id}: ${err.message}`);
    }
  }

  generator.lastGeneration = new Date().toISOString();
  generator.lastPayload = lastPayload;
  console.log(`📤 Генератор: вставлено ${withSchema.length} | всього ${generator.packetsSent}`);
}

app.post("/api/generator/start", (req, res) => {
  const ms = parseInt(req.body?.interval_ms, 10);
  if (ms && ms >= 500) generator.intervalMs = ms;
  if (!generator.running) {
    generator.running = true;
    generatorTick();
    generator.timer = setInterval(generatorTick, generator.intervalMs);
    console.log(`▶ Генератор запущено (${generator.intervalMs} мс)`);
  }
  res.json({ ok: true, running: true, interval_ms: generator.intervalMs });
});

app.post("/api/generator/stop", (req, res) => {
  if (generator.timer) clearInterval(generator.timer);
  generator.timer = null;
  generator.running = false;
  console.log("⏹ Генератор зупинено");
  res.json({ ok: true, running: false });
});

app.get("/api/generator/status", (req, res) => {
  res.json({
    running: generator.running,
    device_count: generator.deviceCount,
    packets_sent: generator.packetsSent,
    interval_ms: generator.intervalMs,
    last_generation: generator.lastGeneration,
    last_payload: generator.lastPayload,
  });
});

// ─── Маркетингова landing-сторінка ───────────────────────────
app.get("/landing", (req, res) => {
  res.sendFile(path.join(__dirname, "landing.html"));
});

// ─── Фронтенд (SPA) ──────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ─── Старт ───────────────────────────────────────────────────
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущено: http://localhost:${PORT}`);
    console.log(`📡 API endpoint: POST /api/data  (x-api-key: ${process.env.API_KEY})`);
  });
}).catch(err => {
  console.error("❌ Помилка ініціалізації БД:", err.message);
  process.exit(1);
});
