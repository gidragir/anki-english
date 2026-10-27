import type { WordItem, ValidationResult, MergeResult } from '../types';

export function normalizeKey(en: string): string {
  return en.trim().toLowerCase();
}

export function validateWordsJson(raw: string): ValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { valid: false, error: 'Входной текст пуст' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return { valid: false, error: `Синтаксическая ошибка JSON: ${(e as Error).message}` };
  }

  if (!Array.isArray(parsed)) {
    return { valid: false, error: 'JSON должен быть массивом объектов вида [{"en": "...", "ru": "..."}]' };
  }

  const validWords: WordItem[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Элемент #${i + 1} не является объектом` };
    }
    const { en, ru } = item as { en?: unknown; ru?: unknown };
    if (typeof en !== 'string' || typeof ru !== 'string') {
      return { valid: false, error: `Элемент #${i + 1} должен содержать строковые поля "en" и "ru"` };
    }
    const cleanEn = en.trim();
    const cleanRu = ru.trim();
    if (!cleanEn || !cleanRu) {
      return { valid: false, error: `Элемент #${i + 1} содержит пустые значения для слова или перевода` };
    }
    validWords.push({ en: cleanEn, ru: cleanRu });
  }

  return { valid: true, data: validWords };
}

export function mergeWords(existing: WordItem[], incoming: WordItem[]): MergeResult {
  const existingMap = new Map<string, WordItem>();

  for (const item of existing) {
    existingMap.set(normalizeKey(item.en), item);
  }

  const merged = [...existing];
  let addedCount = 0;
  let duplicatesCount = 0;

  for (const item of incoming) {
    const key = normalizeKey(item.en);
    if (existingMap.has(key)) {
      duplicatesCount++;
    } else {
      existingMap.set(key, item);
      merged.push(item);
      addedCount++;
    }
  }

  return {
    merged,
    addedCount,
    duplicatesCount,
  };
}
