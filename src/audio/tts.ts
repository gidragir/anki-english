/**
 * Web Speech API (speechSynthesis) service.
 * Runs completely client-side without backend or external APIs.
 */
export class SpeechService {
  private isSpeaking: boolean = false;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private onStateChange?: (speaking: boolean) => void;
  private onError?: (errorMessage: string) => void;

  constructor(
    onStateChange?: (speaking: boolean) => void,
    onError?: (errorMessage: string) => void
  ) {
    this.onStateChange = onStateChange;
    this.onError = onError;

    if (this.isSupported()) {
      // Warm up voices collection for Chromium/Safari
      window.speechSynthesis.getVoices();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      }
    }
  }

  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }

  public speak(text: string): void {
    if (!this.isSupported() || !text || !text.trim()) {
      return;
    }

    // Cancel ongoing synthesis to prevent lag or queue pileup
    this.stop();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    this.activeUtterance = utterance;
    utterance.lang = 'en-US';
    utterance.rate = 0.95;

    // Pick best matching English voice if available
    const voices = window.speechSynthesis.getVoices();
    const enVoice =
      voices.find((v) => v.lang === 'en-US') ||
      voices.find((v) => v.lang === 'en-GB') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en'));

    if (enVoice) {
      utterance.voice = enVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.onStateChange?.(true);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.activeUtterance = null;
      this.onStateChange?.(false);
    };

    utterance.onerror = (event) => {
      this.isSpeaking = false;
      this.activeUtterance = null;
      this.onStateChange?.(false);

      if (event.error === 'synthesis-failed') {
        this.onError?.('Ошибка синтеза речи: в системе отсутствуют голоса TTS (на Linux требуется speech-dispatcher)');
      } else if (event.error === 'not-allowed') {
        this.onError?.('Синтез речи заблокирован политикой автовоспроизведения браузера');
      } else if (event.error !== 'canceled' && event.error !== 'interrupted') {
        this.onError?.(`Ошибка синтеза речи: ${event.error}`);
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  public stop(): void {
    if (this.isSupported()) {
      window.speechSynthesis.cancel();
    }
    if (this.activeUtterance) {
      this.activeUtterance = null;
    }
    this.isSpeaking = false;
    this.onStateChange?.(false);
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}
