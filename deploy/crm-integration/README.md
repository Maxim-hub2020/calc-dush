# Интеграция с Maxim-hub2020/crm

Production-ветка CRM `codex/timeweb-production` запускает Caddy 2.8 в Docker Compose из `/opt/crm`. Контейнер Caddy занимает хостовые порты 80 и 443, поэтому калькулятор должен быть добавлен в этот же Caddy. Сам калькулятор публикуется независимо из ветки `codex/calc-timeweb-production` репозитория `Maxim-hub2020/calc-dush`.

## Изменение docker-compose.prod.yml

В сервис `caddy` добавьте read-only mount:

```yaml
environment:
  APP_DOMAIN: ${APP_DOMAIN}
volumes:
  - ./docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
  - caddy_data:/data
  - caddy_config:/config
  - /var/www/shower-calculator:/srv/shower-calculator:ro
```

Готовый фрагмент находится в `docker-compose.caddy.fragment.yml`.

## Изменение docker/caddy/Caddyfile

Сохраните существующий блок CRM и добавьте второй блок из `../caddy/shower-calculator.caddy.example`. В результате Caddyfile должен содержать два независимых сайта:

```caddyfile
{$APP_DOMAIN} {
    encode zstd gzip
    reverse_proxy nginx:80
}

calc.cehcrm.ru {
    root * /srv/shower-calculator/current
    encode zstd gzip

    header {
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        X-Frame-Options "SAMEORIGIN"
    }

    @immutable path /assets/*
    header @immutable Cache-Control "public, max-age=31536000, immutable"

    @no_cache path /index.html /sw.js /manifest.webmanifest /version.json
    header @no_cache Cache-Control "no-cache, no-store, must-revalidate"

    try_files {path} {path}/ /index.html
    file_server
}
```

## Применение

Сначала должен существовать файл `/var/www/shower-calculator/current/index.html`. Затем обновите CRM production-ветку и выполните ее штатный GitHub Actions deployment. Он пересоздаст контейнер Caddy с новым mount и site block.

Проверка внутри сервера:

```bash
cd /opt/crm
docker compose -p crm --env-file .env -f docker-compose.prod.yml exec -T caddy \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose -p crm --env-file .env -f docker-compose.prod.yml ps caddy
```

Последующие обновления `calc-dush` только переключают `/var/www/shower-calculator/current`. Перезапуск Caddy и CRM для них не нужен.
