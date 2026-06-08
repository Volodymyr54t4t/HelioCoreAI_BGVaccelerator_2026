# IoT Dashboard — HG Gateway

## Структура файлів
```
iot-dashboard/
├── server.js        ← Весь бекенд (Express + PostgreSQL)
├── .env             ← Конфіг (DB URL, PORT, API_KEY)
├── package.json
└── public/
    └── index.html   ← Фронтенд (SPA дашборд)
```

## Встановлення та запуск

```bash
npm install
npm start
```

Відкрий браузер: http://localhost:3000

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
### GET /api/devices           — список пристроїв

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
```
