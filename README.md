# Урви

Статический frontend-прототип сервиса для поиска вещей, которые отдают бесплатно рядом с пользователем. Объявления загружаются из Supabase, а интерфейс показывает ленту, фильтры, поиск, карту, карточку объявления и демо-сценарий подписки.

## Запуск

```bash
python3 -m http.server 8000
```

Открыть:

```text
http://localhost:8000/urvi-prototype.html
```

## Supabase

Проект подключён к Supabase:

```text
Project ref: mcayvxslrgvghcojxswb
Table: public.listings
```

В таблицу загружено 70 объявлений: 20 из исходного прототипа и 50 из CSV-выгрузки Avito.

Подробная документация: [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md).
