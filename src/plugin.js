(function () {
  "use strict";

  var icon_quit =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 4h3a2 2 0 0 1 2 2v1m-5 13h3a2 2 0 0 0 2-2v-1M4.425 19.428l6 1.8A2 2 0 0 0 13 19.312V4.688a2 2 0 0 0-2.575-1.916l-6 1.8A2 2 0 0 0 3 6.488v11.024a2 2 0 0 0 1.425 1.916M16.001 12h5m0 0l-2-2m2 2l-2 2"/></svg>';

  function addQuitButton() {
    const container = Lampa.Head.render().find(".head__actions");

    // Удаляем ламповскую кнопку полноэкранного режима
    const targetElement = container.find(".head__action.selector.full--screen");
    if (targetElement.length) {
      targetElement.remove();
    }

    // Добавляем свою кнопку полноэкранного режима нативную для Electron
    const iconFullscreen = $(
      `<div class="head__action selector"><svg><use xlink:href="#sprite-fullscreen"></use></svg></div>`,
    );
    container.append(iconFullscreen);
    iconFullscreen.on("hover:enter", () => {
      window.electronAPI.toogleFullscreen();
    });

    // Добавляем кнопку выхода
    const icon = $(`<div class="head__action selector">${icon_quit}</div>`);
    container.append(icon);
    icon.on("hover:enter", () => {
      window.electronAPI.closeApp();
    });
  }

  var settings_app_icon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M7.5 13.75v.5q0 .325.213.538T8.25 15t.538-.213T9 14.25v-2.5q0-.325-.213-.537T8.25 11t-.537.213t-.213.537v.5h-.75q-.325 0-.537.213T6 13t.213.538t.537.212zm3.25 0h6.5q.325 0 .538-.213T18 13t-.213-.537t-.537-.213h-6.5q-.325 0-.537.213T10 13t.213.538t.537.212m5.75-4h.75q.325 0 .538-.213T18 9t-.213-.537t-.537-.213h-.75v-.5q0-.325-.213-.537T15.75 7t-.537.213T15 7.75v2.5q0 .325.213.538t.537.212t.538-.213t.212-.537zm-9.75 0h6.5q.325 0 .538-.213T14 9t-.213-.537t-.537-.213h-6.5q-.325 0-.537.213T6 9t.213.538t.537.212M4 19q-.825 0-1.412-.587T2 17V5q0-.825.588-1.412T4 3h16q.825 0 1.413.588T22 5v12q0 .825-.587 1.413T20 19h-4v1q0 .425-.288.713T15 21H9q-.425 0-.712-.288T8 20v-1zm0-2h16V5H4zm0 0V5z"/></svg>';

  function addAppSettings() {
    Lampa.Lang.add({
      app_settings: {
        ru: "Настройки приложения",
        en: "App settings",
      },
      app_settings_fullscreen_field_name: {
        ru: "Запускать в полноэкранном режиме",
        en: "Launch in fullscreen mode",
      },
      app_settings_lampa_url_placeholder: {
        ru: "Введите url лампы, начиная с http...",
        en: "Enter lamp URL starting with http...",
      },
      app_settings_lampa_url_name: {
        ru: "URL лампы",
        en: "Lamp URL",
      },
      app_settings_lampa_url_description: {
        ru: "По-умолчанию: http://lampa.mx и не рекомендуем его менять",
        en: "Default: http://lampa.mx and we don't recommend changing it",
      },
      app_settings_lampa_url_ok: {
        ru: "Сохранено, ожидайте перехода...",
        en: "Saved, waiting for redirect...",
      },
      app_settings_about_field_name: {
        ru: "О приложении",
        en: "About the app",
      },
      app_settings_about_field_description: {
        ru: "Узнать версию и др. информацию о приложении",
        en: "Check version and other app information",
      },
    });

    Lampa.SettingsApi.addComponent({
      component: "app_settings",
      name: Lampa.Lang.translate("app_settings"),
      icon: settings_app_icon,
      before: "account",
    });

    // Полноэкранный режим
    window.electronAPI
      .getStoreValue("fullscreen")
      .then((fullscreen) => {
        localStorage.setItem("app_settings_fullscreen", fullscreen);
        Lampa.SettingsApi.addParam({
          component: "app_settings",
          param: {
            name: "app_settings_fullscreen",
            type: "trigger",
            default: fullscreen,
          },
          field: {
            name: Lampa.Lang.translate("app_settings_fullscreen_field_name"),
          },
          onChange: async function (value) {
            await window.electronAPI.setStoreValue(
              "fullscreen",
              value === "true",
            );
          },
        });
      })
      .catch((error) => {
        console.error("APP", "Не удалось получить значение fullscreen:", error);
      });

    // URL Лампы
    window.electronAPI
      .getStoreValue("lampaUrl")
      .then((lampaUrl) => {
        localStorage.setItem("app_settings_lampa_url", lampaUrl);
        Lampa.SettingsApi.addParam({
          component: "app_settings",
          param: {
            name: "app_settings_lampa_url",
            type: "input",
            placeholder: Lampa.Lang.translate(
              "app_settings_lampa_url_placeholder",
            ),
            values: "",
            default: lampaUrl,
          },
          field: {
            name: Lampa.Lang.translate("app_settings_lampa_url_name"),
            description: Lampa.Lang.translate(
              "app_settings_lampa_url_description",
            ),
          },
          onChange: async function (value) {
            if (URL.canParse(value)) {
              Lampa.Settings.update();
              Lampa.Noty.show(
                Lampa.Lang.translate("app_settings_lampa_url_ok"),
              );
              setTimeout(
                async () =>
                  await window.electronAPI.setStoreValue("lampaUrl", value),
                1000,
              );
            } else {
              Lampa.Noty.show(
                Lampa.Lang.translate("app_settings_lampa_url_error"),
              );
            }
          },
        });
      })
      .catch((error) => {
        console.error("APP", "Не удалось получить значение lampaUrl:", error);
      });

    // О приложении
    Lampa.SettingsApi.addParam({
      component: "app_settings",
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
        const network = new Lampa.Reguest();
        network.silent(
          "https://api.github.com/repos/Kolovatoff/lampa-desktop/releases/latest",
          (data) => {
            const version = data.tag_name.replace("v", "");

            Lampa.Template.add(
              "about_modal",
              `<div class="app-modal-about">
                Не официальное приложение-клиент для Lampa.
                <ul>
                    <li>Версия приложения: 1.0.0</li>
                    <li>Последняя версия: {version}</li>
                    <li>Версия Lampa: {lampa_version}</li>
                </ul>
                <div class="simple-button selector github">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    <span>GitHub</span>
                </div>
              </div>`,
            );

            let about_html = Lampa.Template.get("about_modal", {
              version: version,
              lampa_version: Lampa.Platform.version("app"),
            });
            about_html.find(".github").on("hover:enter", function () {
              window.open(
                "https://github.com/Kolovatoff/lampa-desktop",
                "_blank",
              );
            });

            Lampa.Modal.open({
              title: Lampa.Lang.translate("app_settings_about_field_name"),
              html: about_html,
              size: "small",
              onBack: function () {
                Lampa.Modal.close();
                Lampa.Controller.toggle("settings_component");
              },
            });
          },
          null,
          null,
          {
            cache: { life: 10 }, // кеш на 10 минут
          },
        );
      },
    });

    Lampa.SettingsApi.addParam({
      component: "app_settings",
      param: {
        name: "app_settings_ie",
        type: "button",
      },
      field: {
        name: "Экспорт/Импорт настроек",
        description: "Экспорт/Импорт настроек",
      },
      onChange: () => {
        Lampa.Select.show({
          title: "Экспорт/Импорт настроек",
          items: [
            {
              title: "Экспорт",
              subtitle: "Сохранить настройки в файл",
              export: true,
            },
            {
              title: "Импорт",
              subtitle: "Импортировать настройки из файла",
            },
          ],
          onSelect: async (a) => {
            Lampa.Noty.show("Ожидайте...");
            try {
              let result;
              if (a.export) {
                result = await window.electronAPI.exportSettings();
              } else {
                result = await window.electronAPI.importSettings();
              }
              Lampa.Noty.show(result.message);
            } catch (error) {
              Lampa.Noty.show(error);
            }
          },
          onBack: () => {
            Lampa.Controller.toggle("settings_component");
          },
        });
      },
    });
  }

  function init() {
    addQuitButton(); // Кнопка выхода в шапке
    addAppSettings(); // Настройки приложения внутри лампы
  }

  if (!window.plugin_app_ready) {
    window.plugin_app_ready = true;
    if (window.appready && !window.plugin_app_ready) {
      init();
    } else {
      Lampa.Listener.follow("app", function (e) {
        if (e.type === "ready") init();
      });
    }
  }
})();
