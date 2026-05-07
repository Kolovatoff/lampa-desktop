# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [1.4.0](https://github.com/Kolovatoff/lampa-desktop/compare/v1.3.1...v1.4.0) (2026-04-10)

### ✨ Новые возможности

- добавлена возможность включать и отключать CORS (актуально для балансеров) ([0428008](https://github.com/Kolovatoff/lampa-desktop/commit/0428008d455443fc5940d40b2cce84ff83c581b9))

### 🐛 Исправления

- поиск теперь не открывается по кнопке S, если открыто модальное окно ([e38fa37](https://github.com/Kolovatoff/lampa-desktop/commit/e38fa37b31aaf319272c5f7b29563112249febe4))

### ♻️ Рефакторинг

- удален http-proxy для vlc и заменен подменой OPTIONS ответа ([4fef3c3](https://github.com/Kolovatoff/lampa-desktop/commit/4fef3c38577717f6a0ec6f3031e691aa167362b3))

## [1.3.1](https://github.com/Kolovatoff/lampa-desktop/compare/v1.3.0...v1.3.1) (2026-03-23)

### 🐛 Исправления

- исправить параметр webSecurity ([737f0a7](https://github.com/Kolovatoff/lampa-desktop/commit/737f0a7ae1139c1f92697ad9d6bd28f3d93912b1))
- **Handlers:** вернуть потерянный get-app-version ([c17c98c](https://github.com/Kolovatoff/lampa-desktop/commit/c17c98c6fdbc0024ddfd0eb13de640b3f5a61293))

### 📚 Документация

- **README:** исправление ссылки на документацию ([07b069a](https://github.com/Kolovatoff/lampa-desktop/commit/07b069a08d11c465fd2532dc7419794bf400af15))

### ♻️ Рефакторинг

- горячая клавиша M открывает/закрывает меню ([14c0741](https://github.com/Kolovatoff/lampa-desktop/commit/14c0741a217a83173552201abeb3fd6b9c4ec1d2))
- добавить кнопку "Список изменений на GitHub" ([0fa07fb](https://github.com/Kolovatoff/lampa-desktop/commit/0fa07fb6f6acbc761163793fe469e39f2bdaa9e1))
- добавить поиск плеера кнопкой в настройках ([ee7782d](https://github.com/Kolovatoff/lampa-desktop/commit/ee7782d949d00b049377dd9f5c5f315af2431295))
- изменить переопределение кнопки fullscreen ([e813f38](https://github.com/Kolovatoff/lampa-desktop/commit/e813f38d2453c0ab6ec42a04a3e45d9bbc816f7a))
- отменить поиск плеера если выбран внутренний плеер ([2b7b924](https://github.com/Kolovatoff/lampa-desktop/commit/2b7b924f4760243683885731dab593424daf9a63))
- переименовать Настройки приложения в Приложение ([683e7f5](https://github.com/Kolovatoff/lampa-desktop/commit/683e7f598fbd526d35ae199ed3b12b5c0881a79f))

## [1.3.0](https://github.com/Kolovatoff/lampa-desktop/compare/v1.2.1...v1.3.0) (2026-03-09)

### ✨ Новые возможности

- добавлен inputManager для управления горячими клавишами и курсором ([3aa6b16](https://github.com/Kolovatoff/lampa-desktop/commit/3aa6b16902e2934b3187df63a2f9017c16b8c872))
- удаление микрофона на формах ввода ([6baf960](https://github.com/Kolovatoff/lampa-desktop/commit/6baf96007c8e1632057cdf6b617edb7b945c3eff))

### 🐛 Исправления

- исправления под MacOS ([a3a29a1](https://github.com/Kolovatoff/lampa-desktop/commit/a3a29a1e10309e84e153073a59280e1f2031d8ba))
- отключение горячей клавиши полноэкранного режима при вводе ([dd0790a](https://github.com/Kolovatoff/lampa-desktop/commit/dd0790a2d4a8f94fcf51431b2958d45e94fd430f))

### 📚 Документация

- добавлена ссылка на документацию от ИИ ([bcbeb8a](https://github.com/Kolovatoff/lampa-desktop/commit/bcbeb8aa9e9203cc79c596a615400d29fd50c6f6))
- обновление бейджа скачиваний, без учета файлов обновлений ([e6eb174](https://github.com/Kolovatoff/lampa-desktop/commit/e6eb174122fa19ce2586f8b0a3e7fa820f4d7d52))
- обновление README.md ([0020d48](https://github.com/Kolovatoff/lampa-desktop/commit/0020d48ffb9102de0e572c3ed9a8a7514e819ef3))

### ♻️ Рефакторинг

- базовая защита spawn ([370ee48](https://github.com/Kolovatoff/lampa-desktop/commit/370ee481cb5f028527a9ea83382467f921050bbb))
- добавлена кнопка открытия веб-интерфейса torrserver ([3e99de0](https://github.com/Kolovatoff/lampa-desktop/commit/3e99de0b1e438dd3fb25c4980db054912f651906))
- частичный перевод приложения ([f821927](https://github.com/Kolovatoff/lampa-desktop/commit/f821927b5898451345c6300ce7229bdfae26ac92))

### 📦 Сборка

- добавление rpm для linux ([651407b](https://github.com/Kolovatoff/lampa-desktop/commit/651407ba13765acb9412e472ce352ba8f27688ea))
- добавление rpm пакетов ([f11bad6](https://github.com/Kolovatoff/lampa-desktop/commit/f11bad6196855e0877595d78a6fb2eb4ee26b7b5))

## [1.2.1](https://github.com/Kolovatoff/lampa-desktop/compare/v1.2.0...v1.2.1) (2026-02-19)

### 🐛 Исправления

- при изменении параметров ts, меню убегало вверх ([8aae410](https://github.com/Kolovatoff/lampa-desktop/commit/8aae410db69486558e869ce200d4c4d34509a1a4))

### 📚 Документация

- обновление README.md ([efac48b](https://github.com/Kolovatoff/lampa-desktop/commit/efac48b53a8d3a39c5e0ceee4ddf98144e488b2b))

### ♻️ Рефакторинг

- убрано указание localhost у TS. Т.к. ts не запускается на ipv6 при указании localhost ([2ea2e59](https://github.com/Kolovatoff/lampa-desktop/commit/2ea2e59f4a9cafb14bbb5333cf12b3c6070f462a))

## [1.2.0](https://github.com/Kolovatoff/lampa-desktop/compare/v1.1.1...v1.2.0) (2026-02-18)

### ✨ Новые возможности

- встроенный torrserver ([47c73bf](https://github.com/Kolovatoff/lampa-desktop/commit/47c73bfd116dcffa7399755a525db28330f13c2f))
- модуль инициализации хранилища лампы ([95bfd45](https://github.com/Kolovatoff/lampa-desktop/commit/95bfd45e98e50f3ae7eba6e0b374f46bb4e20f8e))
- модуль поиска установленного VLC ([57bb036](https://github.com/Kolovatoff/lampa-desktop/commit/57bb0365c69f4c1c33e1ab20b3dbf54a848dd145))
- модуль работы с папками и открытие TS папки ([f6e1c3e](https://github.com/Kolovatoff/lampa-desktop/commit/f6e1c3e6c2b0708e6f3241487c5810f03ba43f1d))

### 📚 Документация

- изменена инструкция export-import.md ([23fd66b](https://github.com/Kolovatoff/lampa-desktop/commit/23fd66bc16ffd82e500cbad6310c86f4cf808f02))
- обновление документации по экспорту/импорту ([dd72ee8](https://github.com/Kolovatoff/lampa-desktop/commit/dd72ee8123065a6d55f3faf3a6745d2f42739617))
- обновление README.md ([081d5d8](https://github.com/Kolovatoff/lampa-desktop/commit/081d5d8e8f5856bb7c7cd62fe34b5e26f581a106))

### ♻️ Рефакторинг

- добавление ссылки на ts по-умолчанию localhost ([d858ba7](https://github.com/Kolovatoff/lampa-desktop/commit/d858ba7221e3da2698b46b717c78fb3f6c4e16b9))
- изменение структуры приложения ([6e3cc84](https://github.com/Kolovatoff/lampa-desktop/commit/6e3cc8466f0be381f6fe42fb2c8330b69dede0a4))
- обновление плагина экспорт/импорт ([75410a0](https://github.com/Kolovatoff/lampa-desktop/commit/75410a050100cf2b9e274139ec8e081516748941))

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
