# Anki English Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать простое, мобильно-адаптивное веб-приложение для изучения английских слов по методу Anki карточек с функцией импорта JSON-пар слов и синхронизацией словаря в GitHub через Contents API, готовое к публикации на GitHub Pages.

**Architecture:** Приложение построено как SPA на базе Vite + TypeScript без тяжелых UI-фреймворков. Логика разделена на слои: валидация и дедупликация слов (`src/storage/words.ts`), взаимодействие с GitHub Contents API (`src/api/github.ts`), реактивное хранилище состояния и настроек (`src/state/store.ts`), и легковесные UI-компоненты карточки и модальных окон (`src/ui/*`).

**Tech Stack:** Bun, Vite, TypeScript, Vanilla CSS (Modern CSS 3D Transforms), GitHub Actions (`deploy.yml`).

**Spec:** `docs/superpowers/specs/2026-10-27-anki-english-design.md`

## Global Constraints

- Минимальный размер бандла: чистый TypeScript без React/Vue/Svelte.
- Zero-Secrets: никаких захардкоженных токенов; GitHub PAT сохраняется исключительно в `localStorage` пользователя.
- Запуск всех команд сборки и тестирования строго через `rtk` (`rtk bun run ...`, `rtk bun test`).
- Использование Conventional Commits через `rtk oco` при фиксации изменений.
- Дедупликация слов по ключу `en` в нижнем регистре с обрезкой пробелов (`trim().toLowerCase()`).
- Корректная поддержка UTF-8 при кодировании в Base64 для GitHub API (через `TextEncoder`).

## Review Focus

1. **Невалидный или поврежденный JSON при импорте:** приложение должно выводить понятную ошибку парсинга, не падая и не стирая текущие слова.
2. **Дубликаты слов с разным регистром или лишними пробелами:** например `" Clean "` и `"clean"` должны определяться как один и тот же термин.
3. **Отсутствие GitHub токена (демо/оффлайн-режим):** приложение должно штатно работать с базовым `words.json`, а новые слова сохранять локально и предлагать скачать обновленный файл.
4. **Конфликт SHA при сохранении в GitHub:** если файл в репозитории изменился, приложение должно сообщать о конфликте версий и предлагать обновить данные.
5. **Мобильная верстка и тач:** карточка должна корректно переворачиваться по тапу без случайного выделения текста или сдвига экрана.

---

### Task 1: Scaffolding, Tooling & Base Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `mise.toml`
- Create: `.gitignore`
- Create: `public/words.json`
- Create: `index.html`

**Interfaces:**
- Consumes: None
- Produces: Каркас проекта со сборщиком Vite, тестовым окружением Bun Test и базовым словарем `public/words.json`.

- [ ] **Step 1: Create package.json and configuration files**
  - Создать `package.json` с зависимостями `vite`, `typescript` и скриптами `dev`, `build`, `test`.
  - Создать `tsconfig.json` с таргетом `ES2022`, module `ESNext`, strict: true.
  - Создать `vite.config.ts` с настройкой `base: './'` для корректной работы в подпутях GitHub Pages.
  - Создать `mise.toml` со стандартными задачами `build`, `test`, `dev`.
  - Создать `.gitignore` (`node_modules`, `dist`, `.env*`, `mise.local.toml`).
  - Создать `public/words.json` с начальными 5 словами для проверки.
  - Создать базовый `index.html`.

- [ ] **Step 2: Run build to verify setup**
  Run: `rtk bun run build`
  Expected: Сборка `dist/` завершается без ошибок.

- [ ] **Step 3: Commit**
  Run: `rtk git add . && rtk oco`

---

### Task 2: Core Data Types and Word Deduplication / Validation Logic

**Files:**
- Create: `src/types.ts`
- Create: `src/storage/words.ts`
- Test: `tests/words.test.ts`

