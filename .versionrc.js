module.exports = {
  types: [
    { type: "feat", section: "✨ Новые возможности" },
    { type: "fix", section: "🐛 Исправления" },
    { type: "docs", section: "📚 Документация" },
    { type: "style", section: "💄 Стили" },
    { type: "refactor", section: "♻️ Рефакторинг" },
    { type: "perf", section: "⚡ Производительность" },
    { type: "test", section: "✅ Тесты" },
    { type: "build", section: "📦 Сборка" },
    { type: "ci", section: "🔧 CI/CD" },
    { type: "chore", section: "🧹 Технические задачи", hidden: true }, // Скрыть из changelog
    { type: "wip", section: "🚧 В работе", hidden: true }, // Скрыть из changelog
  ],

  // Шаблон для ссылок на коммиты
  commitUrlFormat: "{{host}}/{{owner}}/{{repository}}/commit/{{hash}}",

  // Сравнение тегов
  compareUrlFormat:
    "{{host}}/{{owner}}/{{repository}}/compare/{{previousTag}}...{{currentTag}}",

  // Шаблон для ссылок на задачи
  issueUrlFormat: "{{host}}/{{owner}}/{{repository}}/issues/{{id}}",

  // Скрывать определенные типы коммитов из changelog
  skip: {
    changelog: false, // не пропускать генерацию changelog
    bump: false, // не пропускать обновление версии
  },

  // Настройки для тегов
  tagPrefix: "v",

  // Шаблон коммитов для фильтрации (регулярное выражение)
  releaseCommitMessageFormat: "chore(release): {{currentTag}}",

  // Правила для парсинга коммитов
  parserOpts: {
    noteKeywords: ["BREAKING CHANGE", "BREAKING CHANGES"],
  },

  // Кастомизация changelog
  changelogFile: "CHANGELOG.md",
  updateChangelog: true,

  // Дополнительные настройки
  bumpFiles: [
    {
      filename: "package.json",
      type: "json",
    },
    {
      filename: "package-lock.json",
      type: "json",
    },
  ],

  // Сортировка коммитов внутри секций
  commitGroupsSort: [
    "feat",
    "fix",
    "perf",
    "refactor",
    "docs",
    "test",
    "build",
    "ci",
  ],

  // Сортировка коммитов по scope
  commitsSort: ["scope", "subject"],
};
