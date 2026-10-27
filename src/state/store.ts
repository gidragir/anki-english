import type { WordItem, AppConfig } from '../types';
import { mergeWords } from '../storage/words';
import { fetchRepoWords, updateRepoWords } from '../api/github';

const CONFIG_STORAGE_KEY = 'anki_config';
const LOCAL_WORDS_STORAGE_KEY = 'anki_local_words';

export type StateListener = () => void;

export class DeckStore {
  private words: WordItem[] = [];
  private currentIndex: number = 0;
  private isFlipped: boolean = false;
  private config: AppConfig = {};
  private statusMessage: string = '';
  private isSyncing: boolean = false;
  private listeners: Set<StateListener> = new Set();

  constructor() {
    this.config = this.loadConfig();
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getState() {
    return {
      words: this.words,
      currentIndex: this.currentIndex,
      currentCard: this.getCurrentCard(),
      isFlipped: this.isFlipped,
      totalCount: this.words.length,
      config: this.config,
      statusMessage: this.statusMessage,
      isSyncing: this.isSyncing,
      hasGithubConfig: Boolean(this.config.githubToken && this.config.repoOwner && this.config.repoName),
    };
  }

  public getCurrentCard(): WordItem | null {
    if (this.words.length === 0) return null;
    const index = Math.max(0, Math.min(this.currentIndex, this.words.length - 1));
    return this.words[index];
  }

  public setStatus(msg: string): void {
    this.statusMessage = msg;
    this.notify();
  }

  public loadConfig(): AppConfig {
    try {
      const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as AppConfig;
      }
    } catch (e) {
      console.error('Failed to parse config from localStorage', e);
    }
    return {
      branch: 'main',
      filePath: 'public/words.json',
    };
  }

  public saveConfig(newConfig: AppConfig): void {
    this.config = {
      ...this.config,
      ...newConfig,
    };
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.config));
    } catch (e) {
      console.error('Failed to save config to localStorage', e);
    }
    this.notify();
  }

  public async initDeck(): Promise<void> {
    this.isSyncing = true;
    this.setStatus('Загрузка словаря...');

    // Try fetching from GitHub if configured
    if (this.config.githubToken && this.config.repoOwner && this.config.repoName) {
      try {
        const repoData = await fetchRepoWords(this.config);
        this.words = repoData.words;
        this.saveToLocalCache(this.words);
        this.setStatus(`Словарь синхронизирован с GitHub (${this.words.length} слов)`);
        this.isSyncing = false;
        this.currentIndex = 0;
        this.isFlipped = false;
        this.notify();
        return;
      } catch (err) {
        console.warn('Не удалось загрузить из GitHub, пробуем локальный fallback:', err);
      }
    }

    // Try local cached words
    const localCached = this.loadLocalCache();
    if (localCached && localCached.length > 0) {
      this.words = localCached;
      this.setStatus(`Загружено из локального кэша (${this.words.length} слов)`);
      this.isSyncing = false;
      this.currentIndex = 0;
      this.isFlipped = false;
      this.notify();
      return;
    }

    // Fallback to static words.json bundled with the site
    try {
      const res = await fetch('./words.json');
      if (res.ok) {
        const data = (await res.json()) as WordItem[];
        this.words = data;
        this.saveToLocalCache(this.words);
        this.setStatus(`Загружен базовый словарь (${this.words.length} слов)`);
      } else {
        this.words = [
          { en: 'clean', ru: 'чистый' },
          { en: 'improve', ru: 'улучшать' },
        ];
        this.setStatus('Используется демо-словарь');
      }
    } catch (e) {
      this.words = [
        { en: 'clean', ru: 'чистый' },
        { en: 'improve', ru: 'улучшать' },
      ];
      this.setStatus('Используется демо-словарь');
    }

    this.isSyncing = false;
    this.currentIndex = 0;
    this.isFlipped = false;
    this.notify();
  }

  private loadLocalCache(): WordItem[] | null {
    try {
      const raw = localStorage.getItem(LOCAL_WORDS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error('Error reading local word cache', e);
    }
    return null;
  }

  private saveToLocalCache(words: WordItem[]): void {
    try {
      localStorage.setItem(LOCAL_WORDS_STORAGE_KEY, JSON.stringify(words));
    } catch (e) {
      console.error('Error saving local word cache', e);
    }
  }

  public next(): void {
    if (this.words.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.words.length;
    this.isFlipped = false;
    this.notify();
  }

  public prev(): void {
    if (this.words.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.words.length) % this.words.length;
    this.isFlipped = false;
    this.notify();
  }

  public flip(): void {
    this.isFlipped = !this.isFlipped;
    this.notify();
  }

  public shuffle(): void {
    if (this.words.length <= 1) return;
    // Fisher-Yates shuffle
    const shuffled = [...this.words];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.words = shuffled;
    this.currentIndex = 0;
    this.isFlipped = false;
    this.setStatus('Карточки перемешаны');
    this.notify();
  }

  public async importWords(incoming: WordItem[]): Promise<{
    added: number;
    duplicates: number;
    syncedToGithub: boolean;
  }> {
    let syncedToGithub = false;
    let addedCount = 0;
    let duplicatesCount = 0;

    // If GitHub config is active, fetch fresh remote words first to prevent data loss & conflicts
    if (this.config.githubToken && this.config.repoOwner && this.config.repoName) {
      this.isSyncing = true;
      this.setStatus('Синхронизация с удаленным репозиторием GitHub...');
      this.notify();

      try {
        const fresh = await fetchRepoWords(this.config);
        // Merge remote words with currently loaded words first, then with incoming
        const baseMerge = mergeWords(fresh.words, this.words);
        const fullMerge = mergeWords(baseMerge.merged, incoming);

        this.words = fullMerge.merged;
        addedCount = fullMerge.addedCount;
        duplicatesCount = fullMerge.duplicatesCount;
        this.saveToLocalCache(this.words);

        this.setStatus('Отправка обновленного словаря в GitHub...');
        this.notify();

        await updateRepoWords(this.config, this.words, fresh.sha);
        syncedToGithub = true;
        this.setStatus(`Словарь успешно обновлен в GitHub! (+${addedCount} новых слов)`);
      } catch (err) {
        console.error('Failed to sync to GitHub:', err);
        this.setStatus(`Ошибка GitHub: ${(err as Error).message}`);
        throw err;
      } finally {
        this.isSyncing = false;
        this.notify();
      }
    } else {
      // Local-only mode
      const mergeResult = mergeWords(this.words, incoming);
      this.words = mergeResult.merged;
      addedCount = mergeResult.addedCount;
      duplicatesCount = mergeResult.duplicatesCount;
      this.saveToLocalCache(this.words);
      this.setStatus(`Слова добавлены локально (+${addedCount} слов). Настройте GitHub для синхронизации.`);
      this.notify();
    }

    return {
      added: addedCount,
      duplicates: duplicatesCount,
      syncedToGithub,
    };
  }

  public downloadWordsJson(): void {
    const jsonStr = JSON.stringify(this.words, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'words.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
