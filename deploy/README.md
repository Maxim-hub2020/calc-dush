# Развертывание на Timeweb рядом с CRM

Калькулятор размещается на `calc.cehcrm.ru`. CRM продолжает работать на `cehcrm.ru` и в своем каталоге. Caddy выбирает приложение по адресу сайта, поэтому контейнеры и каталог CRM не смешиваются с калькулятором.

На сервере `93.183.82.177` порты 80 и 443 уже обслуживает Caddy. Не устанавливайте второй Nginx на эти порты. В репозитории CRM есть Docker/Nginx-конфигурация, но внешний запрос к серверу фактически принимает Caddy.

## 1. DNS

Создайте A-запись поддомена:

```text
calc.cehcrm.ru -> 93.183.82.177
```

Инструкция Timeweb: https://timeweb.cloud/docs/domains/dns-records-management

## 2. SSH-доступ для GitHub

Workflow калькулятора использует подтвержденного пользователя `root`, как production-деплой CRM. На сервере подготовьте `rsync` и отдельный каталог приложения:

```bash
apt update
apt install rsync
mkdir -p /var/www/shower-calculator/releases
chmod 755 /var/www/shower-calculator /var/www/shower-calculator/releases
```

Создайте отдельный SSH-ключ только для workflow калькулятора:

```bash
ssh-keygen -t ed25519 -C "github-shower-calculator" -f timeweb_shower_calculator
```

Содержимое файла `timeweb_shower_calculator.pub` добавьте в `/root/.ssh/authorized_keys` на сервере. Закрытый ключ `timeweb_shower_calculator` понадобится только как секрет GitHub.

На сервере это можно сделать так, заменив строку ключа на содержимое `.pub`-файла:

```bash
install -d -m 700 /root/.ssh
printf '%s\n' 'ssh-ed25519 PUBLIC_KEY github-shower-calculator' \
  >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
```

## 3. Первая пустая версия

До первого автоматического деплоя создайте временную страницу:

```bash
mkdir -p /var/www/shower-calculator/releases/bootstrap
printf '%s\n' '<!doctype html><title>Calculator deployment is ready</title>' \
  > /var/www/shower-calculator/releases/bootstrap/index.html
ln -sfn /var/www/shower-calculator/releases/bootstrap /var/www/shower-calculator/current
```

## 4. Caddy внутри CRM

Production-ветка `Maxim-hub2020/crm` запускает Caddy в Docker-контейнере из `/opt/crm`. Каталог `/var/www/shower-calculator` нужно один раз подключить в контейнер как `/srv/shower-calculator:ro`, а в существующий Caddyfile добавить второй site block.

Готовые изменения и команды находятся в [`deploy/crm-integration/README.md`](crm-integration/README.md). Основные параметры:

- CRM: `cehcrm.ru` -> `nginx:80`;
- калькулятор: `calc.cehcrm.ru` -> `/srv/shower-calculator/current`;
- host mount: `/var/www/shower-calculator:/srv/shower-calculator:ro`.

Перед пересозданием Caddy проверьте итоговую конфигурацию внутри контейнера:

```bash
cd /opt/crm
docker compose -p crm --env-file .env -f docker-compose.prod.yml exec -T caddy \
  caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Caddy автоматически выпустит HTTPS-сертификат после того, как A-запись поддомена начнет указывать на `93.183.82.177`. Порты 80 и 443 уже доступны снаружи. Документация: https://caddyserver.com/docs/automatic-https

Шаблон Nginx в `deploy/nginx/` оставлен только для другого сервера, на котором Nginx уже является внешним веб-сервером.

## 5. GitHub Environment и секреты

В репозитории `Maxim-hub2020/calc-dush` откройте `Settings -> Environments`, создайте окружение `production`, затем добавьте секреты:

| Секрет | Пример | Назначение |
| --- | --- | --- |
| `TIMEWEB_SSH_KEY` | содержимое закрытого ключа | Доступ по SSH |
| `TIMEWEB_KNOWN_HOSTS` | результат `ssh-keyscan` | Проверка подлинности сервера |

IP `93.183.82.177`, SSH-порт `22`, пользователь `root`, каталог `/var/www/shower-calculator` и адрес `https://calc.cehcrm.ru` уже зафиксированы в workflow.

Получить строку `known_hosts` нужно из доверенной сети и сверить fingerprint сервера:

```bash
ssh-keyscan -p 22 -H 203.0.113.10
```

Документация GitHub по секретам: https://docs.github.com/en/actions/reference/security/secrets

## 6. Автоматическое обновление

Workflow `.github/workflows/deploy-timeweb.yml` выполняет:

1. `npm ci`;
2. `npm run lint`;
3. `npm run build`;
4. загрузку сборки в отдельный каталог релиза;
5. атомарное переключение ссылки `/var/www/shower-calculator/current`;
6. проверку опубликованного `/version.json`;
7. хранение пяти последних релизов.

Pull request и push в `main` только проверяют проект. Автоматическая публикация на Timeweb выполняется исключительно при push в отдельную ветку калькулятора `codex/calc-timeweb-production`. Ручной запуск доступен через `Actions -> Verify and deploy to Timeweb -> Run workflow`.

Ветки приложений не пересекаются:

- CRM: `Maxim-hub2020/crm`, ветка `codex/timeweb-production`;
- калькулятор: `Maxim-hub2020/calc-dush`, ветка `codex/calc-timeweb-production`.

## Откат

Посмотрите сохраненные версии:

```bash
ls -lt /var/www/shower-calculator/releases
```

Переключите `current` на нужный каталог:

```bash
sudo -u deploy ln -sfn /var/www/shower-calculator/releases/RELEASE_ID \
  /var/www/shower-calculator/current.next
sudo -u deploy mv -Tf /var/www/shower-calculator/current.next \
  /var/www/shower-calculator/current
```

Nginx перезапускать не требуется.

## Важно про данные

Текущая версия хранит архив КП и цены в `localStorage`. После публикации калькулятор будет открываться с любого устройства, но данные каждого браузера останутся отдельными. Для общего архива, общей админки и синхронизации с iPhone нужен backend/API, база данных и авторизация.
