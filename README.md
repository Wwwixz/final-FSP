# Медиамониторинг — проект OpenAPI

Спецификация API по техническому заданию из [`tz_final.pdf`](tz_final.pdf).

- [`openapi.yaml`](openapi.yaml) — OpenAPI 3.1.0: источники, асинхронный поиск VK/ОК/MAX, покрытие и ошибки, результаты, экспорт XLSX.
- [`docs/api-design.md`](docs/api-design.md) — сценарий клиента, соответствие ТЗ, состояния, дедупликация, даты и проектные решения.

Сейчас подготовлен **контракт API**, сервер и прототип ещё не реализованы. Спецификацию можно открыть в Swagger Editor или совместимом просмотрщике OpenAPI 3.1. Примеры запросов включены в `POST /searches`; это иллюстрации формата, не реальные поисковые результаты.

Для проверки спецификации в отдельном Python-окружении:

```sh
python3 -m venv /tmp/fsp-api-venv
/tmp/fsp-api-venv/bin/pip install openapi-spec-validator==0.9.0
/tmp/fsp-api-venv/bin/openapi-spec-validator openapi.yaml
```