**Interfaces:**
- Consumes: None
- Produces:
  - `export interface WordItem { en: string; ru: string; }`
  - `export function normalizeKey(en: string): string`
  - `export function validateWordsJson(raw: string): { valid: boolean; data?: WordItem[]; error?: string }`
  - `export function mergeWords(existing: WordItem[], incoming: WordItem[]): { merged: WordItem[]; addedCount: number; duplicatesCount: number }`

- [ ] **Step 1: Write the failing tests in `tests/words.test.ts`**
  - Тест валидации корректного JSON-массива.
  - Тест обработки невалидного JSON и неверных структур (объекты без `en` или `ru`).
  - Тест дедупликации с учетом регистра и пробелов (`"  Apple "` vs `"apple"`).
  - Тест слияния двух списков с подсчетом новых и дубликатов.

- [ ] **Step 2: Run test to verify it fails**
  Run: `rtk bun test tests/words.test.ts`
  Expected: FAIL (модули `src/types.ts` и `src/storage/words.ts` отсутствуют).

- [ ] **Step 3: Implement `src/types.ts` and `src/storage/words.ts`**
  - Реализовать чистые функции `normalizeKey`, `validateWordsJson`, `mergeWords`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `rtk bun test tests/words.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run: `rtk git add src/types.ts src/storage/words.ts tests/words.test.ts && rtk oco`

---

### Task 3: GitHub Contents API Client & UTF-8 Base64 Helpers

**Files:**
- Create: `src/api/github.ts`
- Test: `tests/github.test.ts`

**Interfaces:**
- Consumes: `AppConfig`, `WordItem` из `src/types.ts`
- Produces:
  - `export function encodeBase64Utf8(str: string): string`
  - `export function decodeBase64Utf8(b64: string): string`
  - `export async function fetchRepoWords(config: AppConfig, customFetch?: typeof fetch): Promise<{ words: WordItem[]; sha: string }>`
  - `export async function updateRepoWords(config: AppConfig, words: WordItem[], sha: string, customFetch?: typeof fetch): Promise<{ success: boolean; newSha: string }>`

- [ ] **Step 1: Write failing tests in `tests/github.test.ts`**
  - Тест `encodeBase64Utf8` / `decodeBase64Utf8` для русских символов (UTF-8).
  - Тест `fetchRepoWords` с мок-ответом GitHub API (`sha`, `content`).
  - Тест `updateRepoWords` с проверкой передаваемых заголовков авторизации и payload.
  - Тест обработки ошибок авторизации (401/404/409 Conflict).

- [ ] **Step 2: Run test to verify it fails**
  Run: `rtk bun test tests/github.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implement `src/api/github.ts`**
  - Реализация кодеров UTF-8 через `TextEncoder` / `TextDecoder`.
  - Реализация методов работы с REST API GitHub `/repos/{owner}/{repo}/contents/{path}`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `rtk bun test tests/github.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run: `rtk git add src/api/github.ts tests/github.test.ts && rtk oco`

---

### Task 4: Reactive State Store & LocalStorage Config

**Files:**
- Create: `src/state/store.ts`
- Test: `tests/store.test.ts`

**Interfaces:**
- Consumes: `WordItem`, `AppConfig` из `src/types.ts`, функции из `src/storage/words.ts` и `src/api/github.ts`
- Produces:
  - `class DeckStore`: управление списком слов, текущим индексом, состоянием переворота, загрузкой, сохранением настроек.
  - Методы: `next()`, `prev()`, `shuffle()`, `flip()`, `getCurrentCard()`, `importWords(jsonText: string): Promise<{ added: number; duplicates: number }>`, `saveConfig(config: AppConfig)`.

- [ ] **Step 1: Write failing tests in `tests/store.test.ts`**
  - Тест навигации (`next`, `prev`, зацикливание или границы списка).
  - Тест перемешивания (`shuffle`).
  - Тест переворота (`flip`).
  - Тест импорта слов и сохранения в `localStorage`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `rtk bun test tests/store.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implement `src/state/store.ts`**
  - Реализовать `DeckStore` с подпиской на события (`listeners`) для обновления интерфейса.

