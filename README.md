# Lampa Desktop

<img alt="Windows" src="https://img.shields.io/badge/-Windows-blue?style=flat-square&logo=windows&logoColor=white" /> <img alt="Linux" src="https://img.shields.io/badge/-Linux-yellow?style=flat-square&logo=linux&logoColor=white" />


Данный проект является **неофициальным** приложением для просмотра фильмов и сериалов. Он создан на базе **Electron** и использует API различных сервисов для получения данных о фильмах и сериалах.

Исходники лампы доступны тут: https://github.com/yumata/lampa-source

## Возможности

- [x] Поддержка x64 и x32 (для Linux только x64)
- [x] Поддержка Linux
- [x] Автоматическое обновление
- [x] Поддержка VLC Timecode (синхронизация просмотра в VLC с Lampa)
- [x] Не хранит собранную лампу, загружает её с lampa.mx
- [ ] Поддержка MacOS

## Внимание
Этот проект собран на основе двух других репозиториев.  
https://github.com/GideonWhite1029/lampa-desktop (Автор: @GideonWhite1029)  
https://github.com/Boria138/Lampa (Автор: @Boria138)  
Если вы автор этих репозиториев, и вам что-то не нравится, пожалуйста, сообщите об этом.  
Пришлось так сделать, потому что в первом хранилась Lampa собранна в самом приложении, что замедляло введение новых функций.  
А во втором репозитории была реализация ipcMain, ipcRenderer, без необходимости менять исходники Lampa.  
## Лицензия

Этот проект распространяется под лицензией GPL-2.0. Подробнее смотрите в файле LICENSE.
