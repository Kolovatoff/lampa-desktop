# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.1.1](https://github.com/Kolovatoff/lampa-desktop/compare/v1.1.0...v1.1.1) (2026-02-11)

### 🐛 Исправления

- исправление отображения иконки на linux ([d7e8c1c](https://github.com/Kolovatoff/lampa-desktop/commit/d7e8c1c2c300d51eaf25069ac7eebeb1a9d5742b))
- исправление ошибки создания окна при изменении DisplayID ([190211e](https://github.com/Kolovatoff/lampa-desktop/commit/190211e24cdd4a41d621f8ee20265c7798499aed))

### ♻️ Рефакторинг

- изменены иконки ([a4154c6](https://github.com/Kolovatoff/lampa-desktop/commit/a4154c6cadd5ee394b263dbd7e9209fb78ca8875))
- убраны icon из createWindow ([f2dce8e](https://github.com/Kolovatoff/lampa-desktop/commit/f2dce8e262bd7b747528ddf05d3d1743e58c30e3))
- улучшенная проверка на запуск одного экземпляра приложения и доп проверки остановки веб для vlc ([4f58b13](https://github.com/Kolovatoff/lampa-desktop/commit/4f58b13eb25832767248c75e687b961d0785604b))

### 🔧 CI/CD

- исправление скрипта получения changelog ([e0a0c03](https://github.com/Kolovatoff/lampa-desktop/commit/e0a0c033c5676991c1658a5c76abadb1af2158b4))

## [1.1.0](https://github.com/Kolovatoff/lampa-desktop/compare/v1.0.0...v1.1.0) (2026-02-04)

### ✨ Новые возможности

- автообновления ([422eea7](https://github.com/Kolovatoff/lampa-desktop/commit/422eea7dfc3b9d4369a8b740448b05ddd44681e9))
- возможность экспорта и импорта настроек ([947fe7f](https://github.com/Kolovatoff/lampa-desktop/commit/947fe7f58ef9ec018b1aa9e88590bc79216770bd))
- добавлен плагин для экспорта настроек из другого приложения лампы на electron или nw ([5846792](https://github.com/Kolovatoff/lampa-desktop/commit/5846792958aeea11fd1f475d30660305e523b604))
- добавлены настройки приложения ([723fc3b](https://github.com/Kolovatoff/lampa-desktop/commit/723fc3b08571f10a1bf5ef9bf83c95c519148b31))
- обработка ошибочного ввода URL лампы ([0cc8a6c](https://github.com/Kolovatoff/lampa-desktop/commit/0cc8a6c46770a8ce08164dd1cd447f4e6cfe9097))
- сохранение позиции окна и дисплея ([62e54ec](https://github.com/Kolovatoff/lampa-desktop/commit/62e54ec3b6a784c83b4558043a1068f804eab02e))

### 🐛 Исправления

- исправлено получение версии в "О приложении" ([d32c4d4](https://github.com/Kolovatoff/lampa-desktop/commit/d32c4d4b624c7a191bc2d0307f6f5ea77a9cf264))
- решение проблемы с нерабочим window.location.reload ([6433b03](https://github.com/Kolovatoff/lampa-desktop/commit/6433b03d5507c46232750b725280ca9bc51941b3))
- **plugins:** фикс шаблона настроек ([dea8951](https://github.com/Kolovatoff/lampa-desktop/commit/dea895118399727678c06a4a927b0d8dbe47b5b2))

### 📚 Документация

- добавлена документация по переносу настроек ([c09e312](https://github.com/Kolovatoff/lampa-desktop/commit/c09e312af7416e8442e7404b1628c11018bb4087))
- изменение ссылок в содержании ([468d02e](https://github.com/Kolovatoff/lampa-desktop/commit/468d02ed8558e199a01889958460587d3a1fba2b))

### 📦 Сборка

- добавлено в сборку deb для linux ([ccf8776](https://github.com/Kolovatoff/lampa-desktop/commit/ccf8776697a4ae2f14f8f29d2a084fcece2efd63))

### 🔧 CI/CD

- добавлено deb для linux ([fe581f4](https://github.com/Kolovatoff/lampa-desktop/commit/fe581f42980e5374fedadd0abff7178ee59621b9))

## 1.0.0 (2026-01-27)

### 🐛 Исправления

- изменены иконки для приложений ([fc7d3d3](https://github.com/Kolovatoff/lampa-desktop/commit/fc7d3d3cc42ef145abbb3fc81bc2d1337677b5ce))
- исправление forge.config.js ([7038db3](https://github.com/Kolovatoff/lampa-desktop/commit/7038db305ec479774e383c470a5b2417daf89552))

### 📦 Сборка

- изменен способ сборки приложения ([0c8e861](https://github.com/Kolovatoff/lampa-desktop/commit/0c8e86131f5567ee69243bb2abce7f139029e698))
- изменение версии приложения ([cc45885](https://github.com/Kolovatoff/lampa-desktop/commit/cc45885f92f3125147aeec1c18f187c3800d1bc0))
- изменение workflows на запуск по тегу, а не пушу в main ([8915ab4](https://github.com/Kolovatoff/lampa-desktop/commit/8915ab48b679872525d1717381091fff4cf0ea90))

### 🔧 CI/CD

- изменен npm на yarn ([744b0e5](https://github.com/Kolovatoff/lampa-desktop/commit/744b0e52ebefb000dfee841423df6ae8f2923e6e))
