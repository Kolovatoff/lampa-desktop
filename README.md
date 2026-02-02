# Lampa Desktop
[![Github All Releases](https://img.shields.io/github/downloads/Kolovatoff/lampa-desktop/total.svg)]()  
![Windows](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black)
![macOS](https://img.shields.io/badge/mac%20os-000000?style=for-the-badge&logo=macos&logoColor=F0F0F0)

Данный проект является **неофициальным** приложением-клиентом для просмотра фильмов и сериалов. Он создан на базе **Electron** и
использует API различных сервисов для получения данных о фильмах и сериалах.

Исходники лампы доступны тут: https://github.com/yumata/lampa-source

## Возможности

- [x] Поддержка Windows
- [x] Поддержка Linux
- [x] Поддержка MacOS
- [x] Поддержка VLC Timecode (синхронизация просмотра в VLC с Lampa)
- [x] Не хранит собранную лампу локально, загружает её с lampa.mx

## Планы
- [ ] Автоматическое обновление
- [ ] Смена источника
- [ ] Перенос конфигурации
- [ ] Встроенные настройки приложения в лампу (запуск в полноэкранном режиме и т.п.)

## Внимание

Этот проект собран на основе двух других репозиториев.  
https://github.com/GideonWhite1029/lampa-desktop (Автор: @GideonWhite1029)  
https://github.com/Boria138/Lampa (Автор: @Boria138)  
Если вы автор этих репозиториев, и вам что-то не нравится, пожалуйста, сообщите об этом.  
Пришлось так сделать, потому что в первом хранилась Lampa собранна в самом приложении, что замедляло введение новых
функций.  
А во втором репозитории была реализация ipcMain, ipcRenderer, без необходимости менять исходники Lampa.

## Лицензия

Этот проект распространяется под лицензией GPL-2.0. Подробнее смотрите в файле LICENSE.
