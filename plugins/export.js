(function () {
  "use strict";

  var settings_app_icon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M7.5 13.75v.5q0 .325.213.538T8.25 15t.538-.213T9 14.25v-2.5q0-.325-.213-.537T8.25 11t-.537.213t-.213.537v.5h-.75q-.325 0-.537.213T6 13t.213.538t.537.212zm3.25 0h6.5q.325 0 .538-.213T18 13t-.213-.537t-.537-.213h-6.5q-.325 0-.537.213T10 13t.213.538t.537.212m5.75-4h.75q.325 0 .538-.213T18 9t-.213-.537t-.537-.213h-.75v-.5q0-.325-.213-.537T15.75 7t-.537.213T15 7.75v2.5q0 .325.213.538t.537.212t.538-.213t.212-.537zm-9.75 0h6.5q.325 0 .538-.213T14 9t-.213-.537t-.537-.213h-6.5q-.325 0-.537.213T6 9t.213.538t.537.212M4 19q-.825 0-1.412-.587T2 17V5q0-.825.588-1.412T4 3h16q.825 0 1.413.588T22 5v12q0 .825-.587 1.413T20 19h-4v1q0 .425-.288.713T15 21H9q-.425 0-.712-.288T8 20v-1zm0-2h16V5H4zm0 0V5z"/></svg>';

  // Шифрование JSON с PIN и отправка на сервер
  async function uploadJson(jsonData, pin) {
    const pinStr = String(pin).padStart(4, "0");

    const jsonString = JSON.stringify(jsonData);
    let encrypted = "";

    for (let i = 0; i < jsonString.length; i++) {
      const charCode = jsonString.charCodeAt(i);
      const key = parseInt(pinStr[i % 4], 10);
      encrypted += String.fromCharCode(charCode ^ key);
    }

    const encryptedB64 = btoa(unescape(encodeURIComponent(encrypted)));

    const response = await fetch("https://lampa.kolovatoff.ru/ei/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: encryptedB64 }),
    });

    const result = await response.json();
    console.log("Upload result:", result);
    return result;
  }

  async function downloadJson(fileId, pin) {
    const pinStr = String(pin).padStart(4, "0");

    const response = await fetch(
      `https://lampa.kolovatoff.ru/ei/download?id=${fileId}`,
    );
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Download failed");
    }

    const encryptedB64 = result.data;

    const encryptedStep1 = atob(encryptedB64);
    const encryptedStep2 = escape(encryptedStep1);
    const encrypted = decodeURIComponent(encryptedStep2);

    let decrypted = "";
    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i);
      const key = parseInt(pinStr[i % 4], 10);
      decrypted += String.fromCharCode(charCode ^ key);
    }

    return JSON.parse(decrypted);
  }

  function generatePin() {
    const pin = Math.floor(Math.random() * 10000);
    return pin.toString().padStart(4, "0");
  }

  function exportToCloud() {
    const storageData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      storageData[key] = localStorage.getItem(key);
    }

    const keysToDelete = ["platform", "app.js", "testsize"];
    keysToDelete.forEach((key) => {
      if (storageData[key]) {
        delete storageData[key];
      }
    });

    const settings = {
      appVersion: "0.0.0",
      dateCreated: new Date().toISOString(),
      app: {},
      lampa: storageData,
    };

    const pin = generatePin();
    uploadJson(settings, pin)
      .then((data) => {
        Lampa.Modal.open({
          title: Lampa.Lang.translate("kff_export_modal_title"),
          html: $(
            `<div><ul><li>${Lampa.Lang.translate("kff_export_modal_save_id")}: ${data.id}</li><li>${Lampa.Lang.translate("kff_export_modal_pin_code")}: ${pin}</li></ul><ul><li>${Lampa.Lang.translate("kff_export_modal_warning")}</li></ul></div>`,
          ),
          size: "small",
          onBack: function () {
            Lampa.Modal.close();
            Lampa.Controller.toggle("settings_component");
          },
        });
      })
      .catch((error) => {
        console.error("Полная ошибка:", error);
        Lampa.Noty.show(Lampa.Lang.translate("kff_export_error"));
      });
  }

  function importFromCloud() {
    function showTenDigitModal() {
      let html = $(`
        <div class="account-modal-split">
          <div class="account-modal-split__info">
            <div class="account-modal-split__title">${Lampa.Lang.translate("kff_import_modal_title")}</div>
            <div class="account-modal-split__text">${Lampa.Lang.translate("kff_import_modal_enter_id")}</div>
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
          "layer--" + (Lampa.Platform.mouse() ? "wheight" : "height"),
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
          if (keyboard && typeof keyboard.destroy === "function") {
            keyboard.destroy();
            keyboard = null;
          }
          Lampa.Modal.close();
          Lampa.Controller.toggle("menu");
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
        onChange: (value) => {
          drawCode(value);
          if (value.length === 10) {
            if (keyboard && typeof keyboard.destroy === "function") {
              keyboard.destroy();
              keyboard = null;
            }
            Lampa.Modal.close();
            showPinModal(value);
          }
        },
        onKeyPress: (button) => {
          if (button === "{BKSP}") {
            keyboard.setInput(keyboard.getInput().slice(0, -1));
            drawCode(keyboard.getInput());
          } else if (button === "{ENTER}") {
            if (keyboard.getInput().length === 10) {
              if (keyboard && typeof keyboard.destroy === "function") {
                keyboard.destroy();
                keyboard = null;
              }
              Lampa.Modal.close();
              showPinModal(keyboard.getInput());
            }
          }
        },
      });

      let keys = $(".simple-keyboard .hg-button").addClass("selector");
      Lampa.Controller.collectionSet($(".simple-keyboard"));
      Lampa.Controller.collectionFocus(keys[0], $(".simple-keyboard"));
      $(".simple-keyboard .hg-button").on("hover:enter", function (e) {
        Lampa.Controller.collectionFocus($(this)[0]);
        keyboard.handleButtonClicked($(this).attr("data-skbtn"), e);
      });
    }

    function showPinModal(code10) {
      Lampa.Input.edit(
        {
          free: true,
          title: Lampa.Lang.translate("kff_import_modal_enter_pin"),
          nosave: true,
          value: "",
          layout: "nums",
          keyboard: "lampa",
          password: false,
        },
        (pin4) => {
          if (pin4 && pin4.length === 4) {
            downloadJson(code10, pin4)
              .then((settings) => {
                localStorage.clear();
                Lampa.Cache.clearAll();

                Object.entries(settings.lampa).forEach(([key, value]) => {
                  localStorage.setItem(key, value);
                });
                Lampa.Noty.show(Lampa.Lang.translate("kff_import_success"));
                setTimeout(() => {
                  window.location.reload();
                }, 2000);
              })
              .catch((error) => {
                console.error("Полная ошибка:", error);
                Lampa.Noty.show(Lampa.Lang.translate("kff_import_error_data"));
              });
          } else {
            Lampa.Noty.show(Lampa.Lang.translate("kff_import_invalid_pin"));
          }
          Lampa.Controller.toggle("menu");
        },
      );
    }

    showTenDigitModal();
  }

  function exportToFile() {
    const storageData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      storageData[key] = localStorage.getItem(key);
    }

    const keysToDelete = ["platform", "app.js", "testsize"];
    keysToDelete.forEach((key) => {
      if (storageData[key]) {
        delete storageData[key];
      }
    });

    const settings = {
      appVersion: "0.0.0",
      dateCreated: new Date().toISOString(),
      app: {},
      lampa: storageData,
    };

    const jsonString = JSON.stringify(settings, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "lampa-desktop-settings.json";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function importFromFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json, application/json";

    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.readAsText(file, "utf-8");

      reader.onload = () => {
        const data = reader.result;
        console.log("Содержимое JSON-файла:", data);

        try {
          const settings = JSON.parse(data);

          if (typeof settings !== "object" || settings === null) {
            return {
              success: false,
              message: Lampa.Lang.translate("kff_import_error_format"),
            };
          }

          if (settings.lampa) {
            localStorage.clear();
            Lampa.Cache.clearAll();

            Object.entries(settings.lampa).forEach(([key, value]) => {
              localStorage.setItem(key, value);
            });
            Lampa.Noty.show(Lampa.Lang.translate("kff_import_success"));
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }
        } catch (err) {
          console.error("Ошибка при разборе JSON:", err);
          Lampa.Noty.show(Lampa.Lang.translate("kff_import_error_parse"));
        }
      };

      reader.onerror = () => {
        console.error("Ошибка при чтении файла:", reader.error);
        Lampa.Noty.show(Lampa.Lang.translate("kff_import_error_read"));
      };
    };

    input.click();
  }

  function addAppSettings() {
    Lampa.Lang.add({
      // Меню
      kff_export_import_menu: {
        ru: "Экспорт/Импорт (Кфф)",
        en: "Export/Import (Kff)",
        uk: "Експорт/Імпорт (Кфф)",
      },

      // Разделители
      kff_separator_cloud: {
        ru: "Через облако",
        en: "Via cloud",
        uk: "Через хмару",
      },
      kff_separator_local: {
        ru: "Локально",
        en: "Local",
        uk: "Локально",
      },
      kff_separator_unavailable: {
        ru: "Недоступно на этом устройстве",
        en: "Unavailable on this device",
        uk: "Недоступно на цьому пристрої",
      },

      // Кнопки
      kff_export_cloud_btn: {
        ru: "Экспорт в облако",
        en: "Export to cloud",
        uk: "Експорт у хмару",
      },
      kff_export_cloud_desc: {
        ru: "Сохранить настройки в облако. Ваши данные будут зашифрованы перед отправкой с помощью пин-кода и хранятся 1 час.",
        en: "Save settings to the cloud. Your data will be encrypted before sending using a PIN code and stored for 1 hour.",
        uk: "Зберегти налаштування в хмару. Ваші дані будуть зашифровані перед відправкою за допомогою пін-коду та зберігаються 1 годину.",
      },
      kff_import_cloud_btn: {
        ru: "Импорт из облака",
        en: "Import from cloud",
        uk: "Імпорт із хмари",
      },
      kff_import_cloud_desc: {
        ru: "Импортировать настройки из облака",
        en: "Import settings from cloud",
        uk: "Імпортувати налаштування з хмари",
      },
      kff_export_file_btn: {
        ru: "Экспорт в файл",
        en: "Export to file",
        uk: "Експорт у файл",
      },
      kff_export_file_desc: {
        ru: "Экспортировать настройки в файл",
        en: "Export settings to file",
        uk: "Експортувати налаштування у файл",
      },
      kff_import_file_btn: {
        ru: "Импорт из файла",
        en: "Import from file",
        uk: "Імпорт із файлу",
      },
      kff_import_file_desc: {
        ru: "Импортировать настройки из файла",
        en: "Import settings from file",
        uk: "Імпортувати налаштування з файлу",
      },

      // Модальные окна экспорта
      kff_export_modal_title: {
        ru: "Экспорт",
        en: "Export",
        uk: "Експорт",
      },
      kff_export_modal_save_id: {
        ru: "Сохраните ID экспорта",
        en: "Save export ID",
        uk: "Збережіть ID експорту",
      },
      kff_export_modal_pin_code: {
        ru: "И пин-код для расшифровки",
        en: "And PIN code for decryption",
        uk: "І пін-код для розшифрування",
      },
      kff_export_modal_warning: {
        ru: "Внимание! Хранится на сервере 1 час.",
        en: "Attention! Stored on the server for 1 hour.",
        uk: "Увага! Зберігається на сервері 1 годину.",
      },

      // Модальные окна импорта
      kff_import_modal_title: {
        ru: "Импорт настроек из облака",
        en: "Import settings from cloud",
        uk: "Імпорт налаштувань із хмари",
      },
      kff_import_modal_enter_id: {
        ru: "Введите ID",
        en: "Enter ID",
        uk: "Введіть ID",
      },
      kff_import_modal_enter_pin: {
        ru: "Введите PIN-код",
        en: "Enter PIN code",
        uk: "Введіть PIN-код",
      },

      // Уведомления
      kff_noty_waiting: {
        ru: "Ожидайте...",
        en: "Please wait...",
        uk: "Зачекайте...",
      },
      kff_export_error: {
        ru: "Ошибка экспорта",
        en: "Export error",
        uk: "Помилка експорту",
      },
      kff_import_success: {
        ru: "Успешно, перезагрузка",
        en: "Success, reloading",
        uk: "Успішно, перезавантаження",
      },
      kff_import_error_data: {
        ru: "Ошибка импорта, возможно вы ввели данные неверно",
        en: "Import error, possibly you entered data incorrectly",
        uk: "Помилка імпорту, можливо ви ввели дані невірно",
      },
      kff_import_invalid_pin: {
        ru: "Неверный PIN",
        en: "Invalid PIN",
        uk: "Невірний PIN",
      },
      kff_import_error_format: {
        ru: "Неверный формат файла",
        en: "Invalid file format",
        uk: "Невірний формат файлу",
      },
      kff_import_error_parse: {
        ru: "Ошибка при разборе JSON",
        en: "JSON parsing error",
        uk: "Помилка при розборі JSON",
      },
      kff_import_error_read: {
        ru: "Ошибка при чтении файла",
        en: "File reading error",
        uk: "Помилка при читанні файлу",
      },
    });

    Lampa.SettingsApi.addComponent({
      component: "kff_export_import_menu",
      name: Lampa.Lang.translate("kff_export_import_menu"),
      icon: settings_app_icon,
    });

    // Разделитель "Через облако"
    Lampa.SettingsApi.addParam({
      component: "kff_export_import_menu",
      param: {
        type: "title",
      },
      field: {
        name: Lampa.Lang.translate("kff_separator_cloud"),
      },
    });

    // Кнопка "Экспорт в облако"
    Lampa.SettingsApi.addParam({
      component: "kff_export_import_menu",
      param: {
        name: "kff_ei_menu_e_cloud",
        type: "button",
      },
      field: {
        name: Lampa.Lang.translate("kff_export_cloud_btn"),
        description: Lampa.Lang.translate("kff_export_cloud_desc"),
      },
      onChange: () => {
        Lampa.Noty.show(Lampa.Lang.translate("kff_noty_waiting"));
        try {
          exportToCloud();
        } catch (error) {
          Lampa.Noty.show(error);
        }
      },
    });

    // Кнопка "Импорт из облака"
    Lampa.SettingsApi.addParam({
      component: "kff_export_import_menu",
      param: {
        name: "kff_ei_menu_i_cloud",
        type: "button",
      },
      field: {
        name: Lampa.Lang.translate("kff_import_cloud_btn"),
        description: Lampa.Lang.translate("kff_import_cloud_desc"),
      },
      onChange: () => {
        Lampa.Noty.show(Lampa.Lang.translate("kff_noty_waiting"));
        try {
          importFromCloud();
        } catch (error) {
          Lampa.Noty.show(error);
        }
      },
    });

    // Разделитель "Локально"
    Lampa.SettingsApi.addParam({
      component: "kff_export_import_menu",
      param: {
        type: "title",
      },
      field: {
        name: Lampa.Lang.translate("kff_separator_local"),
      },
    });

    // Проверка платформы для локальных операций
    if (!Lampa.Platform.desktop() && !Lampa.Platform.is("browser")) {
      Lampa.SettingsApi.addParam({
        component: "kff_export_import_menu",
        param: {
          type: "title",
        },
        field: {
          name: Lampa.Lang.translate("kff_separator_unavailable"),
        },
      });
    } else {
      // Кнопка "Экспорт в файл"
      Lampa.SettingsApi.addParam({
        component: "kff_export_import_menu",
        param: {
          name: "kff_ei_menu_e_local",
          type: "button",
        },
        field: {
          name: Lampa.Lang.translate("kff_export_file_btn"),
          description: Lampa.Lang.translate("kff_export_file_desc"),
        },
        onChange: () => {
          Lampa.Noty.show(Lampa.Lang.translate("kff_noty_waiting"));
          try {
            exportToFile();
          } catch (error) {
            Lampa.Noty.show(error);
          }
        },
      });

      // Кнопка "Импорт из файла"
      Lampa.SettingsApi.addParam({
        component: "kff_export_import_menu",
        param: {
          name: "kff_ei_menu_i_local",
          type: "button",
        },
        field: {
          name: Lampa.Lang.translate("kff_import_file_btn"),
          description: Lampa.Lang.translate("kff_import_file_desc"),
        },
        onChange: () => {
          Lampa.Noty.show(Lampa.Lang.translate("kff_noty_waiting"));
          try {
            importFromFile();
          } catch (error) {
            Lampa.Noty.show(error);
          }
        },
      });
    }
  }

  function init() {
    addAppSettings();
  }

  if (!window.plugin_kffexportimport_ready) {
    window.plugin_kffexportimport_ready = true;
    if (!window.plugin_app_ready) {
      if (window.appready) {
        init();
      } else {
        Lampa.Listener.follow("app", function (e) {
          if (e.type === "ready") init();
        });
      }
    }
  }
})();
