(function () {
  "use strict";

  var settings_app_icon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M7.5 13.75v.5q0 .325.213.538T8.25 15t.538-.213T9 14.25v-2.5q0-.325-.213-.537T8.25 11t-.537.213t-.213.537v.5h-.75q-.325 0-.537.213T6 13t.213.538t.537.212zm3.25 0h6.5q.325 0 .538-.213T18 13t-.213-.537t-.537-.213h-6.5q-.325 0-.537.213T10 13t.213.538t.537.212m5.75-4h.75q.325 0 .538-.213T18 9t-.213-.537t-.537-.213h-.75v-.5q0-.325-.213-.537T15.75 7t-.537.213T15 7.75v2.5q0 .325.213.538t.537.212t.538-.213t.212-.537zm-9.75 0h6.5q.325 0 .538-.213T14 9t-.213-.537t-.537-.213h-6.5q-.325 0-.537.213T6 9t.213.538t.537.212M4 19q-.825 0-1.412-.587T2 17V5q0-.825.588-1.412T4 3h16q.825 0 1.413.588T22 5v12q0 .825-.587 1.413T20 19h-4v1q0 .425-.288.713T15 21H9q-.425 0-.712-.288T8 20v-1zm0-2h16V5H4zm0 0V5z"/></svg>';

  // Шифрование JSON с PIN и отправка на сервер
  async function uploadJson(jsonData, pin) {
    // Преобразуем PIN в строку и дополняем нулями до 4 символов
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
          title: "Экспорт",
          html: $(
            `<div><ul><li>Сохраните ID экспорта: ${data.id}</li><li>И пин-код для расшифровки: ${pin}</li></ul><ul><li>Внимание! Хранится на сервере 1 час.</li></ul></div>`,
          ),
          size: "small",
          onBack: function () {
            Lampa.Modal.close();
            Lampa.Controller.toggle("settings_component");
          },
        });
      })
      .catch((error) => {
        console.error("Полная ошибка:", error); // смотрим в консоли
        Lampa.Noty.show("Ошибка экспорта");
      });
  }

  function importFromCloud() {
    function showTenDigitModal() {
      let html = $(`
        <div class="account-modal-split">
          <div class="account-modal-split__info">
            <div class="account-modal-split__title">Импорт настроек из облака</div>
            <div class="account-modal-split__text">Введите ID</div>
            <div class="account-modal-split__code">
              ${Array(10).fill('<div class="account-modal-split__code-num"><span></span></div>').join("")}
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
            // Открываем второй модал для PIN
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
          title: "Введите PIN-код",
          nosave: true,
          value: "",
          layout: "nums",
          keyboard: "lampa",
          password: false,
        },
        (pin4) => {
          if (pin4 && pin4.length === 4) {
            // console.log("10-значный код:", code10, "PIN:", pin4);
            downloadJson(code10, pin4)
              .then((settings) => {
                localStorage.clear();
                Lampa.Cache.clearAll();

                Object.entries(settings.lampa).forEach(([key, value]) => {
                  localStorage.setItem(key, value);
                });
                Lampa.Noty.show("Успешно, перезагрузка");
                setTimeout(() => {
                  window.location.reload();
                }, 2000);
              })
              .catch((error) => {
                console.error("Полная ошибка:", error); // смотрим в консоли
                Lampa.Noty.show(
                  "Ошибка импорта, возможно вы ввели данные неверно",
                );
              });
          } else {
            Lampa.Noty.show("Неверный PIN");
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
    // Создаём элемент ввода типа "файл"
    const input = document.createElement("input");
    input.type = "file";

    // Ограничиваем выбор только JSON‑файлами
    input.accept = ".json, application/json";

    // Обработчик события выбора файла
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return; // Пользователь отменил выбор

      // Читаем содержимое файла как текст
      const reader = new FileReader();
      reader.readAsText(file, "utf-8");

      reader.onload = () => {
        const data = reader.result;
        console.log("Содержимое JSON‑файла:", data);

        // Если нужно разобрать JSON (будьте готовы к ошибкам!)
        try {
          const settings = JSON.parse(data);

          if (typeof settings !== "object" || settings === null) {
            return {
              success: false,
              message: "Неверный формат файла",
            };
          }

          if (settings.lampa) {
            localStorage.clear();
            Lampa.Cache.clearAll();

            Object.entries(settings.lampa).forEach(([key, value]) => {
              localStorage.setItem(key, value);
            });
            Lampa.Noty.show("Успешно, перезагрузка");
            setTimeout(() => {
              window.location.reload();
            }, 2000);
          }
        } catch (err) {
          console.error("Ошибка при разборе JSON:", err);
        }
      };

      reader.onerror = () => {
        console.error("Ошибка при чтении файла:", reader.error);
      };
    };

    // Открываем диалоговое окно выбора файла
    input.click();
  }

  function addAppSettings() {
    Lampa.Lang.add({
      kff_export_import_menu: {
        ru: "Экспорт/Импорт (Кфф)",
        en: "Export/Import (Kff)",
      },
    });

    Lampa.SettingsApi.addComponent({
      component: "kff_export_import_menu",
      name: Lampa.Lang.translate("kff_export_import_menu"),
      icon: settings_app_icon,
      // before: "account",
    });
    Lampa.SettingsApi.addParam({
      component: "kff_export_import_menu",
      param: {
        type: "title",
      },
      field: {
        name: "Через облако",
      },
    });
    Lampa.SettingsApi.addParam({
      component: "kff_export_import_menu",
      param: {
        name: "kff_ei_menu_e_cloud",
        type: "button",
      },
      field: {
        name: "Экспорт в облако",
        description:
          "Сохранить настройки в облако. Ваши данные будут зашифрованы перед отправкой с помощью пин-кода и хранятся 1 час.",
      },
      onChange: () => {
        Lampa.Noty.show("Ожидайте...");
        try {
          let result;
          result = { success: true, message: "Экспортируем в облако" };
          exportToCloud();
          Lampa.Noty.show(result.message);
        } catch (error) {
          Lampa.Noty.show(error);
        }
      },
    });
    Lampa.SettingsApi.addParam({
      component: "kff_export_import_menu",
      param: {
        name: "kff_ei_menu_i_cloud",
        type: "button",
      },
      field: {
        name: "Импорт из облака",
        description: "Импортировать настройки из облака",
      },
      onChange: () => {
        Lampa.Noty.show("Ожидайте...");
        try {
          let result;
          result = { success: true, message: "Импортируем из облака" };
          importFromCloud();
          Lampa.Noty.show(result.message);
        } catch (error) {
          Lampa.Noty.show(error);
        }
      },
    });
    Lampa.SettingsApi.addParam({
      component: "kff_export_import_menu",
      param: {
        type: "title",
      },
      field: {
        name: "Локально",
      },
    });
    if (!Lampa.Platform.desktop() && !Lampa.Platform.is("browser")) {
      Lampa.SettingsApi.addParam({
        component: "kff_export_import_menu",
        param: {
          type: "title",
        },
        field: {
          name: "Недоступно на этом устройстве",
        },
      });
    } else {
      Lampa.SettingsApi.addParam({
        component: "kff_export_import_menu",
        param: {
          name: "kff_ei_menu_e_local",
          type: "button",
        },
        field: {
          name: "Экспорт в файл",
          description: "Экспортировать настройки в файл",
        },
        onChange: () => {
          Lampa.Noty.show("Ожидайте...");
          try {
            let result;
            result = { success: true, message: "Экспортируем в файл" };
            exportToFile();
            Lampa.Noty.show(result.message);
          } catch (error) {
            Lampa.Noty.show(error);
          }
        },
      });
      Lampa.SettingsApi.addParam({
        component: "kff_export_import_menu",
        param: {
          name: "kff_ei_menu_i_local",
          type: "button",
        },
        field: {
          name: "Импорт из файла",
          description: "Импортировать настройки из файла",
        },
        onChange: () => {
          Lampa.Noty.show("Ожидайте...");
          try {
            let result;
            result = { success: true, message: "Импортируем из файла" };
            importFromFile();
            Lampa.Noty.show(result.message);
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
