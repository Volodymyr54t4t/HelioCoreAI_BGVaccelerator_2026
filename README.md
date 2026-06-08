# IoT Dashboard — HG Gateway

## Структура файлів
```
iot-dashboard/
├── server.js        ← Весь бекенд (Express + PostgreSQL)
├── generator.js     ← Сервіс генерації телеметрії за schema моделі
├── .env             ← Конфіг (DB URL, PORT, API_KEY, інтервал генератора)
├── package.json
└── index.html       ← Фронтенд (SPA дашборд + сторінка "Генератор")
```

## Встановлення та запуск

```bash
npm install
npm start            # сервер + дашборд
npm run generator    # окремий процес — генератор телеметрії
```

Відкрий браузер: http://localhost:3000

> ⚠️ Пристрої, серійні номери, назви та моделі **НЕ створюються автоматично**.
> Додавай їх вручну в PostgreSQL (через адмінпанель або SQL). Генератор лише
> знаходить уже існуючі пристрої й генерує для них дані за schema моделі.

---

## API Endpoints

### POST /api/data  — прийом даних від ESP
```
Headers:
  x-api-key: esp-secret-key-123
  Content-Type: application/json

Body:
{
  "device_id":   "DEV-0001",
  "temperature": 24.5,
  "humidity":    62.0,
  "light":       420.0,
  "voltage":     3.85,
  "capacity_ah": 8.2,
  "charge_pct":  74.0
}
```

### GET /api/devices/latest   — останні дані по всіх пристроях
### GET /api/devices/:id/history?limit=50  — історія пристрою
### GET /api/devices           — список пристроїв (з моделлю)
### GET /api/models            — список моделей
### GET  /api/generator/status — стан генератора (для сторінки "Генератор")
### POST /api/generator/status — генератор надсилає сюди свій стан (x-api-key)

---

## Моделі та генератор

Кожна модель зберігається в таблиці `models` і має `schema` (JSONB), яка описує,
які поля генерувати. Генератор не містить жорстко прописаних полів — він читає
schema динамічно й працює з будь-якими новими моделями.

```sql
-- 1. Створи модель
INSERT INTO models (name, schema) VALUES (
  'Solar Sensor',
  '{
     "temperature": { "min": 20, "max": 35 },
     "humidity":    { "min": 40, "max": 80 },
     "voltage":     { "min": 3.5, "max": 4.2, "decimals": 3 }
   }'::jsonb
);

-- 2. Створи пристрій і привʼяжи до моделі
INSERT INTO devices (device_id, name, hc_node, model_id)
VALUES ('DEV-0001', 'Пристрій №0001', 'HC-Node-A',
        (SELECT id FROM models WHERE name = 'Solar Sensor'));
```

Підтримувані формати поля в `schema`:

| Формат | Приклад | Результат |
|--------|---------|-----------|
| Діапазон | `{ "min": 20, "max": 35 }` | випадкове число в діапазоні |
| Діапазон + точність | `{ "min": 3.5, "max": 4.2, "decimals": 3 }` | число з N знаками |
| Список | `{ "values": ["ok", "warn", "fail"] }` | випадковий елемент |
| Фіксоване | `3.7` або `"A"` | стале значення |

---

## Дані які передаються

| Поле         | Джерело       | Опис              |
|--------------|---------------|-------------------|
| temperature  | DHT22/DS18B20 | Температура °C    |
| humidity     | DHT22         | Вологість %       |
| light        | BH1750/LDR    | Освітленість lx   |
| voltage      | HC контролер  | Напруга акумулятора V |
| capacity_ah  | HC контролер  | Ємність Ah        |
| charge_pct   | HC контролер  | Заряд %           |

---

## .env
```
DATABASE_URL=postgresql://...
PORT=3000
API_KEY=esp-secret-key-123
GENERATOR_INTERVAL_MS=5000
GENERATOR_API_BASE=http://localhost:3000
```
