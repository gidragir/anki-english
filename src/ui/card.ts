import type { DeckStore } from '../state/store';

export class CardUI {
  private store: DeckStore;
  private cardEl: HTMLElement;
  private frontWordEl: HTMLElement;
  private backWordEl: HTMLElement;
  private counterEl: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private shuffleBtn: HTMLButtonElement;
  private statusEl: HTMLElement;

  constructor(store: DeckStore) {
    this.store = store;

    this.cardEl = document.getElementById('flashcard') as HTMLElement;
    this.frontWordEl = document.getElementById('front-word') as HTMLElement;
    this.backWordEl = document.getElementById('back-word') as HTMLElement;
    this.counterEl = document.getElementById('deck-counter') as HTMLElement;
    this.prevBtn = document.getElementById('btn-prev') as HTMLButtonElement;
    this.nextBtn = document.getElementById('btn-next') as HTMLButtonElement;
    this.shuffleBtn = document.getElementById('btn-shuffle') as HTMLButtonElement;
    this.statusEl = document.getElementById('quick-status') as HTMLElement;

    this.initEvents();
    this.render();
    this.store.subscribe(() => this.render());
  }

  private initEvents(): void {
    // Flip on click / tap
    this.cardEl.addEventListener('click', () => {
      this.store.flip();
    });

    // Navigation buttons
    this.prevBtn.addEventListener('click', () => {
      this.store.prev();
    });

    this.nextBtn.addEventListener('click', () => {
      this.store.next();
    });

    this.shuffleBtn.addEventListener('click', () => {
      this.store.shuffle();
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Don't trigger shortcuts if any modal dialog is currently visible
      const isModalOpen = Boolean(document.querySelector('.modal-overlay:not(.hidden)'));
      if (isModalOpen) {
        return;
      }

      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'button') {
        if (e.code === 'Space' || e.code === 'Enter') {
          return;
        }
      }

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        this.store.flip();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        this.store.next();
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        this.store.prev();
      }
    });
  }

  public render(): void {
    const state = this.store.getState();

    // Render flip animation
    if (state.isFlipped) {
      this.cardEl.classList.add('is-flipped');
    } else {
      this.cardEl.classList.remove('is-flipped');
    }

    // Render words
    if (state.currentCard) {
      this.frontWordEl.textContent = state.currentCard.en;
      this.backWordEl.textContent = state.currentCard.ru;
      this.counterEl.textContent = `${state.currentIndex + 1} / ${state.totalCount}`;
      this.prevBtn.disabled = state.totalCount <= 1;
      this.nextBtn.disabled = state.totalCount <= 1;
    } else {
      this.frontWordEl.textContent = 'Нет слов';
      this.backWordEl.textContent = 'Добавьте слова';
      this.counterEl.textContent = '0 / 0';
      this.prevBtn.disabled = true;
      this.nextBtn.disabled = true;
    }

    // Status message
    this.statusEl.textContent = state.statusMessage;
  }
}
