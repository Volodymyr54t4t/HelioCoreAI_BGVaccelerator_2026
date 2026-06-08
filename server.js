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
    await client.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id           SERIAL PRIMARY KEY,
        device_id    VARCHAR(50) UNIQUE NOT NULL,
        name         VARCHAR(100),
        hc_node      VARCHAR(50),
        created_at   TIMESTAMP DEFAULT NOW()
      );
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

    // Підставні пристрої (якщо ще нема)
    await client.query(`
      INSERT INTO devices (device_id, name, hc_node) VALUES
        ('DEV-0001', 'Пристрій №0001', 'HC-Node-A'),
        ('DEV-0002', 'Пристрій №0002', 'HC-Node-A'),
        ('DEV-0003', 'Пристрій №0003', 'HC-Node-B')
      ON CONFLICT (device_id) DO NOTHING;
    `);

    // Підставні дані для демо (якщо таблиця порожня)
    const { rows } = await client.query("SELECT COUNT(*) FROM sensor_data");
    if (parseInt(rows[0].count) === 0) {
      const devices = ["DEV-0001", "DEV-0002", "DEV-0003"];
      for (let i = 0; i < 20; i++) {
        const dev = devices[i % 3];
        await client.query(`
          INSERT INTO sensor_data
            (device_id, temperature, humidity, light, voltage, capacity_ah, charge_pct, received_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7, NOW() - INTERVAL '${i * 5} minutes')
        `, [
          dev,
          (20 + Math.random() * 15).toFixed(2),
          (40 + Math.random() * 40).toFixed(2),
          (100 + Math.random() * 900).toFixed(2),
          (3.5 + Math.random() * 0.8).toFixed(3),
          (5 + Math.random() * 5).toFixed(3),
          (40 + Math.random() * 60).toFixed(2),
        ]);
      }
      console.log("✅ Демо-дані вставлено");
    }

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
    // Авто-реєстрація пристрою якщо новий
    await pool.query(`
      INSERT INTO devices (device_id, name, hc_node)
      VALUES ($1, $1, 'Auto')
      ON CONFLICT (device_id) DO NOTHING
    `, [device_id]);

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

// ─── API: список пристроїв ───────────────────────────────────
app.get("/api/devices", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM devices ORDER BY created_at");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
