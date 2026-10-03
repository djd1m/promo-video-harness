# promo-video-harness

Linux/Docker harness для локального synthetic UI: существующий Playwright
recorder, шаблон Remotion и проверки с привязкой квитанций к исходникам.
Текущая поставка — полный harness; готовые MP4 сейчас не обязательны.

На историческом source `c0910b4` прошли 29 тестов, UI, capture и doctor;
свежая установка по lockfile также прошла. Полный рендер не завершён. Эти
измерения не подтверждают последующие изменения watchdog/комментариев или новый
export. См. [измерения](docs/runtime-evidence.md) и [границы поставки](docs/current-delivery-scope.md).

## Полный checkout и зависимости

Нужны Linux, Bash 4+, Node 22, npm, Docker и утилиты, проверяемые doctor.
Полные исходники доступны в публичном репозитории:

```bash
git clone https://github.com/djd1m/promo-video-harness.git ./promo-video-harness
cd ./promo-video-harness
(cd promo/remotion && npm ci --ignore-scripts --no-audit --no-fund)
```

Образ готовится отдельно; необязательная сборка требует сети. Существующий
[рецепт с закреплёнными версиями](promo/render-image/Dockerfile) ранее прошёл
чистую сборку с exit 0. Это исторический результат, не новая сборка кандидата:

```bash
# Только для подготовки своего образа; пропустите, если он уже готов.
TAG='promo-render:local-reviewed' bash promo/render-image/build.sh
```

CLI не устанавливает зависимости и не скачивает/собирает образ. Выберите
подготовленный совместимый образ. Каталог артефактов должен принадлежать вам и
находиться вне checkout и домашнего каталога; записи и видео не входят в Git:

```bash
export PROMO_IMAGE='promo-render:local-reviewed'
artifact_dir=$(mktemp -d /tmp/promo-video-demo.XXXXXXXX)
common=(--artifacts "$artifact_dir" --config "$PWD/demo/synthetic/config.mjs"
        --cpus 2 --memory 3g --timeout 900 --attempt-timeout 4800
        --watchdog not_applicable)
bin/promo-video doctor "${common[@]}"
```

## Необязательный выпуск видео

Непосредственно перед browser E2E выполните read-only проверку ресурсов,
образа и mounts из [walkthrough](docs/pipeline-walkthrough.md). Общий host UI
контейнер пользователю не нужен. Конфиги и recorder — доверенный исполняемый код.

```bash
bin/promo-video capture demo "${common[@]}"
# Укажите точный Capture inputs из успешно завершённой команды.
capture_inputs="$artifact_dir/attempts/capture-XXXXXXXX/assets"
bin/promo-video render demo "${common[@]}" --inputs "$capture_inputs"
# До verify нужен независимый просмотр видео и доказательств титров.
# Укажите точный Render attempt из команды render.
render_attempt="$artifact_dir/attempts/render-XXXXXXXX"
bin/promo-video verify demo "${common[@]}" --inputs "$render_attempt"
```

Замените оба placeholder. Лимит операции — 900s, попытки — 4,800s плюс cleanup.
Приёмка видео требует всех gates и независимого review. Коды: **0** — указанные
проверки прошли; **1** — доказанный дефект; **2** — работа/данные недоступны или
неполны. Успешный capture не означает приёмку видео.

## Подключение навыка отдельно

Зарегистрируйте полный канонический каталог `.claude/skills/promo-video/` из
этого checkout поддерживаемым механизмом вашего агента. Сохраните modules/scripts
и runtime вместе: копирование одного `SKILL.md` не устанавливает harness.
См. [навык](.claude/skills/promo-video/SKILL.md),
[архитектуру](docs/implementation-decisions.md), [notices](THIRD_PARTY_NOTICES.md)
и [статус публикации](docs/publication-status.md). Владелец явно разрешил
публикацию исходников. Лицензия собственного кода пока не выбрана; дополнительное
лицензионное разрешение не подразумевается.
[English](README.md).
