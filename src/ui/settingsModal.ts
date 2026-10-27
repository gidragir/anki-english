import type { DeckStore } from '../state/store';
import { fetchRepoWords } from '../api/github';
import type { AppConfig } from '../types';

export class SettingsModalUI {
  private store: DeckStore;
  private modalEl: HTMLElement;
  private openBtn: HTMLButtonElement;
  private closeBtn: HTMLButtonElement;
  private tokenInput: HTMLInputElement;
  private ownerInput: HTMLInputElement;
  private repoInput: HTMLInputElement;
  private branchInput: HTMLInputElement;
  private pathInput: HTMLInputElement;
  private testBtn: HTMLButtonElement;
  private saveBtn: HTMLButtonElement;
  private statusEl: HTMLElement;

  constructor(store: DeckStore) {
    this.store = store;

    this.modalEl = document.getElementById('modal-settings') as HTMLElement;
    this.openBtn = document.getElementById('btn-settings') as HTMLButtonElement;
    this.closeBtn = document.getElementById('btn-close-settings') as HTMLButtonElement;
    this.tokenInput = document.getElementById('cfg-token') as HTMLInputElement;
    this.ownerInput = document.getElementById('cfg-owner') as HTMLInputElement;
    this.repoInput = document.getElementById('cfg-repo') as HTMLInputElement;
    this.branchInput = document.getElementById('cfg-branch') as HTMLInputElement;
    this.pathInput = document.getElementById('cfg-path') as HTMLInputElement;
    this.testBtn = document.getElementById('btn-test-connection') as HTMLButtonElement;
    this.saveBtn = document.getElementById('btn-save-settings') as HTMLButtonElement;
    this.statusEl = document.getElementById('settings-status') as HTMLElement;

    this.initEvents();
  }

  private initEvents(): void {
    this.openBtn.addEventListener('click', () => this.open());
    this.closeBtn.addEventListener('click', () => this.close());

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });

    this.saveBtn.addEventListener('click', () => {
      this.handleSave();
    });

    this.testBtn.addEventListener('click', async () => {
      await this.handleTest();
    });
  }

  public open(): void {
    const config = this.store.getState().config;
    this.tokenInput.value = config.githubToken || '';
    this.ownerInput.value = config.repoOwner || '';
    this.repoInput.value = config.repoName || '';
    this.branchInput.value = config.branch || 'main';
    this.pathInput.value = config.filePath || 'public/words.json';

    this.statusEl.classList.add('hidden');
    this.statusEl.textContent = '';
    this.modalEl.classList.remove('hidden');
  }

  public close(): void {
    this.modalEl.classList.add('hidden');
  }

  private getFormConfig(): AppConfig {
    return {
      githubToken: this.tokenInput.value.trim(),
      repoOwner: this.ownerInput.value.trim(),
      repoName: this.repoInput.value.trim(),
      branch: this.branchInput.value.trim() || 'main',
      filePath: this.pathInput.value.trim() || 'public/words.json',
    };
  }

  private async handleTest(): Promise<void> {
    const config = this.getFormConfig();
    this.statusEl.classList.remove('hidden', 'status-success', 'status-error');

    if (!config.repoOwner || !config.repoName) {
      this.statusEl.classList.add('status-error');
      this.statusEl.textContent = 'Укажите владельца и имя репозитория';
      return;
    }

    this.testBtn.disabled = true;
    this.testBtn.textContent = 'Проверка...';

    try {
      const res = await fetchRepoWords(config);
      this.statusEl.classList.add('status-success');
      this.statusEl.textContent = `✓ Связь установлена! Найдено слов в репозитории: ${res.words.length} (SHA: ${res.sha.slice(0, 7)})`;
    } catch (err) {
      this.statusEl.classList.add('status-error');
      this.statusEl.textContent = `Ошибка подключения: ${(err as Error).message}`;
    } finally {
      this.testBtn.disabled = false;
      this.testBtn.textContent = 'Проверить связь';
    }
  }

  private handleSave(): void {
    const config = this.getFormConfig();
    this.store.saveConfig(config);

    this.statusEl.classList.remove('hidden', 'status-error');
    this.statusEl.classList.add('status-success');
    this.statusEl.textContent = 'Настройки сохранены в локальном хранилище браузера!';

    setTimeout(() => {
      this.close();
      this.store.initDeck();
    }, 600);
  }
}
