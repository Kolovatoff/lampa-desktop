(function () {
  "use strict";

  var settings_app_icon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M7.5 13.75v.5q0 .325.213.538T8.25 15t.538-.213T9 14.25v-2.5q0-.325-.213-.537T8.25 11t-.537.213t-.213.537v.5h-.75q-.325 0-.537.213T6 13t.213.538t.537.212zm3.25 0h6.5q.325 0 .538-.213T18 13t-.213-.537t-.537-.213h-6.5q-.325 0-.537.213T10 13t.213.538t.537.212m5.75-4h.75q.325 0 .538-.213T18 9t-.213-.537t-.537-.213h-.75v-.5q0-.325-.213-.537T15.75 7t-.537.213T15 7.75v2.5q0 .325.213.538t.537.212t.538-.213t.212-.537zm-9.75 0h6.5q.325 0 .538-.213T14 9t-.213-.537t-.537-.213h-6.5q-.325 0-.537.213T6 9t.213.538t.537.212M4 19q-.825 0-1.412-.587T2 17V5q0-.825.588-1.412T4 3h16q.825 0 1.413.588T22 5v12q0 .825-.587 1.413T20 19h-4v1q0 .425-.288.713T15 21H9q-.425 0-.712-.288T8 20v-1zm0-2h16V5H4zm0 0V5z"/></svg>';

  function exportLocalStorageToJSON() {
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

    if (storageData.plugins) {
      try {
        const pluginsArray = JSON.parse(storageData.plugins);

        const filteredPlugins = pluginsArray.filter((plugin) => {
          const cleanUrl = plugin.url
            .replace(/^https?:\/\//, "")
            .replace(/^\/\//, "");
          return cleanUrl !== "lampa.kolovatoff.ru/export.js";
        });

        storageData.plugins = JSON.stringify(filteredPlugins, null, 2);
      } catch (e) {
        console.warn('Ошибка при обработке поля "plugins":', e);
      }
    }

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

  function addAppSettings() {
    Lampa.Lang.add({
      app_settings: {
        ru: "Настройки приложения",
        en: "App settings",
      },
    });

    Lampa.SettingsApi.addComponent({
      component: "app_settings",
      name: Lampa.Lang.translate("app_settings"),
      icon: settings_app_icon,
      before: "account",
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
          ],
          onSelect: async (a) => {
            Lampa.Noty.show("Ожидайте...");
            try {
              let result;
              if (a.export) {
                result = { success: true, message: "Экспортируем" };
                exportLocalStorageToJSON();
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
    addAppSettings(); // Настройки приложения внутри лампы
  }

  if (!window.plugin_kffexport_ready) {
    window.plugin_kffexport_ready = true;
    if (window.appready) {
      init();
    } else {
      Lampa.Listener.follow("app", function (e) {
        if (e.type === "ready") init();
      });
    }
  }
})();