- [ ] **Step 4: Run test to verify it passes**
  Run: `rtk bun test tests/store.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  Run: `rtk git add src/state/store.ts tests/store.test.ts && rtk oco`

---

### Task 5: UI Card Component, Navigation & CSS Styling

**Files:**
- Create: `src/ui/card.ts`
- Create: `src/style.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: `DeckStore` из `src/state/store.ts`
- Produces: Отображение 3D флип-карточки, навигационных кнопок, прогресс-бара и биндингов клавиатуры (Space/Enter/Стрелки).

- [ ] **Step 1: Implement responsive CSS in `src/style.css`**
  - Адаптивный контейнер для мобильных устройств.
  - Стили 3D-переворота (`transform-style: preserve-3d`, `perspective: 1000px`, `backface-visibility: hidden`).
  - Кнопки навигации, прогресс `X / Y`, touch-состояния (`:active`, предотвращение выделения текста `user-select: none`).

- [ ] **Step 2: Implement `src/ui/card.ts`**
  - Рендеринг карточки: английское слово спереди, перевод сзади.
  - Обработка клика/тапа для флипа.
  - Обработчики кнопок «Назад», «Вперед», «Случайная».
  - Поддержка горячих клавиш (Space/ArrowLeft/ArrowRight).

- [ ] **Step 3: Verify build and card rendering**
  Run: `rtk bun run build`
  Expected: Сборка без ошибок.

- [ ] **Step 4: Commit**
  Run: `rtk git add src/ui/card.ts src/style.css index.html && rtk oco`

---

### Task 6: Import & Settings Modals

**Files:**
- Create: `src/ui/importModal.ts`
- Create: `src/ui/settingsModal.ts`
- Modify: `src/main.ts`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: `DeckStore` из `src/state/store.ts`, `validateWordsJson`
- Produces: Модальное окно импорта JSON и модальное окно настроек GitHub PAT.

- [ ] **Step 1: Implement `src/ui/settingsModal.ts`**
  - Поля: GitHub Personal Access Token (тип `password`), Owner, Repo, Branch, FilePath.
  - Кнопка «Проверить соединение» с выводом статуса.
  - Кнопка «Сохранить».

- [ ] **Step 2: Implement `src/ui/importModal.ts`**
  - Textarea для вставки JSON.
  - Кнопка «Валидация»: парсинг и отображение счетчиков («Найдено: X, Новых: Y, Дубликатов: Z»).
  - Кнопка «Сохранить»: пуш в GitHub API или локальное сохранение + скачивание `words.json`.
  - Индикатор выполнения и понятные сообщения об ошибках.

- [ ] **Step 3: Connect components in `src/main.ts`**
  - Инициализация стора, подписка компонентов, привязка к DOM.

- [ ] **Step 4: Verify full app build**
  Run: `rtk bun run build`
  Expected: Сборка `dist/` завершается успешно.

- [ ] **Step 5: Commit**
  Run: `rtk git add src/ui/importModal.ts src/ui/settingsModal.ts src/main.ts src/style.css && rtk oco`

---

### Task 7: GitHub Actions Workflow for GitHub Pages Deployment & Final Verification

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `dist/` артефакты сборки Vite
- Produces: Автоматический пайплайн деплоя на GitHub Pages при пуше в ветку `main`.

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**
  - Шаги: checkout, setup bun, install dependencies (`bun install --frozen-lockfile`), build (`bun run build`), upload pages artifact, deploy to GitHub Pages.

- [ ] **Step 2: Create `README.md`**
  - Инструкция по использованию приложения, выпуску GitHub PAT и настройке GitHub Pages.

- [ ] **Step 3: Run comprehensive verification**
  Run: `rtk bun test && rtk bun run build`
  Expected: Все тесты проходят (PASS), сборка завершается без ошибок.

- [ ] **Step 4: Commit**
  Run: `rtk git add .github/workflows/deploy.yml README.md && rtk oco`
