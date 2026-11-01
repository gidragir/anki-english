import type { DeckStore } from '../state/store';
import { SpeechService } from '../audio/tts';

export class CardUI {
  private store: DeckStore;
  private speechService: SpeechService;
  private cardEl: HTMLElement;
  private frontWordEl: HTMLElement;
  private backWordEl: HTMLElement;
  private counterEl: HTMLElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private shuffleBtn: HTMLButtonElement;
  private ttsBtn: HTMLButtonElement;
  private statusEl: HTMLElement;

  constructor(store: DeckStore) {
    this.store = store;
    this.speechService = new SpeechService(
      (speaking) => {
        this.updateTTSButtonState(speaking);
      },
      (errorMsg) => {
        this.store.setStatus(errorMsg);
      }
    );

    this.cardEl = document.getElementById('flashcard') as HTMLElement;
    this.frontWordEl = document.getElementById('front-word') as HTMLElement;
    this.backWordEl = document.getElementById('back-word') as HTMLElement;
    this.counterEl = document.getElementById('deck-counter') as HTMLElement;
    this.prevBtn = document.getElementById('btn-prev') as HTMLButtonElement;
    this.nextBtn = document.getElementById('btn-next') as HTMLButtonElement;
    this.shuffleBtn = document.getElementById('btn-shuffle') as HTMLButtonElement;
    this.ttsBtn = document.getElementById('btn-tts') as HTMLButtonElement;
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
      this.speechService.stop();
      this.store.prev();
    });

    this.nextBtn.addEventListener('click', () => {
      this.speechService.stop();
      this.store.next();
    });

    this.shuffleBtn.addEventListener('click', () => {
      this.speechService.stop();
      this.store.shuffle();
    });

    // TTS button
    this.ttsBtn.addEventListener('click', () => {
      this.toggleSpeech();
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
        this.speechService.stop();
        this.store.next();
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        this.speechService.stop();
        this.store.prev();
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        this.toggleSpeech();
      }
    });
  }

  private toggleSpeech(): void {
    if (this.speechService.getIsSpeaking()) {
      this.speechService.stop();
      return;
    }

    const state = this.store.getState();
    if (state.currentCard?.en) {
      this.speechService.speak(state.currentCard.en);
    }
  }

  private updateTTSButtonState(isSpeaking: boolean): void {
    if (isSpeaking) {
      this.ttsBtn.classList.add('is-speaking');
      this.ttsBtn.title = 'Остановить озвучку (S)';
    } else {
      this.ttsBtn.classList.remove('is-speaking');
      const hasCard = Boolean(this.store.getState().currentCard);
      this.ttsBtn.title = hasCard ? 'Озвучить английский текст (S)' : 'Нет активной карточки';
    }
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
      this.ttsBtn.disabled = !this.speechService.isSupported();
      this.ttsBtn.title = this.speechService.isSupported()
        ? 'Озвучить английский текст (S)'
        : 'Синтез речи не поддерживается браузером';
    } else {
      this.frontWordEl.textContent = 'Нет слов';
      this.backWordEl.textContent = 'Добавьте слова';
      this.counterEl.textContent = '0 / 0';
      this.prevBtn.disabled = true;
      this.nextBtn.disabled = true;
      this.ttsBtn.disabled = true;
      this.ttsBtn.title = 'Нет слов для озвучки';
    }

    // Status message
    this.statusEl.textContent = state.statusMessage;
  }
}
