(function () {
  "use strict";

  var icon_quit =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 4h3a2 2 0 0 1 2 2v1m-5 13h3a2 2 0 0 0 2-2v-1M4.425 19.428l6 1.8A2 2 0 0 0 13 19.312V4.688a2 2 0 0 0-2.575-1.916l-6 1.8A2 2 0 0 0 3 6.488v11.024a2 2 0 0 0 1.425 1.916M16.001 12h5m0 0l-2-2m2 2l-2 2"/></svg>';

  function addQuitButton() {
    const container = Lampa.Head.render().find(".head__actions");

    // Добавляем кнопку выхода
    const icon = $(`<div class="head__action selector">${icon_quit}</div>`);
    container.append(icon);
    icon.on("hover:enter", () => {
      window.electronAPI.closeApp();
    });
  }

  var settings_app_icon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M7.5 13.75v.5q0 .325.213.538T8.25 15t.538-.213T9 14.25v-2.5q0-.325-.213-.537T8.25 11t-.537.213t-.213.537v.5h-.75q-.325 0-.537.213T6 13t.213.538t.537.212zm3.25 0h6.5q.325 0 .538-.213T18 13t-.213-.537t-.537-.213h-6.5q-.325 0-.537.213T10 13t.213.538t.537.212m5.75-4h.75q.325 0 .538-.213T18 9t-.213-.537t-.537-.213h-.75v-.5q0-.325-.213-.537T15.75 7t-.537.213T15 7.75v2.5q0 .325.213.538t.537.212t.538-.213t.212-.537zm-9.75 0h6.5q.325 0 .538-.213T14 9t-.213-.537t-.537-.213h-6.5q-.325 0-.537.213T6 9t.213.538t.537.212M4 19q-.825 0-1.412-.587T2 17V5q0-.825.588-1.412T4 3h16q.825 0 1.413.588T22 5v12q0 .825-.587 1.413T20 19h-4v1q0 .425-.288.713T15 21H9q-.425 0-.712-.288T8 20v-1zm0-2h16V5H4zm0 0V5z"/></svg>';

  class SettingsManager {
    constructor(componentName) {
      this.queue = [];
      this.componentName = componentName;
    }

    addToQueue(paramConfig) {
      this.queue.push({
        ...paramConfig,
        order: paramConfig.order || this.queue.length + 1,
      });
      return this;
    }

    async loadAsyncSetting(key, paramConfig) {
      try {
        const value = await window.electronAPI.store.get(key);
        localStorage.setItem(`${this.componentName}_${key}`, value);

        this.addToQueue({
          ...paramConfig,
          param: {
            ...paramConfig.param,
            default: value,
          },
        });
      } catch (error) {
        console.error(`APP Failed to load ${key}:`, error);
      }
    }

    apply() {
      this.queue.sort((a, b) => (a.order || 999) - (b.order || 999));

      this.queue.forEach((item) => {
        Lampa.SettingsApi.addParam({
          component: this.componentName,
          param: item.param,
          field: item.field,
          onChange: item.onChange,
        });
      });

      this.queue = [];
    }
  }

  function addAppSettings() {
    Lampa.Lang.add({
      // Основные настройки
      app_settings: {
        ru: "Приложение",
        en: "App",
        uk: "Докладання",
      },
      app_settings_fullscreen_field_name: {
        ru: "Запускать в полноэкранном режиме",
        en: "Launch in fullscreen mode",
        uk: "Запускати в повноекранному режимі",
      },
      app_settings_autoupdate_field_name: {
        ru: "Автоматическое обновление",
        en: "Automatic update",
        uk: "Автоматичне оновлення",
      },
      app_settings_lampa_url_placeholder: {
        ru: "Введите url лампы, начиная с http...",
        en: "Enter lamp URL starting with http...",
        uk: "Введіть url лампи, починаючи з http...",
      },
      app_settings_lampa_url_name: {
        ru: "URL лампы",
        en: "Lamp URL",
        uk: "URL лампи",
      },
      app_settings_lampa_url_description: {
        ru: "По-умолчанию: http://lampa.mx и не рекомендуем его менять",
        en: "Default: http://lampa.mx and we don't recommend changing it",
        uk: "За замовчуванням: http://lampa.mx і не рекомендуємо його змінювати",
      },
      app_settings_lampa_url_ok: {
        ru: "Сохранено, ожидайте перехода...",
        en: "Saved, waiting for redirect...",
        uk: "Збережено, очікуйте переходу...",
      },
      app_settings_lampa_url_error: {
        ru: "Неверный URL",
        en: "Invalid URL",
        uk: "Невірний URL",
      },
      app_settings_about_field_name: {
        ru: "О приложении",
        en: "About the app",
        uk: "Про додаток",
      },
      app_settings_about_field_description: {
        ru: "Узнать версию и др. информацию о приложении",
        en: "Check version and other app information",
        uk: "Дізнатися версію та іншу інформацію про додаток",
      },

      // TorrServer
      app_settings_ts_field_name: {
        ru: "TorrServer",
        en: "TorrServer",
        uk: "TorrServer",
      },
      app_settings_ts_field_description: {
        ru: "Управление TorrServer",
        en: "Control TorrServer",
        uk: "Керування TorrServer",
      },
      app_settings_ts_autostart_field_name: {
        ru: "Автозапуск при старте Lampa",
        en: "Autostart on Lampa launch",
        uk: "Автозапуск під час старту Lampa",
      },
      app_settings_ts_port_name: {
        ru: "Порт на котором запускать TS",
        en: "Port to run TS on",
        uk: "Порт на якому запускати TS",
      },
      app_settings_ts_port_description: {
        ru: "Если не знаете зачем это, оставьте 8090",
        en: "If you don't know why you need this, leave 8090",
        uk: "Якщо не знаєте навіщо це, залиште 8090",
      },
      app_settings_ts_port_ok: {
        ru: "Успешно изменено, перезапустите TorrServer",
        en: "Successfully changed, restart TorrServer",
        uk: "Успішно змінено, перезапустіть TorrServer",
      },
      app_settings_ts_status_name: {
        ru: "Статус",
        en: "Status",
        uk: "Статус",
      },
      app_settings_ts_version_name: {
        ru: "Версия",
        en: "Version",
        uk: "Версія",
      },
      app_settings_ts_status_installed_running: {
        ru: "✅ Запущен",
        en: "✅ Running",
        uk: "✅ Запущено",
      },
      app_settings_ts_status_installed_stopped: {
        ru: "❌ Остановлен",
        en: "❌ Stopped",
        uk: "❌ Зупинено",
      },
      app_settings_ts_status_not_installed: {
        ru: "🚫 Не установлен",
        en: "🚫 Not installed",
        uk: "🚫 Не встановлено",
      },
      app_settings_ts_status_install_prompt: {
        ru: "Установите TorrServer, нажав кнопку запуска",
        en: "Install TorrServer by clicking the start button",
        uk: "Встановіть TorrServer, натиснувши кнопку запуску",
      },

      // Кнопки управления TorrServer
      app_settings_ts_start_name: {
        ru: "▶️ Запуск TorrServer",
        en: "▶️ Start TorrServer",
        uk: "▶️ Запуск TorrServer",
      },
      app_settings_ts_stop_name: {
        ru: "🛑 Остановка TorrServer",
        en: "🛑 Stop TorrServer",
        uk: "🛑 Зупинка TorrServer",
      },
      app_settings_ts_restart_name: {
        ru: "🔁 Перезапуск TorrServer",
        en: "🔁 Restart TorrServer",
        uk: "🔁 Перезапуск TorrServer",
      },
      app_settings_ts_check_update_name: {
        ru: "🔍 Проверка обновлений TorrServer",
        en: "🔍 Check TorrServer updates",
        uk: "🔍 Перевірка оновлень TorrServer",
      },
      app_settings_ts_open_path_name: {
        ru: "📂 Открыть папку TorrServer",
        en: "📂 Open TorrServer folder",
        uk: "📂 Відкрити папку TorrServer",
      },
      app_settings_ts_open_web_name: {
        ru: "🌐 Открыть веб TorrServer",
        en: "🌐 Open TorrServer web",
        uk: "🌐 Відкрити веб TorrServer",
      },
      app_settings_ts_uninstall_name: {
        ru: "🗑️ Удалить TorrServer (полностью)",
        en: "🗑️ Uninstall TorrServer (completely)",
        uk: "🗑️ Видалити TorrServer (повністю)",
      },
      app_settings_ts_uninstall_keep_data_name: {
        ru: "💾 Удалить TorrServer (сохранить данные)",
        en: "💾 Uninstall TorrServer (keep data)",
        uk: "💾 Видалити TorrServer (зберегти дані)",
      },

      // Статусы загрузки TorrServer
      app_settings_ts_start_loading: {
        ru: "Выполняется запуск TorrServer",
        en: "Starting TorrServer",
        uk: "Виконується запуск TorrServer",
      },
      app_settings_ts_download_loading: {
        ru: "Выполняется скачивание и запуск TorrServer",
        en: "Downloading and starting TorrServer",
        uk: "Виконується завантаження та запуск TorrServer",
      },
      app_settings_ts_stop_loading: {
        ru: "Остановка TorrServer",
        en: "Stopping TorrServer",
        uk: "Зупинка TorrServer",
      },
      app_settings_ts_restart_loading: {
        ru: "Перезапуск TorrServer",
        en: "Restarting TorrServer",
        uk: "Перезапуск TorrServer",
      },
      app_settings_ts_check_update_loading: {
        ru: "Проверка обновлений TorrServer",
        en: "Checking TorrServer updates",
        uk: "Перевірка оновлень TorrServer",
      },
      app_settings_ts_update_loading: {
        ru: "Обновление TorrServer",
        en: "Updating TorrServer",
        uk: "Оновлення TorrServer",
      },
      app_settings_ts_uninstall_loading: {
        ru: "Выполняется ПОЛНОЕ удаление TorrServer...",
        en: "Performing COMPLETE uninstall of TorrServer...",
        uk: "Виконується ПОВНЕ видалення TorrServer...",
      },
      app_settings_ts_uninstall_keep_data_loading: {
        ru: "Выполняется удаление TorrServer...",
        en: "Uninstalling TorrServer...",
        uk: "Виконується видалення TorrServer...",
      },
      app_settings_ts_install_prompt: {
        ru: "Сначала установите TorrServer, нажав на запуск",
        en: "First install TorrServer by clicking start",
        uk: "Спочатку встановіть TorrServer, натиснувши на запуск",
      },

      // Обновления TorrServer
      app_settings_ts_update_found_title: {
        ru: "Найдено обновление TorrServer",
        en: "TorrServer update found",
        uk: "Знайдено оновлення TorrServer",
      },
      app_settings_ts_update_found_message: {
        ru: "Найдено обновление TorrServer.",
        en: "TorrServer update found.",
        uk: "Знайдено оновлення TorrServer.",
      },
      app_settings_ts_update_installed: {
        ru: "Установлена: {current_version}",
        en: "Installed: {current_version}",
        uk: "Встановлена: {current_version}",
      },
      app_settings_ts_update_latest: {
        ru: "Последняя версия: {latest_version}",
        en: "Latest version: {latest_version}",
        uk: "Остання версія: {latest_version}",
      },
      app_settings_ts_update_button: {
        ru: "Обновить",
        en: "Update",
        uk: "Оновити",
      },
      app_settings_ts_update_success: {
        ru: "Успешно обновлено",
        en: "Successfully updated",
        uk: "Успішно оновлено",
      },
      app_settings_ts_update_no_updates: {
        ru: "Обновлений нет, у вас последняя версия",
        en: "No updates, you have the latest version",
        uk: "Оновлень немає, у вас остання версія",
      },

      app_settings_web_security_field_name: {
        ru: "Проверка CORS",
        en: "CORS check",
        uk: "Перевірка CORS",
      },
      app_settings_web_security_field_description: {
        ru: "Если балансировщики не работают, укажите «Нет» — CORS отключится, но вы действуете на свой риск.",
        en: "If load balancers do not work, set 'No' — CORS will be disabled, but you do so at your own risk.",
        uk: "Якщо балансувальники не працюють, вкажіть «Ні» — CORS вимкнеться, але ви дієте на свій ризик.",
      },
      app_settings_web_security_notify: {
        ru: "Перезапустите приложение, для применения настройки!",
        en: "Restart the application to apply the setting!",
        uk: "Перезапустіть застосунок, щоб застосувати налаштування!",
      },

      // Импорт/Экспорт
      app_settings_ie_field_name: {
        ru: "Экспорт/Импорт настроек",
        en: "Export/Import settings",
        uk: "Експорт/Імпорт налаштувань",
      },
      app_settings_ie_field_description: {
        ru: "Резервная копия данных или перенос из другого приложения",
        en: "Backup data or transfer from another application",
        uk: "Резервна копія даних або перенесення з іншого додатку",
      },
      app_settings_ie_btn_export_title: {
        ru: "Экспорт",
        en: "Export",
        uk: "Експорт",
      },
      app_settings_ie_btn_export_subtitle: {
        ru: "Сохранить настройки в файл",
        en: "Save settings to file",
        uk: "Зберегти налаштування у файл",
      },
      app_settings_ie_btn_export_cloud_subtitle: {
        ru: "Сохранить настройки в облако. Ваши данные будут зашифрованы перед отправкой с помощью пин-кода и хранятся 1 час.",
        en: "Save settings to the cloud. Your data will be encrypted before sending using a PIN code and stored for 1 hour.",
        uk: "Зберегти налаштування в хмару. Ваші дані будуть зашифровані перед відправкою за допомогою пін-коду та зберігаються 1 годину.",
      },
      app_settings_ie_btn_import_title: {
        ru: "Импорт",
        en: "Import",
        uk: "Імпорт",
      },
      app_settings_ie_btn_import_subtitle: {
        ru: "Импортировать настройки из файла",
        en: "Import settings from file",
        uk: "Імпортувати налаштування з файлу",
      },
      app_settings_ie_btn_import_cloud_subtitle: {
        ru: "Импортировать настройки из облака",
        en: "Import settings from cloud",
        uk: "Імпортувати налаштування з хмари",
      },
      app_settings_noty_waiting: {
        ru: "Ожидайте...",
        en: "Please wait...",
        uk: "Зачекайте...",
      },
      app_settings_ie_import_success: {
        ru: "Импорт выполнен успешно",
        en: "Import completed successfully",
        uk: "Імпорт виконано успішно",
      },
      app_settings_ie_import_error: {
        ru: "Ошибка импорта",
        en: "Import error",
        uk: "Помилка імпорту",
      },
      app_settings_ie_invalid_pin: {
        ru: "Неверный PIN-код",
        en: "Invalid PIN",
        uk: "Невірний PIN-код",
      },

      // Разделители
      app_settings_separator_main_name: {
        ru: "Основные",
        en: "Main",
        uk: "Основні",
      },
      app_settings_separator_other_name: {
        ru: "Остальные",
        en: "Other",
        uk: "Інші",
      },
      app_settings_ts_separator_main_title: {
        ru: "Управление",
        en: "Management",
        uk: "Керування",
      },
      app_settings_ts_separator_settings_title: {
        ru: "Настройки",
        en: "Settings",
        uk: "Налаштування",
      },
      app_settings_ts_separator_danger_title: {
        ru: "Осторожно!",
        en: "Caution!",
        uk: "Обережно!",
      },

      // Облачный импорт/экспорт
      app_settings_ie_separator_cloud_title: {
        ru: "Облако",
        en: "Cloud",
        uk: "Хмара",
      },
      app_settings_ie_separator_local_title: {
        ru: "Локально",
        en: "Local",
        uk: "Локально",
      },
      app_settings_ie_modal_import_cloud: {
        ru: "Импорт настроек из облака",
        en: "Import settings from cloud",
        uk: "Імпорт налаштувань з хмари",
      },
      app_settings_ie_modal_enter_id: {
        ru: "Введите ID",
        en: "Enter ID",
        uk: "Введіть ID",
      },
      app_settings_ie_modal_enter_pin_title: {
        ru: "Введите PIN-код",
        en: "Enter PIN code",
        uk: "Введіть PIN-код",
      },

      // Плееры
      app_settings_player_find: {
        ru: "Поиск плеера",
        en: "Player search",
        uk: "Пошук плеєра",
      },
      app_settings_player_find_description: {
        ru: "Нажмите, чтобы найти установленный плеер VLC в вашей системе автоматически",
        en: "Click to find the installed VLC player in your system automatically.",
        uk: "Натисніть, щоб автоматично знайти встановлений програвач VLC у вашій системі",
      },

      // О приложении
      app_about_title: {
        ru: "Не официальное приложение-клиент для Lampa.",
        en: "Unofficial client application for Lampa.",
        uk: "Неофіційний додаток-клієнт для Lampa.",
      },
      app_about_version_app: {
        ru: "Версия приложения: {current_version}",
        en: "App version: {current_version}",
        uk: "Версія додатку: {current_version}",
      },
      app_about_version_latest: {
        ru: "Последняя версия: {latest_version}",
        en: "Latest version: {latest_version}",
        uk: "Остання версія: {latest_version}",
      },
      app_about_version_lampa: {
        ru: "Версия Lampa: {lampa_version}",
        en: "Lampa version: {lampa_version}",
        uk: "Версія Lampa: {lampa_version}",
      },
      app_about_github: {
        ru: "GitHub",
        en: "GitHub",
        uk: "GitHub",
      },
      app_about_loading: {
        ru: "Загружаю данные...",
        en: "Loading data...",
        uk: "Завантажую дані...",
      },

      // Горячие клавиши
      hotkey_search: {
        ru: "Поиск",
        en: "Search",
        uk: "Пошук",
      },
      hotkey_fullscreen: {
        ru: "Полноэкранный режим",
        en: "Fullscreen mode",
        uk: "Повноекранний режим",
      },
      hotkey_close: {
        ru: "Закрытие приложения",
        en: "Close application",
        uk: "Закриття додатку",
      },
      hotkey_menu: {
        ru: "Открыть/закрыть меню",
        en: "Open/close menu",
        uk: "Відкрити / закрити меню",
      },

      app_error: {
        ru: "Ошибка",
        en: "Error",
        uk: "Помилка",
      },
    });

    Lampa.SettingsApi.addComponent({
      component: "app_settings",
      name: Lampa.Lang.translate("app_settings"),
      icon: settings_app_icon,
      before: "account",
    });

    Lampa.Template.add(
      "settings_app_settings_ts",
      '<div><div class="settings-param" data-static="true" data-name="app_settings_ts_tsStatus"><div class="settings-param__name">' +
        Lampa.Lang.translate("app_settings_ts_status_name") +
        '</div><div class="settings-param__descr">🔄</div></div>' +
        '<div><div class="settings-param" data-static="true" data-name="app_settings_ts_tsVersion"><div class="settings-param__name">' +
        Lampa.Lang.translate("app_settings_ts_version_name") +
        '</div><div class="settings-param__descr">🔄</div></div>',
    );

    const settingsManager = new SettingsManager("app_settings");

    Lampa.SettingsApi.addParam({
      component: "player",
      param: {
        name: "player_find",
        type: "button",
      },
      field: {
        name: Lampa.Lang.translate("app_settings_player_find"),
        description: Lampa.Lang.translate(
          "app_settings_player_find_description",
        ),
      },
      onChange: async () => {
        Lampa.Loading.start(
          () => {},
          `${Lampa.Lang.translate("app_settings_player_find")}...`,
        );
        const result = await window.electronAPI.findPlayer();
        Lampa.Loading.stop();
        // Lampa.Settings.create("player", {});
        Lampa.Settings.update();
        Lampa.Noty.show(
          result.success
            ? result.message
            : `${Lampa.Lang.translate("app_error")}: ${result.message}`,
        );
      },
      onRender: function (element) {
        setTimeout(function () {
          var anchor = $('div[data-name="player_nw_path"]');
          if (anchor.length) anchor.after(element);
        }, 0);
      },
    });

    Promise.all([
      settingsManager.loadAsyncSetting("fullscreen", {
        order: 3,
        param: {
          name: "app_settings_fullscreen",
          type: "trigger",
        },
        field: {
          name: Lampa.Lang.translate("app_settings_fullscreen_field_name"),
        },
        onChange: async function (value) {
          await window.electronAPI.store.set("fullscreen", value === "true");
        },
      }),

      settingsManager.loadAsyncSetting("autoUpdate", {
        order: 4,
        param: {
          name: "app_settings_autoUpdate",
          type: "trigger",
        },
        field: {
          name: Lampa.Lang.translate("app_settings_autoupdate_field_name"),
        },
        onChange: async function (value) {
          await window.electronAPI.store.set("autoUpdate", value === "true");
        },
      }),

      settingsManager.loadAsyncSetting("lampaUrl", {
        order: 5,
        param: {
          name: "app_settings_lampaUrl",
          type: "input",
          placeholder: Lampa.Lang.translate(
            "app_settings_lampa_url_placeholder",
          ),
          values: "",
        },
        field: {
          name: Lampa.Lang.translate("app_settings_lampa_url_name"),
          description: Lampa.Lang.translate(
            "app_settings_lampa_url_description",
          ),
        },
        onChange: async function (value) {
          if (URL.canParse(value)) {
            // Lampa.Settings.update();
            Lampa.Noty.show(Lampa.Lang.translate("app_settings_lampa_url_ok"));
            setTimeout(
              async () => await window.electronAPI.store.set("lampaUrl", value),
              1000,
            );
          } else {
            Lampa.Noty.show(
              Lampa.Lang.translate("app_settings_lampa_url_error"),
            );
          }
        },
      }),
      settingsManager.loadAsyncSetting("webSecurity", {
        order: 8.5,
        param: {
          name: "app_settings_webSecurity",
          type: "trigger",
        },
        field: {
          name: Lampa.Lang.translate("app_settings_web_security_field_name"),
          description: Lampa.Lang.translate(
            "app_settings_web_security_field_description",
          ),
        },
        onChange: async function (value) {
          await window.electronAPI.store.set("webSecurity", value === "true");
          Lampa.Noty.show(Lampa.Lang.translate("app_settings_web_security_notify"));
        },
      }),
    ]).then(() => {
      settingsManager
        .addToQueue({
          order: 1,
          param: {
            name: "app_settings_about",
            type: "button",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_about_field_name"),
            description: Lampa.Lang.translate(
              "app_settings_about_field_description",
            ),
          },
          onChange: function () {
            Lampa.Loading.start(
              () => {},
              Lampa.Lang.translate("app_about_loading"),
            );
            const network = new Lampa.Reguest();
            network.silent(
              "https://api.github.com/repos/Kolovatoff/lampa-desktop/releases/latest",
              (data) => {
                window.electronAPI
                  .getAppVersion()
                  .then((current_version) => {
                    const latest_version = data.tag_name.replace("v", "");

                    Lampa.Template.add(
                      "about_modal",
                      `<div class="app-modal-about">
                        ` +
                        Lampa.Lang.translate("app_about_title") +
                        `
                        <ul>
                            <li>` +
                        Lampa.Lang.translate("app_about_version_app").replace(
                          "{current_version}",
                          current_version,
                        ) +
                        `</li>
                            <li>` +
                        Lampa.Lang.translate(
                          "app_about_version_latest",
                        ).replace("{latest_version}", latest_version) +
                        `</li>
                            <li>` +
                        Lampa.Lang.translate("app_about_version_lampa").replace(
                          "{lampa_version}",
                          Lampa.Platform.version("app"),
                        ) +
                        `</li>
                        </ul>
                        <div class="simple-button selector github">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                            <span>` +
                        Lampa.Lang.translate("app_about_github") +
                        `</span>
                        </div>
                      </div>`,
                    );

                    let about_html = Lampa.Template.get("about_modal", {});
                    about_html.find(".github").on("hover:enter", function () {
                      window.open(
                        "https://github.com/Kolovatoff/lampa-desktop",
                        "_blank",
                      );
                    });

                    Lampa.Modal.open({
                      title: Lampa.Lang.translate(
                        "app_settings_about_field_name",
                      ),
                      html: about_html,
                      size: "small",
                      onBack: function () {
                        Lampa.Modal.close();
                        Lampa.Controller.toggle("settings_component");
                      },
                    });
                    Lampa.Loading.stop();
                    // И убеждаемся, что фокус на модальном окне
                    Lampa.Controller.toggle("modal");
                  })
                  .catch((error) => {
                    console.error(
                      "APP",
                      "Не удалось получить appVersion",
                      error,
                    );
                  });
              },
              () => {
                Lampa.Loading.stop();
              },
              null,
              {
                cache: { life: 10 },
              },
            );
          },
        })
        .addToQueue({
          order: 2,
          param: {
            name: "app_settings_separator_main",
            type: "title",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_separator_main_name"),
          },
        })
        .addToQueue({
          component: "app_settings_player_find",
          order: 5.5,
          param: {
            name: "player_find",
            type: "button",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_player_find"),
            description: Lampa.Lang.translate(
              "app_settings_player_find_description",
            ),
          },
          onChange: async () => {
            Lampa.Loading.start(
              () => {},
              `${Lampa.Lang.translate("app_settings_player_find")}...`,
            );
            const result = await window.electronAPI.findPlayer();
            Lampa.Loading.stop();
            Lampa.Noty.show(
              result.success
                ? result.message
                : `${Lampa.Lang.translate("app_error")}: ${result.message}`,
            );
          },
        })
        .addToQueue({
          order: 6,
          param: {
            name: "app_settings_separator_main",
            type: "title",
          },
          field: {
            name: "TorrServer",
          },
        })
        .addToQueue({
          order: 7,
          param: {
            name: "app_settings_ts",
            type: "button",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_ts_field_name"),
            description: Lampa.Lang.translate(
              "app_settings_ts_field_description",
            ),
          },
          onChange: () => {
            Lampa.Settings.create("app_settings_ts", {
              onBack: () => Lampa.Settings.create("app_settings"),
            });
          },
        })
        .addToQueue({
          order: 8,
          param: {
            name: "app_settings_separator_other",
            type: "title",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_separator_other_name"),
          },
        })
        .addToQueue({
          order: 9,
          param: {
            name: "app_settings_ie",
            type: "button",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_ie_field_name"),
            description: Lampa.Lang.translate(
              "app_settings_ie_field_description",
            ),
          },
          onChange: () => {
            Lampa.Select.show({
              title: Lampa.Lang.translate("app_settings_ie_field_name"),
              items: [
                {
                  title: Lampa.Lang.translate(
                    "app_settings_ie_separator_cloud_title",
                  ),
                  separator: true,
                },
                {
                  title: Lampa.Lang.translate(
                    "app_settings_ie_btn_export_title",
                  ),
                  subtitle: Lampa.Lang.translate(
                    "app_settings_ie_btn_export_cloud_subtitle",
                  ),
                  action: "e-cloud",
                },
                {
                  title: Lampa.Lang.translate(
                    "app_settings_ie_btn_import_title",
                  ),
                  subtitle: Lampa.Lang.translate(
                    "app_settings_ie_btn_import_cloud_subtitle",
                  ),
                  action: "i-cloud",
                },
                {
                  title: Lampa.Lang.translate(
                    "app_settings_ie_separator_local_title",
                  ),
                  separator: true,
                },
                {
                  title: Lampa.Lang.translate(
                    "app_settings_ie_btn_export_title",
                  ),
                  subtitle: Lampa.Lang.translate(
                    "app_settings_ie_btn_export_subtitle",
                  ),
                  action: "e-file",
                },
                {
                  title: Lampa.Lang.translate(
                    "app_settings_ie_btn_import_title",
                  ),
                  subtitle: Lampa.Lang.translate(
                    "app_settings_ie_btn_import_subtitle",
                  ),
                  action: "i-file",
                },
              ],
              onSelect: async (a) => {
                Lampa.Noty.show(
                  Lampa.Lang.translate("app_settings_noty_waiting"),
                );
                try {
                  let result;

                  if (a.action === "e-cloud") {
                    result = await window.electronAPI.exportSettingsToCloud();
                    if (result && result.message) {
                      Lampa.Noty.show(result.message);
                    }
                  } else if (a.action === "i-cloud") {
                    // Функция для показа модального окна ввода 10-значного кода
                    async function showTenDigitModal() {
                      return new Promise((resolve) => {
                        let html = $(
                          `
                      <div class="account-modal-split">
                        <div class="account-modal-split__info">
                          <div class="account-modal-split__title">` +
                            Lampa.Lang.translate(
                              "app_settings_ie_modal_import_cloud",
                            ) +
                            `</div>
                          <div class="account-modal-split__text">` +
                            Lampa.Lang.translate(
                              "app_settings_ie_modal_enter_id",
                            ) +
                            `</div>
                          <div class="account-modal-split__code">
                            ${Array(10).fill('<div class="account-modal-split__code-num"><span>-</span></div>').join("")}
                          </div>
                          <div class="account-modal-split__keyboard">
                            <div class="simple-keyboard"></div>
                          </div>
                        </div>
                      </div>`,
                        );

                        let nums = html.find(".account-modal-split__code-num");
                        let keyboard;

                        if (Lampa.Platform.tv()) {
                          html.addClass(
                            "layer--" +
                              (Lampa.Platform.mouse() ? "wheight" : "height"),
                          );
                        } else {
                          html.addClass("account-modal-split--mobile");
                        }

                        function drawCode(value) {
                          nums.find("span").text("-");
                          value.split("").forEach((v, i) => {
                            if (nums[i]) nums.eq(i).find("span").text(v);
                          });
                        }

                        Lampa.Modal.open({
                          title: "",
                          html: html,
                          size: Lampa.Platform.tv() ? "full" : "medium",
                          scroll: { nopadding: true },
                          onBack: () => {
                            if (
                              keyboard &&
                              typeof keyboard.destroy === "function"
                            ) {
                              keyboard.destroy();
                              keyboard = null;
                            }
                            Lampa.Modal.close();
                            Lampa.Controller.toggle("settings_component");
                            resolve(null);
                          },
                        });

                        keyboard = new window.SimpleKeyboard.default({
                          display: {
                            "{BKSP}": "&nbsp;",
                            "{ENTER}": "&nbsp;",
                          },
                          layout: {
                            default: ["0 1 2 3 4 {BKSP}", "5 6 7 8 9 {ENTER}"],
                          },
                          onChange: async (value) => {
                            drawCode(value);
                            if (value.length === 10) {
                              if (
                                keyboard &&
                                typeof keyboard.destroy === "function"
                              ) {
                                keyboard.destroy();
                                keyboard = null;
                              }
                              Lampa.Modal.close();
                              // Открываем второй модал для PIN и получаем результат
                              const pinResult = await showPinModal(value);
                              resolve(pinResult);
                            }
                          },
                          onKeyPress: async (button) => {
                            if (button === "{BKSP}") {
                              keyboard.setInput(
                                keyboard.getInput().slice(0, -1),
                              );
                              drawCode(keyboard.getInput());
                            } else if (button === "{ENTER}") {
                              if (keyboard.getInput().length === 10) {
                                if (
                                  keyboard &&
                                  typeof keyboard.destroy === "function"
                                ) {
                                  keyboard.destroy();
                                  keyboard = null;
                                }
                                Lampa.Modal.close();
                                const pinResult = await showPinModal(
                                  keyboard.getInput(),
                                );
                                resolve(pinResult);
                              }
                            }
                          },
                        });

                        let keys = $(".simple-keyboard .hg-button").addClass(
                          "selector",
                        );
                        Lampa.Controller.collectionSet($(".simple-keyboard"));
                        Lampa.Controller.collectionFocus(
                          keys[0],
                          $(".simple-keyboard"),
                        );
                        $(".simple-keyboard .hg-button").on(
                          "hover:enter",
                          function (e) {
                            Lampa.Controller.collectionFocus($(this)[0]);
                            keyboard.handleButtonClicked(
                              $(this).attr("data-skbtn"),
                              e,
                            );
                          },
                        );
                      });
                    }

                    // Функция для показа модального окна ввода PIN-кода
                    async function showPinModal(code10) {
                      return new Promise((resolve) => {
                        Lampa.Input.edit(
                          {
                            free: true,
                            title: Lampa.Lang.translate(
                              "app_settings_ie_modal_enter_pin_title",
                            ),
                            nosave: true,
                            value: "",
                            layout: "nums",
                            keyboard: "lampa",
                            password: false,
                          },
                          async (pin4) => {
                            if (pin4 && pin4.length === 4) {
                              try {
                                const importResult =
                                  await window.electronAPI.importSettingsFromCloud(
                                    code10,
                                    pin4,
                                  );
                                resolve(importResult);
                              } catch (error) {
                                resolve({
                                  message:
                                    Lampa.Lang.translate(
                                      "app_settings_ie_import_error",
                                    ) +
                                    ": " +
                                    error.toString(),
                                });
                              }
                            } else {
                              resolve({
                                message: Lampa.Lang.translate(
                                  "app_settings_ie_invalid_pin",
                                ),
                              });
                            }
                            Lampa.Controller.toggle("menu");
                          },
                        );
                      });
                    }

                    // Запускаем процесс импорта из облака
                    result = await showTenDigitModal();
                    if (result && result.message) {
                      Lampa.Noty.show(result.message);
                    } else if (result === null) {
                      // Пользователь закрыл модальное окно
                    } else {
                      Lampa.Noty.show(
                        Lampa.Lang.translate("app_settings_ie_import_success"),
                      );
                    }
                  } else if (a.action === "e-file") {
                    result = await window.electronAPI.exportSettingsToFile();
                    if (result && result.message) {
                      Lampa.Noty.show(result.message);
                    }
                  } else if (a.action === "i-file") {
                    result = await window.electronAPI.importSettingsFromFile();
                    if (result && result.message) {
                      Lampa.Noty.show(result.message);
                    }
                  }
                } catch (error) {
                  Lampa.Noty.show(error.toString());
                }
              },
              onBack: () => {
                Lampa.Controller.toggle("settings_component");
              },
            });
          },
        })
        .apply();
    });

    const settingsTsManager = new SettingsManager("app_settings_ts");

    Promise.all([
      settingsTsManager.loadAsyncSetting("tsAutoStart", {
        order: 6,
        param: {
          name: "app_settings_ts_tsAutostart",
          type: "trigger",
        },
        field: {
          name: Lampa.Lang.translate("app_settings_ts_autostart_field_name"),
        },
        onChange: async function (value) {
          // Lampa.Settings.update();
          await window.electronAPI.store.set("tsAutoStart", value === "true");
        },
      }),
      settingsTsManager.loadAsyncSetting("tsPort", {
        order: 8,
        param: {
          name: "app_settings_ts_tsPort",
          type: "input",
          values: "",
        },
        field: {
          name: Lampa.Lang.translate("app_settings_ts_port_name"),
          description: Lampa.Lang.translate("app_settings_ts_port_description"),
        },
        onChange: async function (value) {
          // Lampa.Settings.update();
          Lampa.Noty.show(Lampa.Lang.translate("app_settings_ts_port_ok"));
          setTimeout(
            async () => await window.electronAPI.store.set("tsPort", value),
            1000,
          );
        },
      }),
    ]).then(() => {
      settingsTsManager
        .addToQueue({
          order: 1,
          param: {
            name: "app_settings_ts_separator_main",
            type: "title",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_ts_separator_main_title"),
          },
        })
        .addToQueue({
          component: "app_settings_ts",
          order: 2,
          param: {
            name: "ts_start",
            type: "button",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_ts_start_name"),
          },
          onChange: async () => {
            const status = await window.electronAPI.torrServer.getStatus();
            if (status.installed) {
              Lampa.Loading.start(
                () => {},
                Lampa.Lang.translate("app_settings_ts_start_loading"),
              );
            } else {
              Lampa.Loading.start(
                () => {},
                Lampa.Lang.translate("app_settings_ts_download_loading"),
              );
            }

            const tsPort = await window.electronAPI.store.get("tsPort");
            const result = await window.electronAPI.torrServer.start([
              "--port",
              tsPort,
            ]);
            Lampa.Storage.set("torrserver_url", `http://localhost:${tsPort}`);
            Lampa.Storage.set("torrserver_use_link", "one");

            updateTsStatus();

            Lampa.Loading.stop();
            Lampa.Noty.show(
              result.success
                ? result.message
                : `${Lampa.Lang.translate("app_error")}: ${result.message}`,
            );
          },
        })
        .addToQueue({
          component: "app_settings_ts",
          order: 3,
          param: {
            name: "ts_stop",
            type: "button",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_ts_stop_name"),
          },
          onChange: async () => {
            Lampa.Loading.start(
              () => {},
              Lampa.Lang.translate("app_settings_ts_stop_loading"),
            );
            const result = await window.electronAPI.torrServer.stop();
            Lampa.Loading.stop();
            updateTsStatus();
            Lampa.Noty.show(
              result.success
                ? result.message
                : `${Lampa.Lang.translate("app_error")}: ${result.message}`,
            );
          },
        })
        .addToQueue({
          component: "app_settings_ts",
          order: 4,
          param: {
            name: "ts_restart",
            type: "button",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_ts_restart_name"),
          },
          onChange: async () => {
            Lampa.Loading.start(
              () => {},
              Lampa.Lang.translate("app_settings_ts_restart_loading"),
            );

            const tsPort = await window.electronAPI.store.get("tsPort");
            const result = await window.electronAPI.torrServer.restart([
              "--port",
              tsPort,
            ]);
            Lampa.Storage.set("torrserver_url", `http://localhost:${tsPort}`);
            Lampa.Storage.set("torrserver_use_link", "one");

            updateTsStatus();
            Lampa.Loading.stop();
            Lampa.Noty.show(
              result.success
                ? result.message
                : `${Lampa.Lang.translate("app_error")}: ${result.message}`,
            );
          },
        })
        .addToQueue({
          component: "app_settings_ts",
          order: 4.1,
          param: {
            name: "ts_check_update",
            type: "button",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_ts_check_update_name"),
          },
          onChange: async () => {
            Lampa.Loading.start(
              () => {},
              Lampa.Lang.translate("app_settings_ts_check_update_loading"),
            );
            const result = await window.electronAPI.torrServer.checkUpdate();
            // Создаем модальное окно если есть обновление
            if (result.hasUpdate) {
              Lampa.Template.add(
                "ts_update_modal",
                `<div class="app-modal-ts-update">
                        ` +
                  Lampa.Lang.translate("app_settings_ts_update_found_message") +
                  `
                        <ul>
                            <li>` +
                  Lampa.Lang.translate(
                    "app_settings_ts_update_installed",
                  ).replace("{current_version}", result.current) +
                  `</li>
                            <li>` +
                  Lampa.Lang.translate("app_settings_ts_update_latest").replace(
                    "{latest_version}",
                    result.latest,
                  ) +
                  `</li>
                        </ul>
                        <div class="simple-button selector ts_update">` +
                  Lampa.Lang.translate("app_settings_ts_update_button") +
                  `</div>
                      </div>`,
              );

              let ts_update_modal_html = Lampa.Template.get(
                "ts_update_modal",
                {},
              );
              ts_update_modal_html
                .find(".ts_update")
                .on("hover:enter", async function () {
                  Lampa.Loading.start(
                    () => {},
                    Lampa.Lang.translate("app_settings_ts_update_loading"),
                  );
                  const result = await window.electronAPI.torrServer.update();
                  Lampa.Loading.stop();
                  Lampa.Modal.close();
                  Lampa.Controller.toggle("settings_component");
                  updateTsStatus();
                  Lampa.Noty.show(
                    result.success
                      ? Lampa.Lang.translate("app_settings_ts_update_success")
                      : `${Lampa.Lang.translate("app_error")}: ${result.message}`,
                  );
                });

              Lampa.Modal.open({
                title: Lampa.Lang.translate(
                  "app_settings_ts_update_found_title",
                ),
                html: ts_update_modal_html,
                size: "small",
                onBack: function () {
                  Lampa.Modal.close();
                  Lampa.Controller.toggle("settings_component");
                },
              });
              Lampa.Loading.stop();
              // И убеждаемся, что фокус на модальном окне
              Lampa.Controller.toggle("modal");
            } else {
              Lampa.Noty.show(
                Lampa.Lang.translate("app_settings_ts_update_no_updates"),
              );
              Lampa.Loading.stop();
            }
          },
        })
        .addToQueue({
          component: "app_settings_ts",
          order: 4.2,
          param: {
            name: "ts_open_path",
            type: "button",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_ts_open_path_name"),
          },
          onChange: async () => {
            const status = await window.electronAPI.torrServer.getStatus();

            if (status.installed) {
              await window.electronAPI.folder.open(status.executableDir);
            } else {
              Lampa.Noty.show(
                Lampa.Lang.translate("app_settings_ts_install_prompt"),
              );
            }
          },
        })
        .addToQueue({
          component: "app_settings_ts",
          order: 4.3,
          param: {
            name: "ts_open_web",
            type: "button",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_ts_open_web_name"),
          },
          onChange: async () => {
            const status = await window.electronAPI.torrServer.getStatus();

            if (status.installed) {
              window.open(`http://${status.host}:${status.port}`, "_blank");
            } else {
              Lampa.Noty.show(
                Lampa.Lang.translate("app_settings_ts_install_prompt"),
              );
            }
          },
        })
        .addToQueue({
          order: 5,
          param: {
            name: "app_settings_ts_separator_settings",
            type: "title",
          },
          field: {
            name: Lampa.Lang.translate(
              "app_settings_ts_separator_settings_title",
            ),
          },
        })
        .addToQueue({
          order: 9,
          param: {
            name: "app_settings_ts_separator_danger",
            type: "title",
          },
          field: {
            name: Lampa.Lang.translate(
              "app_settings_ts_separator_danger_title",
            ),
          },
        })
        .addToQueue({
          component: "app_settings_ts",
          order: 10,
          param: {
            name: "ts_uninstall",
            type: "button",
          },
          field: {
            name: Lampa.Lang.translate("app_settings_ts_uninstall_name"),
          },
          onChange: async () => {
            Lampa.Noty.show(
              Lampa.Lang.translate("app_settings_ts_uninstall_loading"),
            );
            const result = await window.electronAPI.torrServer.uninstall();
            updateTsStatus();
            Lampa.Noty.show(
              result.success
                ? result.message
                : `${Lampa.Lang.translate("app_error")}: ${result.message}`,
            );
          },
        })
        .addToQueue({
          component: "app_settings_ts",
          order: 11,
          param: {
            name: "ts_uninstall_keep_data",
            type: "button",
          },
          field: {
            name: Lampa.Lang.translate(
              "app_settings_ts_uninstall_keep_data_name",
            ),
          },
          onChange: async () => {
            Lampa.Noty.show(
              Lampa.Lang.translate(
                "app_settings_ts_uninstall_keep_data_loading",
              ),
            );
            const result = await window.electronAPI.torrServer.uninstall(true);
            updateTsStatus();
            Lampa.Noty.show(
              result.success
                ? result.message
                : `${Lampa.Lang.translate("app_error")}: ${result.message}`,
            );
          },
        })
        .apply();
    });

    function updateTsStatus() {
      window.electronAPI.torrServer.getStatus().then((status) => {
        $('[data-name="app_settings_ts_tsVersion"]')
          .find(".settings-param__descr")
          .text(
            status.version !== null
              ? status.version
              : Lampa.Lang.translate("app_settings_ts_status_install_prompt"),
          );
        $('[data-name="app_settings_ts_tsStatus"]')
          .find(".settings-param__descr")
          .text(
            status.installed
              ? status.running
                ? Lampa.Lang.translate(
                    "app_settings_ts_status_installed_running",
                  )
                : Lampa.Lang.translate(
                    "app_settings_ts_status_installed_stopped",
                  )
              : Lampa.Lang.translate("app_settings_ts_status_not_installed"),
          );
      });
    }
    Lampa.Settings.listener.follow("open", function (e) {
      if (e.name === "app_settings_ts") {
        updateTsStatus();
      }
    });
  }

  /**
   * Класс для управления курсором и горячими клавишами
   */
  class InputManager {
    constructor(options = {}) {
      this.cursorVisible = true;
      this.mouseMoveTimer = null;
      this.debug = options.debug || false;

      this.keyHandlers = new Map();

      this.modifiers = {
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
      };

      this.cursorSettings = {
        hideOnKeyPress: options.hideOnKeyPress ?? true,
        showOnMouseMove: options.showOnMouseMove ?? true,
        hideCursorStyle: options.hideCursorStyle || "none",
        showCursorStyle: options.showCursorStyle || "default",
        mouseInactivityTimeout: options.mouseInactivityTimeout || 0,
      };

      this.ignoredSelectors = [
        "input",
        "textarea",
        '[contenteditable="true"]',
        "select",
        // "button",
        // "a",
      ];

      this.init();
    }

    init() {
      if (this.cursorSettings.hideOnKeyPress) {
        document.addEventListener("keydown", this.handleKeyDown.bind(this));
      }

      if (this.cursorSettings.showOnMouseMove) {
        document.addEventListener("mousemove", this.handleMouseMove.bind(this));
        document.addEventListener(
          "mousedown",
          this.handleMouseAction.bind(this),
        );
        document.addEventListener("mouseup", this.handleMouseAction.bind(this));
        document.addEventListener("wheel", this.handleMouseAction.bind(this));
      }

      document.addEventListener("keyup", this.handleKeyUp.bind(this));
      window.addEventListener("blur", this.handleWindowBlur.bind(this));

      this.log("InputManager инициализирован");
    }

    hideCursor() {
      if (!this.cursorSettings.hideOnKeyPress) return;

      if (this.cursorVisible) {
        document.body.style.cursor = this.cursorSettings.hideCursorStyle;
        this.cursorVisible = false;

        const style = document.createElement("style");
        style.id = "input-manager-cursor-style";
        style.textContent = `* { cursor: ${this.cursorSettings.hideCursorStyle} !important; }`;

        const oldStyle = document.getElementById("input-manager-cursor-style");
        if (oldStyle) oldStyle.remove();

        document.head.appendChild(style);
        this.log("Курсор скрыт");
      }
    }

    showCursor() {
      if (this.cursorVisible) return;

      document.body.style.cursor = this.cursorSettings.showCursorStyle;
      this.cursorVisible = true;

      const style = document.getElementById("input-manager-cursor-style");
      if (style) style.remove();

      this.log("Курсор показан");
    }

    toggleCursor() {
      if (this.cursorVisible) {
        this.hideCursor();
      } else {
        this.showCursor();
      }
    }

    updateCursorSettings(settings) {
      Object.assign(this.cursorSettings, settings);
      this.log("Настройки курсора обновлены");
    }

    /**
     * Проверяет, находится ли фокус в игнорируемом элементе
     */
    isIgnoredElement(element = document.activeElement) {
      if (!element) return false;

      for (const selector of this.ignoredSelectors) {
        if (element.matches && element.matches(selector)) {
          return true;
        }
      }

      // Проверяем, является ли элемент формой или частью формы
      return element.form !== undefined;
    }

    /**
     * Добавить селектор для игнорирования
     */
    addIgnoredSelector(selector) {
      if (!this.ignoredSelectors.includes(selector)) {
        this.ignoredSelectors.push(selector);
        this.log(`Добавлен игнорируемый селектор: ${selector}`);
      }
      return this;
    }

    /**
     * Удалить селектор из игнорируемых
     */
    removeIgnoredSelector(selector) {
      const index = this.ignoredSelectors.indexOf(selector);
      if (index !== -1) {
        this.ignoredSelectors.splice(index, 1);
        this.log(`Удален игнорируемый селектор: ${selector}`);
      }
      return this;
    }

    /**
     * Установить список игнорируемых селекторов
     */
    setIgnoredSelectors(selectors) {
      this.ignoredSelectors = [...selectors];
      this.log("Список игнорируемых селекторов обновлен");
      return this;
    }

    /**
     * Подписаться на нажатие клавиши
     * @param {string|string[]} key - клавиша или массив клавиш
     * @param {Function} handler - обработчик
     * @param {Object} options - опции
     * @param {boolean} options.ignoreIfInput - игнорировать если фокус в поле ввода (по умолчанию true)
     * @param {boolean} options.ignoreIfModal - игнорировать если открыто модальное окно
     * @param {Function} options.condition - дополнительное условие для выполнения
     */
    on(key, handler, options = {}) {
      if (Array.isArray(key)) {
        key.forEach((k) => this.on(k, handler, options));
        return this;
      }

      const keyId = key.toLowerCase();

      if (!this.keyHandlers.has(keyId)) {
        this.keyHandlers.set(keyId, []);
      }

      this.keyHandlers.get(keyId).push({
        handler,
        requireCtrl: options.ctrl || false,
        requireAlt: options.alt || false,
        requireShift: options.shift || false,
        requireMeta: options.meta || false,
        preventDefault: options.preventDefault || false,
        description: options.description || "",
        once: options.once || false,
        ignoreIfInput: options.ignoreIfInput !== false,
        ignoreIfModal: options.ignoreIfModal || false,
        condition: options.condition || null,
        ignoreSelectors: options.ignoreSelectors || [], // дополнительные селекторы для этого обработчика
      });

      this.log(`Добавлен обработчик для клавиши: ${keyId}`, options);
      return this;
    }

    /**
     * Подписаться на одноразовое нажатие
     */
    once(key, handler, options = {}) {
      return this.on(key, handler, { ...options, once: true });
    }

    /**
     * Отписаться от клавиши
     */
    off(key, handler) {
      const keyId = key.toLowerCase();

      if (this.keyHandlers.has(keyId)) {
        if (handler) {
          const handlers = this.keyHandlers.get(keyId);
          const index = handlers.findIndex((h) => h.handler === handler);
          if (index !== -1) {
            handlers.splice(index, 1);
            this.log(`Удален обработчик для клавиши: ${keyId}`);
          }
        } else {
          this.keyHandlers.delete(keyId);
          this.log(`Удалены все обработчики для клавиши: ${keyId}`);
        }
      }
      return this;
    }

    /**
     * Очистить все обработчики
     */
    clearAllHandlers() {
      this.keyHandlers.clear();
      this.log("Все обработчики удалены");
    }

    /**
     * Получить список всех зарегистрированных горячих клавиш
     */
    getRegisteredKeys() {
      const keys = [];
      for (const [keyId, handlers] of this.keyHandlers) {
        handlers.forEach((h) => {
          keys.push({
            key: keyId,
            modifiers: {
              ctrl: h.requireCtrl,
              alt: h.requireAlt,
              shift: h.requireShift,
              meta: h.requireMeta,
            },
            description: h.description,
            ignoreIfInput: h.ignoreIfInput,
            ignoreIfModal: h.ignoreIfModal,
          });
        });
      }
      return keys;
    }

    /**
     * Показать справку по горячим клавишам
     */
    showHelp() {
      // TODO(Kolovatoff): добавить открытие modal
      console.log("=== Зарегистрированные горячие клавиши ===");
      const keys = this.getRegisteredKeys();
      if (keys.length === 0) {
        console.log("Нет зарегистрированных клавиш");
      } else {
        keys.forEach((k) => {
          const modifiers = [];
          if (k.modifiers.ctrl) modifiers.push("Ctrl");
          if (k.modifiers.alt) modifiers.push("Alt");
          if (k.modifiers.shift) modifiers.push("Shift");
          if (k.modifiers.meta) modifiers.push("Meta");

          const modifierStr =
            modifiers.length > 0 ? modifiers.join("+") + "+" : "";
          const flags = [];
          if (k.ignoreIfInput) flags.push("🚫 input");
          console.log(
            `  ${modifierStr}${k.key.toUpperCase()} - ${k.description || "нет описания"} ${flags.length ? `(${flags.join(", ")})` : ""}`,
          );
        });
      }
    }

    /**
     * Проверяет, можно ли выполнить обработчик
     */
    canExecuteHandler(item, event) {
      // Проверка на фокус в поле ввода
      if (item.ignoreIfInput) {
        const activeElement = document.activeElement;
        if (this.isIgnoredElement(activeElement)) {
          this.log(`Игнорируем: фокус в поле ввода (${activeElement.tagName})`);

          // Дополнительно проверяем игнорируемые селекторы для этого обработчика
          if (item.ignoreSelectors && item.ignoreSelectors.length > 0) {
            for (const selector of item.ignoreSelectors) {
              if (activeElement.matches && activeElement.matches(selector)) {
                return false;
              }
            }
          }

          return false;
        }
      }

      if (item.ignoreIfModal) {
        const modal = document.querySelector(
          '.modal[style*="display: block"], .modal.show, [role="dialog"][aria-hidden="false"]',
        );
        if (modal) {
          this.log("Игнорируем: открыто модальное окно");
          return false;
        }
      }

      if (item.condition && typeof item.condition === "function") {
        if (!item.condition(event)) {
          this.log("Игнорируем: не выполнено пользовательское условие");
          return false;
        }
      }

      return true;
    }

    handleKeyDown(event) {
      const code = event.code.toLowerCase();
      const key = event.key.toLowerCase();

      const ctrl = event.ctrlKey;
      const alt = event.altKey;
      const shift = event.shiftKey;
      const meta = event.metaKey;

      this.modifiers = { ctrl, alt, shift, meta };

      this.hideCursor();

      if (this.cursorSettings.mouseInactivityTimeout > 0) {
        clearTimeout(this.mouseMoveTimer);
      }

      let handlerExecuted = false;

      // Проверяем обработчики по CODE
      if (this.keyHandlers.has(code)) {
        handlerExecuted =
          this.executeHandlers(code, event, ctrl, alt, shift, meta) ||
          handlerExecuted;
      }

      // Проверяем обработчики по KEY
      if (this.keyHandlers.has(key) && code !== key) {
        handlerExecuted =
          this.executeHandlers(key, event, ctrl, alt, shift, meta) ||
          handlerExecuted;
      }

      this.log(
        `Нажата: code=${code}, key=${key}, выполнен=${handlerExecuted}, activeElement=${document.activeElement?.tagName}`,
      );
    }

    /**
     * Выполнить обработчики для указанного идентификатора клавиши
     */
    executeHandlers(keyId, event, ctrl, alt, shift, meta) {
      if (!this.keyHandlers.has(keyId)) return false;

      const handlers = this.keyHandlers.get(keyId);
      let executed = false;

      for (let i = 0; i < handlers.length; i++) {
        const item = handlers[i];

        if (
          item.requireCtrl === ctrl &&
          item.requireAlt === alt &&
          item.requireShift === shift &&
          item.requireMeta === meta
        ) {
          if (!this.canExecuteHandler(item, event)) {
            continue;
          }

          this.log(`Выполняется действие для: ${keyId}`, {
            modifiers: this.modifiers,
            ignoreIfInput: item.ignoreIfInput,
          });

          if (item.preventDefault) {
            event.preventDefault();
          }

          // Вызываем обработчик с расширенной информацией
          item.handler(event, {
            ...this.modifiers,
            code: event.code.toLowerCase(),
            key: event.key.toLowerCase(),
            activeElement: document.activeElement,
            isInInput: this.isIgnoredElement(document.activeElement),
          });

          executed = true;

          // Если одноразовый - удаляем
          if (item.once) {
            handlers.splice(i, 1);
            i--;
          }
        }
      }

      return executed;
    }

    handleKeyUp(event) {
      this.modifiers = {
        ctrl: event.ctrlKey,
        alt: event.altKey,
        shift: event.shiftKey,
        meta: event.metaKey,
      };
    }

    handleMouseMove() {
      this.showCursor();

      if (this.cursorSettings.mouseInactivityTimeout > 0) {
        clearTimeout(this.mouseMoveTimer);
        this.mouseMoveTimer = setTimeout(() => {
          this.hideCursor();
        }, this.cursorSettings.mouseInactivityTimeout);
      }
    }

    handleMouseAction() {
      this.showCursor();
    }

    handleWindowBlur() {
      this.showCursor();
      this.modifiers = { ctrl: false, alt: false, shift: false, meta: false };
    }

    log(message, data = null) {
      if (this.debug) {
        if (data) {
          console.log(`[InputManager] ${message}`, data);
        } else {
          console.log(`[InputManager] ${message}`);
        }
      }
    }

    /**
     * Очистка ресурсов
     */
    destroy() {
      document.removeEventListener("keydown", this.handleKeyDown);
      document.removeEventListener("keyup", this.handleKeyUp);
      document.removeEventListener("mousemove", this.handleMouseMove);
      document.removeEventListener("mousedown", this.handleMouseAction);
      document.removeEventListener("mouseup", this.handleMouseAction);
      document.removeEventListener("wheel", this.handleMouseAction);
      window.removeEventListener("blur", this.handleWindowBlur);

      clearTimeout(this.mouseMoveTimer);
      this.showCursor();
      this.keyHandlers.clear();

      this.log("InputManager уничтожен");
    }
  }

  function initInputManager() {
    const input = new InputManager({
      hideOnKeyPress: true,
      showOnMouseMove: true,
    });

    input
      .on(
        "keys",
        () => {
          Lampa.Search.open();
        },
        {
          description: Lampa.Lang.translate("hotkey_search"),
          condition: () => {
            return !document.body.classList.contains("search--open");
          },
        },
      )
      .on(
        "keyf",
        () => {
          Lampa.Utils.toggleFullscreen();
        },
        {
          description: Lampa.Lang.translate("hotkey_fullscreen"),
        },
      )
      .on(
        "f4",
        () => {
          window.electronAPI.closeApp();
        },
        {
          description: Lampa.Lang.translate("hotkey_close"),
          alt: true,
          ignoreIfInput: false,
        },
      )
      // открытие/закрытие меню
      .on(
        "keym",
        () => {
          Lampa.Menu.toggle();
        },
        {
          description: Lampa.Lang.translate("hotkey_menu"),
        },
      );
  }

  function removeMic() {
    function ensureInputFocus() {
      document
        .querySelectorAll(
          '.hg-button[data-skbtn="{MIC}"], .simple-keyboard-mic',
        )
        .forEach((el) => el.remove());
      const input = document.querySelector(".simple-keyboard-input");
      if (input && input !== document.activeElement) {
        input.focus();
      }
    }

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === 1 &&
            (node.matches(".simple-keyboard") ||
              node.querySelector(".simple-keyboard"))
          ) {
            setTimeout(ensureInputFocus, 0);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    ensureInputFocus();
  }

  function overwriteToggleFullscreen() {
    Lampa.Utils.toggleFullscreen = function () {
      window.electronAPI.toggleFullscreen();
    };
  }

  function init() {
    overwriteToggleFullscreen(); // Переопределение функции Utils.toggleFullscreen
    addQuitButton(); // Кнопка выхода в шапке
    addAppSettings(); // Настройки приложения внутри лампы
    initInputManager();
    removeMic();
  }

  if (!window.plugin_app_ready) {
    window.plugin_app_ready = true;
    if (window.appready) {
      init();
    } else {
      Lampa.Listener.follow("app", function (e) {
        if (e.type === "ready") init();
      });
    }
  }
})();
