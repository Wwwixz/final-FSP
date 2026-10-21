# API для фронтенда — Медиамониторинг соцсетей

Все описанные ниже запросы **реальные и рабочие** — проверены на стенде `http://109.196.167.225:8080`.
Файл описывает ровно то, что уже реализовано в бэкенде; ничего «на будущее» здесь нет.

- **База:** `http://109.196.167.225:8080` (локально — `http://localhost:8080`)
- **Swagger UI (живая песочница):** `http://109.196.167.225:8080/swagger-ui.html`
- **Формат:** JSON, кодировка **UTF-8** (`Content-Type: application/json; charset=utf-8`)
- **CORS:** на бэкенде открыт для `/api/**` (по умолчанию `*`), методы `GET, POST, PUT, DELETE, OPTIONS`. Фронт можно поднимать на любом dev-порту.
- **Даты:** `LocalDate` → `"2026-09-19"`, `LocalDateTime` → `"2026-10-19T14:30:00"` (ISO-8601, без таймзоны).
- Корень `/` редиректит на Swagger — фронт лучше раздавать отдельно (Vite/nginx) и ходить на `/api/**`.

---

## 0. Шпаргалка по эндпоинтам

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/health` | проверка живости |
| GET | `/api/platforms` | поддерживаемые площадки (VK/OK/MAX) |
| GET | `/api/sources` | список источников (фильтры) |
| GET | `/api/sources/{id}` | один источник |
| POST | `/api/sources` | добавить источник |
| PUT | `/api/sources/{id}` | изменить источник (полное обновление) |
| DELETE | `/api/sources/{id}` | удалить источник |
| POST | `/api/search` | запустить поиск (async) |
| GET | `/api/search` | история поисков |
| GET | `/api/search/{id}` | статус + параметры + статусы источников |
| GET | `/api/search/{id}/publications` | найденные публикации (постранично) |
| POST | `/api/search/{id}/restart` | перезапустить с теми же параметрами |
| DELETE | `/api/search/{id}` | удалить поиск и результаты |
| GET | `/api/search/{id}/export` | выгрузка отчёта (xlsx / docx) |
| GET | `/api/ai/status` | состояние GigaChat |
| POST | `/api/ai/relevance` | разовая проверка связи текста с запросом |

### Справочные значения enum

```
searchType : TOPIC | EVENT | PERSON | NEWS_TEXT
mode       : BY_SOURCES | ALL_PLATFORMS
platform   : VK | OK | MAX
status (поиска)          : RUNNING | COMPLETED | COMPLETED_PARTIAL | FAILED
status (источника)       : PENDING | OK | UNAVAILABLE | ERROR
provider                 : demo | real   (необязательное поле поиска)
```

---

## 1. Справочники

### GET `/api/health`
```json
{ "status": "ok" }
```

### GET `/api/platforms`
```json
[
  { "code": "VK",  "title": "ВКонтакте",     "realApiSupported": true  },
  { "code": "OK",  "title": "Одноклассники", "realApiSupported": false },
  { "code": "MAX", "title": "MAX",           "realApiSupported": false }
]
```
`realApiSupported` — есть ли реальный сбор данных (в `real`-режиме сейчас только VK через API; OK — скрепер; MAX — недоступен).

---

## 2. Источники (CRUD)

**Модель `SourceDto`:**
```json
{
  "id": 2,
  "name": "Красноярск LIFE",
  "platform": "VK",
  "url": "https://vk.com/krsk_life",
  "description": "Городские новости Красноярска",
  "active": true,
  "createdAt": "2026-10-01T10:00:00"
}
```

### GET `/api/sources?platform=VK&active=true&q=красноярск`
Все параметры необязательные: `platform` (VK/OK/MAX), `active` (true/false), `q` (поиск по названию и ссылке).
Ответ — массив `SourceDto`.

### GET `/api/sources/{id}`
`SourceDto` или `404`.

### POST `/api/sources` → **201**
```json
{
  "name": "Новости Красноярска",
  "platform": "VK",
  "url": "https://vk.com/krasnoyarsk_news",
  "description": "необязательно",
  "active": true
}
```
Ограничения: `name` ≤ 200 (обяз.), `platform` (обяз.), `url` ≤ 500 (обяз.), `description` ≤ 1000, `active` — опц. (по умолчанию `true`).
Ошибки: `400` — пустые обязательные поля, или `url` уже занят («Источник с такой ссылкой уже существует»); `400` — некорректная площадка.

### PUT `/api/sources/{id}`
Тело — как у POST, но **все поля обязательны** (полное обновление). Ответ — `SourceDto`.

### DELETE `/api/sources/{id}` → **204** (пустое тело)

---

## 3. Поиск

### POST `/api/search` → **201** (запуск, выполняется асинхронно)
```json
{
  "query": "Безопасность дорожного движения в Красноярском крае",
  "additionalInfo": "необязательное уточнение темы/события",
  "searchType": "TOPIC",
  "mode": "BY_SOURCES",
  "sourceIds": [2, 3, 4],
  "dateFrom": "2026-09-19",
  "dateTo": "2026-10-19",
  "region": "Красноярский край",
  "provider": "real",
  "useAi": true
}
```
Правила:
- `query` — обяз., ≤ 2000.
- `searchType` — обяз. (`TOPIC | EVENT | PERSON | NEWS_TEXT`).
- `mode` — обяз. (`BY_SOURCES` — нужен непустой `sourceIds`; `ALL_PLATFORMS` — по всем активным источникам, `sourceIds` игнорируется).
- `dateFrom`/`dateTo` — опц., формат `YYYY-MM-DD`. Если `dateFrom > dateTo` → `400`.
- `provider` — опц.: `demo` (генератор, стабильно, по умолчанию) или `real` (VK API + скрепер OK, MAX → `UNAVAILABLE`).
- `useAi` — опц.: `true` — дополнительно проверить связь публикаций с запросом нейросетью (поля `aiRelevance`/`aiComment`).

**Ответ — `SearchDetailDto`** (см. ниже). Сразу после запуска `status: "RUNNING"`.

### Модель `SearchDetailDto`
```json
{
  "id": 5,
  "query": "Безопасность дорожного движения в Красноярском крае",
  "additionalInfo": null,
  "searchType": "TOPIC",
  "mode": "BY_SOURCES",
  "dateFrom": "2026-09-19",
  "dateTo": "2026-10-19",
  "region": "Красноярский край",
  "status": "COMPLETED",
  "provider": "real",
  "useAi": true,
  "totalFound": 18,
  "duplicatesSkipped": 3,
  "irrelevantSkipped": 7,
  "sourcesTotal": 3,
  "sourcesProcessed": 3,
  "sourcesOk": 2,
  "sourcesFailed": 1,
  "error": null,
  "createdAt": "2026-10-19T14:30:00",
  "startedAt": "2026-10-19T14:30:00",
  "finishedAt": "2026-10-19T14:30:04",
  "sources": [
    {
      "id": 11,
      "sourceId": 2,
      "sourceName": "Красноярск LIFE",
      "platform": "VK",
      "status": "OK",
      "foundCount": 10,
      "message": null
    },
    {
      "id": 12,
      "sourceId": 3,
      "sourceName": "Канал «Красноярск сейчас»",
      "platform": "MAX",
      "status": "UNAVAILABLE",
      "foundCount": 0,
      "message": "Содержимое каналов MAX недоступно без авторизации"
    }
  ]
}
```
Как читать статусы (важно для сценария «не найдено vs ошибка»):
- `totalFound = 0` и `status = COMPLETED` → **подходящих публикаций нет** (это не ошибка).
- источник `UNAVAILABLE`/`ERROR` → показать сообщение `message`, но результаты остальных источников остаются; общий `status` станет `COMPLETED_PARTIAL`.
- `status = FAILED` → не удалось обработать ни один источник (`error` содержит причину).

### GET `/api/search` — история (новые сверху)
Массив `SearchDto`:
```json
{
  "id": 5,
  "query": "Безопасность дорожного движения...",
  "searchType": "TOPIC",
  "mode": "BY_SOURCES",
  "dateFrom": "2026-09-19",
  "dateTo": "2026-10-19",
  "region": "Красноярский край",
  "status": "COMPLETED",
  "totalFound": 18,
  "sourcesTotal": 3,
  "sourcesProcessed": 3,
  "sourcesFailed": 1,
  "createdAt": "2026-10-19T14:30:00",
  "finishedAt": "2026-10-19T14:30:04"
}
```

### GET `/api/search/{id}` → `SearchDetailDto`
Используется для опроса прогресса во время `RUNNING` (крутить раз в 1–2 сек до `COMPLETED`/`COMPLETED_PARTIAL`/`FAILED`).

### GET `/api/search/{id}/publications?page=0&size=20&sort=relevance`
Параметры: `page` (с 0), `size`, `sort` = `relevance` (по умолчанию) | `date` (свежие сверху) | `found` (в порядке обнаружения).
Ответ — `PageResponse<PublicationDto>`:
```json
{
  "content": [
    {
      "id": 77,
      "sourceId": 2,
      "sourceName": "Красноярск LIFE",
      "platform": "VK",
      "url": "https://vk.com/wall-123_456",
      "title": "На трассе Р-257 поставили камеры",
      "excerpt": "В Красноярске на федеральной трассе...",
      "publishedAt": "2026-10-15T09:30:00",
      "hasDate": true,
      "relevance": 0.62,
      "aiRelevance": 0.85,
      "aiComment": "Материал по безопасности дорожного движения, связь с запросом подтверждена",
      "likes": 12,
      "reposts": 3,
      "views": 540,
      "foundAt": "2026-10-19T14:30:02"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 18,
  "totalPages": 1,
  "last": true
}
```
Поля для отображения в карточке: `sourceName` + `platform`, `title` (если нет — брать `excerpt`), `publishedAt`, `url` (прямая ссылка), `excerpt` (выдержка).
- `hasDate: false` и `publishedAt: null` → дата неизвестна (не показывать как точное соответствие периоду).
- `aiRelevance`/`aiComment` = `null`, если нейросеть не вызывалась (`useAi` не выставлен) или недоступна.

### POST `/api/search/{id}/restart` → `SearchDetailDto`
Повторный запуск с теми же параметрами (создаёт/переобрабатывает результаты). Ответ — как у `POST /api/search`.

### DELETE `/api/search/{id}` → **204**
Удаляет поиск вместе со всеми публикациями и статусами.

### GET `/api/search/{id}/export?format=xlsx` (или `format=docx`)
Возвращает **файл** (не JSON):
- `Content-Type`: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (xlsx) / `...wordprocessingml.document` (docx)
- `Content-Disposition: attachment; filename="otchet-poiska-5.xlsx"`

Для скачивания во фронте — открыть ссылку в новой вкладке / `window.open(...)` или `fetch` + `blob`:
```js
const res = await fetch(`${BASE}/api/search/${id}/export?format=xlsx`);
const blob = await res.blob();
// URL.createObjectURL(blob) → ссылка на скачивание
```
Неизвестный `format` → `400`.

---

## 4. ИИ (GigaChat)

### GET `/api/ai/status` → `AiStatusDto`
```json
{
  "enabled": true,
  "configured": true,
  "connected": true,
  "model": "GigaChat",
  "scope": "GIGACHAT_API_PERS",
  "message": "GigaChat доступен: Access token получен"
}
```
Если `connected: false` — поиск всё равно работает, просто без `aiRelevance`/`aiComment`. Можно показать бейдж «ИИ недоступен».

### POST `/api/ai/relevance` → `AiRelevanceResponse`
Тело:
```json
{
  "query": "Безопасность дорожного движения в Красноярском крае",
  "text": "В Красноярске открыли развязку и поставили камеры на трассе Р-257.",
  "additionalInfo": "необязательно",
  "searchType": "TOPIC"
}
```
Ответ:
```json
{
  "checked": true,
  "relevance": 0.6,
  "comment": "Материал связан с темой безопасности дорожного движения",
  "model": "GigaChat",
  "message": "OK"
}
```
`checked: false` → оценку получить не удалось (см. `message`); `relevance` в этом случае `0`, `comment` = `null`.

---

## 5. Формат ошибок

Все ошибки — единый формат (Spring `ProblemDetail`, RFC 7807):
```json
{
  "type": "about:blank",
  "title": "Некорректный запрос",
  "status": 400,
  "detail": "query: укажите поисковый запрос"
}
```
Коды: `400` — валидация/дубликат/неверный `format`; `404` — нет поиска/источника/пути; `500` — внутренняя ошибка.
`detail` содержит человекочитаемую причину (при ошибках валидации — список полей через `;`).

---

## 6. Как собрать основной сценарий (5 шагов ТЗ)

1. **Справочники при старте:** `GET /api/platforms`, `GET /api/sources`.
2. **Запрос:** пользователь вводит `query` (+ при необходимости `additionalInfo`), выбирает `searchType`.
3. **Период и режим:** `dateFrom`/`dateTo`, `mode` (`BY_SOURCES` → выбрать источники чекбоксами из `GET /api/sources`, либо `ALL_PLATFORMS`).
4. **Запуск:** `POST /api/search` → получаем `id`, показываем «идёт поиск»; опрашиваем `GET /api/search/{id}` каждые 1–2 сек, рисуем прогресс `sourcesProcessed/sourcesTotal` и статусы источников; по завершении — `GET /api/search/{id}/publications`.
5. **Выгрузка:** `GET /api/search/{id}/export?format=xlsx`.

Состояния, которые нужно различать в UI:
- нет результатов → «Подходящие публикации не найдены» (при `totalFound = 0`, `status = COMPLETED`);
- часть источников недоступна → «Результаты неполные: N источников недоступно» + список из `sources[]`;
- ошибка → `status = FAILED`, показать `error`.

### Быстрый пример (curl)
```bash
# 1) запустить поиск
curl -X POST http://109.196.167.225:8080/api/search \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary '{"query":"Безопасность дорожного движения в Красноярском крае","searchType":"TOPIC","mode":"BY_SOURCES","sourceIds":[2,3,4],"dateFrom":"2026-09-19","dateTo":"2026-10-19","region":"Красноярский край","provider":"real","useAi":true}'

# 2) опросить статус
curl http://109.196.167.225:8080/api/search/5

# 3) публикации
curl "http://109.196.167.225:8080/api/search/5/publications?page=0&size=20&sort=relevance"

# 4) выгрузка
curl -OJ "http://109.196.167.225:8080/api/search/5/export?format=xlsx"
```

> ⚠️ Из Windows cmd/PowerShell кириллицу в теле лучше отправлять из файла (`.json` в UTF-8) через `--data-binary @файл.json` — иначе `400` из-за кодировки консоли. Из JS/браузера этой проблемы нет.
