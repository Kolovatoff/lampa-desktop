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
      app_settings: {
        ru: "Настройки приложения",
        en: "App settings",
      },
      app_settings_fullscreen_field_name: {
        ru: "Запускать в полноэкранном режиме",
        en: "Launch in fullscreen mode",
      },
      app_settings_autoupdate_field_name: {
        ru: "Автоматическое обновление",
        en: "Automatic update",
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
      app_settings_lampa_url_error: {
        ru: "Неверный URL",
        en: "Invalid URL",
      },
      app_settings_about_field_name: {
        ru: "О приложении",
        en: "About the app",
      },
      app_settings_about_field_description: {
        ru: "Узнать версию и др. информацию о приложении",
        en: "Check version and other app information",
      },
      app_settings_ts_field_name: {
        ru: "TorrServer",
        en: "TorrServer",
      },
      app_settings_ts_field_description: {
        ru: "Управление TorrServer",
        en: "Control TorrServer",
      },
      app_settings_ie_field_name: {
        ru: "Экспорт/Импорт настроек",
        en: "Export/Import settings",
      },
      app_settings_ie_field_description: {
        ru: "Резервная копия данных или перенос из другого приложения",
        en: "Backup data or transfer from another application",
      },
      app_settings_ie_btn_export_title: {
        ru: "Экспорт",
        en: "Export",
      },
      app_settings_ie_btn_export_subtitle: {
        ru: "Сохранить настройки в файл",
        en: "Save settings to file",
      },
      app_settings_ie_btn_export_cloud_subtitle: {
        ru: "Сохранить настройки в облако. Ваши данные будут зашифрованы перед отправкой с помощью пин-кода и хранятся 1 час.",
        en: "Save settings to the cloud. Your data will be encrypted before sending using a PIN code and stored for 1 hour.",
      },
      app_settings_ie_btn_import_title: {
        ru: "Импорт",
        en: "Import",
      },
      app_settings_ie_btn_import_subtitle: {
        ru: "Импортировать настройки из файла",
        en: "Import settings from file",
      },
      app_settings_ie_btn_import_cloud_subtitle: {
        ru: "Импортировать настройки из облака",
        en: "Import settings from cloud",
      },
      app_settings_noty_waiting: {
        ru: "Ожидайте...",
        en: "Please wait...",
      },
      app_settings_ie_import_success: {
        ru: "Импорт выполнен успешно",
        en: "Import completed successfully",
      },
      app_settings_ie_import_error: {
        ru: "Ошибка импорта",
        en: "Import error",
      },
      app_settings_ie_invalid_pin: {
        ru: "Неверный PIN-код",
        en: "Invalid PIN",
      },
      // TS
      app_settings_ts_autostart_field_name: {
        ru: "Автозапуск при старте Lampa",
        en: "Autostart on Lampa launch",
      },
      app_settings_ts_host_name: {
        ru: "Хост на котором запускать TS",
        en: "Host to run TS on",
      },
      app_settings_ts_host_description: {
        ru: "Если не знаете зачем это, оставьте localhost",
        en: "If you don't know why you need this, leave localhost",
      },
      app_settings_ts_host_ok: {
        ru: "Успешно изменено, перезапустите TorrServer",
        en: "Successfully changed, restart TorrServer",
      },
      app_settings_ts_port_name: {
        ru: "Порт на котором запускать TS",
        en: "Port to run TS on",
      },
      app_settings_ts_port_description: {
        ru: "Если не знаете зачем это, оставьте 8090",
        en: "If you don't know why you need this, leave 8090",
      },
      app_settings_ts_port_ok: {
        ru: "Успешно изменено, перезапустите TorrServer",
        en: "Successfully changed, restart TorrServer",
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
      '<div><div class="settings-param" data-static="true" data-name="app_settings_ts_tsStatus"><div class="settings-param__name">Статус</div><div class="settings-param__descr">🔄</div></div>' +
        '<div><div class="settings-param" data-static="true" data-name="app_settings_ts_tsVersion"><div class="settings-param__name">Версия</div><div class="settings-param__descr">🔄</div></div>',
    );

    const settingsManager = new SettingsManager("app_settings");

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
            Lampa.Settings.update();
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
            Lampa.Loading.start(() => {}, "Загружаю данные...");
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
                        Не официальное приложение-клиент для Lampa.
                        <ul>
                            <li>Версия приложения: {current_version}</li>
                            <li>Последняя версия: {latest_version}</li>
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
                      current_version: current_version,
                      latest_version: latest_version,
                      lampa_version: Lampa.Platform.version("app"),
                    });
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
            name: "Основные",
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
            name: "app_settings_separator_main",
            type: "title",
          },
          field: {
            name: "Остальные",
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
                  title: "Облако",
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
                  title: "Локально",
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
                        let html = $(`
                      <div class="account-modal-split">
                        <div class="account-modal-split__info">
                          <div class="account-modal-split__title">Импорт настроек из облака</div>
                          <div class="account-modal-split__text">Введите ID</div>
                          <div class="account-modal-split__code">
                            ${Array(10).fill('<div class="account-modal-split__code-num"><span>-</span></div>').join("")}
                          </div>
                          <div class="account-modal-split__keyboard">
                            <div class="simple-keyboard"></div>
                          </div>
                        </div>
                      </div>`);

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
                            title: "Введите PIN-код",
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
          Lampa.Settings.update();
          await window.electronAPI.store.set("tsAutoStart", value === "true");
        },
      }),
      settingsTsManager.loadAsyncSetting("tsHost", {
        order: 7,
        param: {
          name: "app_settings_ts_tsHost",
          type: "input",
          values: "",
        },
        field: {
          name: Lampa.Lang.translate("app_settings_ts_host_name"),
          description: Lampa.Lang.translate("app_settings_ts_host_description"),
        },
        onChange: async function (value) {
          Lampa.Settings.update();
          Lampa.Noty.show(Lampa.Lang.translate("app_settings_ts_host_ok"));
          setTimeout(
            async () => await window.electronAPI.store.set("tsHost", value),
            1000,
          );
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
          Lampa.Settings.update();
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
            name: "Управление",
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
            name: "▶️ Запуск TorrServer",
          },
          onChange: async () => {
            const status = await window.electronAPI.torrServer.getStatus();
            if (status.installed) {
              Lampa.Loading.start(() => {}, "Выполняется запуск TorrServer");
            } else {
              Lampa.Loading.start(
                () => {},
                "Выполняется скачивание и запуск TorrServer",
              );
            }

            const tsHost = await window.electronAPI.store.get("tsHost");
            const tsPort = await window.electronAPI.store.get("tsPort");
            const result = await window.electronAPI.torrServer.start([
              "--ip",
              tsHost,
              "--port",
              tsPort,
            ]);
            Lampa.Storage.set("torrserver_url", `http://${tsHost}:${tsPort}`);
            Lampa.Storage.set("torrserver_use_link", "one");

            updateTsStatus();

            Lampa.Loading.stop();
            Lampa.Noty.show(
              result.success ? result.message : "Ошибка: " + result.message,
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
            name: "🛑 Остановка TorrServer",
          },
          onChange: async () => {
            Lampa.Loading.start(() => {}, "Остановка TorrServer");
            const result = await window.electronAPI.torrServer.stop();
            Lampa.Loading.stop();
            updateTsStatus();
            Lampa.Noty.show(
              result.success ? result.message : "Ошибка: " + result.message,
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
            name: "🔁 Перезапуск TorrServer",
          },
          onChange: async () => {
            Lampa.Loading.start(() => {}, "Перезапуск TorrServer");

            const tsHost = await window.electronAPI.store.get("tsHost");
            const tsPort = await window.electronAPI.store.get("tsPort");
            const result = await window.electronAPI.torrServer.restart([
              "--ip",
              tsHost,
              "--port",
              tsPort,
            ]);
            Lampa.Storage.set("torrserver_url", `http://${tsHost}:${tsPort}`);
            Lampa.Storage.set("torrserver_use_link", "one");

            updateTsStatus();
            Lampa.Loading.stop();
            Lampa.Noty.show(
              result.success ? result.message : "Ошибка: " + result.message,
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
            name: "🔍 Проверка обновлений TorrServer",
          },
          onChange: async () => {
            Lampa.Loading.start(() => {}, "Проверка обновлений TorrServer");
            const result = await window.electronAPI.torrServer.checkUpdate();
            // Создаем модальное окно если есть обновление
            if (result.hasUpdate) {
              Lampa.Template.add(
                "ts_update_modal",
                `<div class="app-modal-ts-update">
                        Найдено обновление TorrServer.
                        <ul>
                            <li>Установлена: {current_version}</li>
                            <li>Последняя версия: {latest_version}</li>
                        </ul>
                        <div class="simple-button selector ts_update">Обновить</div>
                      </div>`,
              );

              let ts_update_modal_html = Lampa.Template.get("ts_update_modal", {
                current_version: result.current,
                latest_version: result.latest,
              });
              ts_update_modal_html
                .find(".ts_update")
                .on("hover:enter", async function () {
                  Lampa.Loading.start(() => {}, "Обновление TorrServer");
                  const result = await window.electronAPI.torrServer.update();
                  Lampa.Loading.stop();
                  Lampa.Modal.close();
                  Lampa.Controller.toggle("settings_component");
                  updateTsStatus();
                  Lampa.Noty.show(
                    result.success
                      ? "Успешно обновлено"
                      : "Ошибка: " + result.message,
                  );
                });

              Lampa.Modal.open({
                title: "Найдено обновление TorrServer",
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
              Lampa.Noty.show("Обновлений нет, у вас последняя версия");
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
            name: "📂 Открыть папку TorrServer",
          },
          onChange: async () => {
            const status = await window.electronAPI.torrServer.getStatus();

            console.log(status);
            if (status.installed) {
              await window.electronAPI.folder.open(status.executableDir);
            } else {
              Lampa.Noty.show("Сначала установите TorrServer, нажав на запуск");
            }
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
            name: "🗑️ Удалить TorrServer (полностью)",
          },
          onChange: async () => {
            Lampa.Noty.show("Выполняется ПОЛНОЕ удаление TorrServer...");
            const result = await window.electronAPI.torrServer.uninstall();
            updateTsStatus();
            Lampa.Noty.show(
              result.success ? result.message : "Ошибка: " + result.message,
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
            name: "💾 Удалить TorrServer (сохранить данные)",
          },
          onChange: async () => {
            Lampa.Noty.show("Выполняется удаление TorrServer...");
            const result = await window.electronAPI.torrServer.uninstall(true);
            updateTsStatus();
            Lampa.Noty.show(
              result.success ? result.message : "Ошибка: " + result.message,
            );
          },
        })
        .addToQueue({
          order: 5,
          param: {
            name: "app_settings_ts_separator_danger",
            type: "title",
          },
          field: {
            name: "Настройки",
          },
        })
        .addToQueue({
          order: 9,
          param: {
            name: "app_settings_ts_separator_danger",
            type: "title",
          },
          field: {
            name: "Осторожно!",
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
              : "Установите TorrServer, нажав кнопку запуска",
          );
        $('[data-name="app_settings_ts_tsStatus"]')
          .find(".settings-param__descr")
          .text(
            status.installed
              ? status.running
                ? "✅ Запущен"
                : "❌ Остановлен"
              : "🚫 Не установлен",
          );
      });
    }
    Lampa.Settings.listener.follow("open", function (e) {
      if (e.name === "app_settings_ts") {
        updateTsStatus();
      }
    });
  }

  function init() {
    addQuitButton(); // Кнопка выхода в шапке
    addAppSettings(); // Настройки приложения внутри лампы
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
