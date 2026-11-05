# MogLab (Clinical Biometrics & Appeal Engine) — v2.0 (Production-Ready)

MogLab — это высокоточный биометрический сканер лица нового поколения, реализованный в формате Telegram Mini App (TMA) / Progressive Web App (PWA).

Приложение разделяет биометрическую оценку на:
- **Bone Base (PSL / Harmony)** — генетический костный базис (Canthal Tilt, FWHR, Bigonial Ratio, симметрия, трети лица).
- **Appeal (Уход и софт-признаки)** — вариация яркости кожи, контрастность бровей/губ по Микельсону, Redness Index, скрытая отечность.

---

## ⚡ Ключевые архитектурные модули

### 1. 100% Client-Side Privacy Biometrics (WASM)
Все геометрические и цветовые замеры выполняются на процессоре смартфона пользователя с использованием `@mediapipe/tasks-vision` (478 3D-точек) и HTML5 Canvas API. Исходные фотографии никогда не передаются на сервер.

### 2. 3-Ступенчатый фильтр качества (Pose & Quality Gatekeeper)
В реальном времени проверяет кадр перед допуском к сканированию:
1. **Luminance:** средняя яркость пикселей лица (`65..220` из 255).
2. **Bilateral Lighting:** разница освещения левой и правой скулы не более 18%.
3. **Lens Distortion:** ширина скул (Bizygomatic Width) от 25% до 52% ширины кадра (защита от широкоугольных искажений при съемке слишком близко).
4. **3D Pose:** углы Эйлера (Pitch, Yaw, Roll) не более 7° отклонения.

### 3. DOM-Safe Paywall
Реальные названия и расшифровки найденных **Failos** хранятся в изолированном замыкании и **не попадают в HTML-код** до момента разблокировки. В DOM выводятся статические плейсхолдеры `████████ ██████` с блюром `backdrop-filter: blur(12px)`, что предотвращает обход через инспектор браузера (F12).

### 4. AI Softmaxxing Protocol (Google Gemini 2.5 Flash)
Серверная функция `/api/unlock-pro` передает в Gemini только обезличенные числовые метрики (без фотографий) с жесткой `responseSchema`.
- **Атомарное списание:** кредит списывается только после получения валидного ответа 200 OK.

### 5. Платежи Telegram Stars & Виральность
- Разблокировка за **2 верифицированных реферала** (счетчик увеличивается только после завершения первого скана другом).
- Мгновенная покупка за **100 Telegram Stars** через Telegram Bot API (`createInvoiceLink`, `answerPreCheckoutQuery` < 10 сек, `successful_payment`).
- **Mog Battle (1v1):** генерация ссылок вида `?startapp=battle_SCANID` со сравнительной карточкой по 6 параметрам.
- **Глобальный Leaderboard:** открыт только для сканов через Live Camera (`verified_camera === true`).

---

## 📁 Структура проекта

```
MogLab/
├── api/                       # Vercel Serverless Functions
│   ├── _supabase.ts           # Серверный клиент Supabase & HMAC-валидация Telegram
│   ├── auth.ts                # Валидация initData и учет рефералов
│   ├── complete-scan.ts       # Учет первого скана и начисление кредитов рефереру
│   ├── unlock-pro.ts          # Вызов Gemini 2.5 Flash с responseSchema и списание кредита
│   ├── create-invoice.ts      # Создание инвойса на 100 Stars (XTR)
│   ├── tg-webhook.ts          # Обработка pre_checkout_query и successful_payment
│   ├── leaderboard.ts         # Рейтинг верифицированных Live-сканов
│   └── battle.ts              # Механика дуэлей Mog Battle
├── src/
│   ├── components/            # UI-компоненты
│   │   ├── dashboard/         # ScoreHeader, HalosCard, RadarChart, PaywallCard
│   │   ├── modals/            # ProUnlockModal, MogBattleModal, LeaderboardModal
│   │   ├── CameraScanner.tsx  # Живой сканер с сеткой 478 точек и Gatekeeper HUD
│   │   ├── PhotoUploader.tsx  # Загрузка фото из галереи (verified_camera=false)
│   │   ├── PrivacyScreen.tsx  # Onboarding экран локальной приватности
│   │   ├── Disclaimer.tsx     # Юридический дисклеймер (Compliance)
│   │   └── Header.tsx         # Переключатель PSL/Harmony, баланс PRO, логотип
│   ├── services/
│   │   ├── biometrics.ts      # MediaPipe WASM, вычисление Canthal Tilt, FWHR, углов
│   │   ├── gatekeeper.ts      # 4 проверки освещения, дистанции и 3D-позы
│   │   ├── pixelAnalyzer.ts   # Sclera баланс белого, Redness Index, контраст Микельсона
│   │   ├── scoring.ts         # Нормализация 1.0..10.0, Bone vs Appeal, радарные оси
│   │   ├── telegram.ts        # Haptic feedback, WebApp SDK, шаринг
│   │   └── apiClient.ts       # Клиент к серверным API
│   ├── types/                 # TypeScript интерфейсы
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase/
│   └── schema.sql             # SQL-схема таблиц с Row Level Security (RLS)
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── .env.example
```

---

## 🚀 Быстрый старт и запуск

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка переменных окружения
Скопируйте `.env.example` в `.env` и укажите ключи:
```bash
cp .env.example .env
```
Заполните:
- `TELEGRAM_BOT_TOKEN`: токен вашего бота из @BotFather
- `GEMINI_API_KEY`: Google AI Studio API ключ (тариф Pay-as-you-go)
- `SUPABASE_URL`: URL инстанса Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: сервисный ключ Supabase для серверных функций

### 3. Настройка базы данных Supabase
Откройте SQL Editor в Supabase Dashboard и выполните скрипт из файла:
`supabase/schema.sql`

### 4. Запуск локального сервера разработки
```bash
npm run dev
```
Локальный сервер запустится на `http://localhost:5173`.
В режиме разработки Vite dev middleware автоматически эмулирует все эндпоинты `/api/*`, что позволяет тестировать сканирование, Gatekeeper, пейволл и расчеты без поднятия внешнего бэкенда!

### 5. Сборка для продакшена
```bash
npm run build
```
Готовые оптимизированные статические файлы будут в директории `dist/`.

---

## ☁️ Развертывание на Vercel

1. Подключите репозиторий в панели **Vercel**.
2. В настройках проекта добавьте переменные окружения из `.env`:
   - `TELEGRAM_BOT_TOKEN`
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Нажмите **Deploy**. Директория `api/` автоматически развернется как Vercel Serverless Functions, а фронтенд — как SPA.
4. В BotFather укажите Webhook:
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-vercel-domain>/api/tg-webhook`
5. Настройте Mini App в BotFather (`/newapp`) с URL вашего домена Vercel.
