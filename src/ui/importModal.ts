import type { DeckStore } from '../state/store';
import { validateWordsJson } from '../storage/words';
import type { WordItem } from '../types';

export class ImportModalUI {
  private store: DeckStore;
  private modalEl: HTMLElement;
  private openBtn: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;
  private textareaEl: HTMLTextAreaElement;
  private validateBtn: HTMLButtonElement;
  private saveBtn: HTMLButtonElement;
  private previewEl: HTMLElement;
  private validWordsCache: WordItem[] | null = null;

  constructor(store: DeckStore) {
    this.store = store;

    this.modalEl = document.getElementById('modal-import') as HTMLElement;
    this.openBtn = document.getElementById('btn-import') as HTMLButtonElement;
    this.closeBtn = document.getElementById('btn-close-import') as HTMLButtonElement;
    this.textareaEl = document.getElementById('import-json-input') as HTMLTextAreaElement;
    this.validateBtn = document.getElementById('btn-validate-json') as HTMLButtonElement;
    this.saveBtn = document.getElementById('btn-save-words') as HTMLButtonElement;
    this.previewEl = document.getElementById('import-preview') as HTMLElement;

    this.initEvents();
  }

  private initEvents(): void {
    this.openBtn.addEventListener('click', () => this.open());
    this.closeBtn.addEventListener('click', () => this.close());

    // Close on clicking backdrop
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    this.validateBtn.addEventListener('click', () => this.handleValidate());

    this.saveBtn.addEventListener('click', async () => {
      await this.handleSave();
    });

    // Auto validate on input paste
    this.textareaEl.addEventListener('paste', () => {
      setTimeout(() => this.handleValidate(), 100);
    });
  }

  public open(): void {
    this.modalEl.classList.remove('hidden');
    this.textareaEl.focus();
  }

  public close(): void {
    this.modalEl.classList.add('hidden');
    this.previewEl.classList.add('hidden');
    this.previewEl.textContent = '';
    this.validWordsCache = null;
    this.saveBtn.disabled = true;
  }

  private handleValidate(): boolean {
    const raw = this.textareaEl.value;
    const res = validateWordsJson(raw);

    this.previewEl.classList.remove('hidden', 'status-success', 'status-error');

    if (!res.valid || !res.data) {
      this.previewEl.classList.add('status-error');
      this.previewEl.textContent = res.error || 'Ошибка формата JSON';
      this.saveBtn.disabled = true;
      this.validWordsCache = null;
      return false;
    }

    this.validWordsCache = res.data;
    const state = this.store.getState();
    const existingKeys = new Set(state.words.map((w) => w.en.trim().toLowerCase()));

    let newCount = 0;
    let duplicateCount = 0;

    for (const w of res.data) {
      if (existingKeys.has(w.en.trim().toLowerCase())) {
        duplicateCount++;
      } else {
        newCount++;
      }
    }

    this.previewEl.classList.add('status-success');
    this.previewEl.textContent = `✓ Найдено слов: ${res.data.length} (Новых: ${newCount}, Дубликатов: ${duplicateCount})`;
    this.saveBtn.disabled = res.data.length === 0;
    return true;
  }

  private async handleSave(): Promise<void> {
    if (!this.validWordsCache) {
      if (!this.handleValidate() || !this.validWordsCache) {
        return;
      }
    }

    this.saveBtn.disabled = true;
    this.saveBtn.textContent = 'Сохранение...';

    try {
      const res = await this.store.importWords(this.validWordsCache);

      let msg = `Добавлено ${res.added} слов.`;
      if (res.syncedToGithub) {
        msg += ' Синхронизировано с GitHub репозиторием!';
      } else {
        msg += ' Сохранено локально.';
      }

      alert(msg);
      this.textareaEl.value = '';
      this.close();
    } catch (err) {
      this.previewEl.classList.remove('hidden', 'status-success');
      this.previewEl.classList.add('status-error');
      this.previewEl.textContent = `Ошибка сохранения в GitHub: ${(err as Error).message}. Проверьте токен в настройках.`;
    } finally {
      this.saveBtn.textContent = 'Сохранить';
      this.saveBtn.disabled = false;
    }
  }
}
