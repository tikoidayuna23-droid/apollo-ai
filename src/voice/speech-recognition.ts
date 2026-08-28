import { ISpeechRecognitionProvider, SpeechRecognitionResultPayload } from './types';
import { logger } from '../utils/logger';

// Type definitions for Web Speech API
interface IWindowSpeechRecognition extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export class BrowserSpeechRecognitionProvider implements ISpeechRecognitionProvider {
  private recognition: any = null;
  private listening: boolean = false;
  private shouldKeepListening: boolean = false;
  private isPausedForTTS: boolean = false;
  private restartTimer: any = null;
  private callbacks?: {
    onResult: (result: SpeechRecognitionResultPayload) => void;
    onError: (error: string) => void;
    onEnd: () => void;
    onStart?: () => void;
  };

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as IWindowSpeechRecognition;
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  startListening(
    callbacks: {
      onResult: (result: SpeechRecognitionResultPayload) => void;
      onError: (error: string) => void;
      onEnd: () => void;
      onStart?: () => void;
    },
    continuous: boolean = false
  ): void {
    if (!this.isSupported()) {
      callbacks.onError('Web Speech Recognition is not supported in this browser.');
      return;
    }

    this.shouldKeepListening = continuous;
    this.isPausedForTTS = false;
    this.callbacks = callbacks;

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.listening && this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
    }

    this.initAndStartRecognition(continuous);
  }

  private initAndStartRecognition(continuous: boolean): void {
    const win = window as IWindowSpeechRecognition;
    const SpeechRecognitionConstructor = win.SpeechRecognition || win.webkitSpeechRecognition;

    try {
      this.recognition = new SpeechRecognitionConstructor();
      this.recognition.continuous = continuous;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.listening = true;
        logger.info('SpeechRecognition', `Recognition active (continuous: ${continuous}).`);
        this.callbacks?.onStart?.();
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0]?.transcript || '';
          if (event.results[i].isFinal) {
            finalTranscript += trans;
          } else {
            interimTranscript += trans;
          }
        }

        const transcript = (finalTranscript || interimTranscript).trim();
        const isFinal = Boolean(finalTranscript.trim());
        const confidence = event.results[0]?.[0]?.confidence || 0.9;

        if (transcript) {
          this.callbacks?.onResult({
            transcript,
            isFinal,
            confidence,
          });
        }
      };

      this.recognition.onerror = (event: any) => {
        logger.warn('SpeechRecognition', `Recognition event: ${event.error}`);

        // In continuous hands-free mode, 'no-speech' is routine while waiting for user voice
        if (event.error === 'no-speech') {
          if (this.shouldKeepListening && !this.isPausedForTTS) {
            // Keep listening quietly without raising user-facing errors
            return;
          }
        }

        if (event.error === 'aborted') {
          return;
        }

        this.listening = false;

        let userMsg = `Speech recognition error: ${event.error}`;
        if (event.error === 'not-allowed') {
          this.shouldKeepListening = false;
          userMsg = 'Microphone permission denied. Please allow microphone access in browser settings.';
          this.callbacks?.onError(userMsg);
        } else if (event.error === 'network') {
          userMsg = 'Network interruption in speech service.';
          if (!this.shouldKeepListening) {
            this.callbacks?.onError(userMsg);
          }
        }
      };

      this.recognition.onend = () => {
        this.listening = false;
        logger.info('SpeechRecognition', 'Recognition cycle ended.');

        // If continuous direct detection is active and not explicitly paused for Apollo speaking, auto-restart!
        if (this.shouldKeepListening && !this.isPausedForTTS) {
          if (this.restartTimer) clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            if (this.shouldKeepListening && !this.isPausedForTTS) {
              try {
                this.initAndStartRecognition(true);
              } catch (e) {
                logger.warn('SpeechRecognition', 'Auto-restart retry', e);
              }
            }
          }, 120);
        } else {
          this.callbacks?.onEnd();
        }
      };

      this.recognition.start();
    } catch (err: unknown) {
      this.listening = false;
      const msg = err instanceof Error ? err.message : 'Could not initialize speech recognition';
      logger.error('SpeechRecognition', 'Start failed:', err);
      if (!this.shouldKeepListening) {
        this.callbacks?.onError(msg);
      }
    }
  }

  /**
   * Pause listening while Apollo is vocalizing his response (avoids echo / self-listening).
   */
  pauseForSpeech(): void {
    this.isPausedForTTS = true;
    if (this.recognition && this.listening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
    }
    this.listening = false;
  }

  /**
   * Resume listening after Apollo finishes speaking.
   */
  resumeAfterSpeech(): void {
    if (!this.shouldKeepListening) return;
    this.isPausedForTTS = false;
    if (!this.listening) {
      if (this.restartTimer) clearTimeout(this.restartTimer);
      this.restartTimer = setTimeout(() => {
        if (this.shouldKeepListening && !this.isPausedForTTS) {
          this.initAndStartRecognition(true);
        }
      }, 150);
    }
  }

  stopListening(): void {
    this.shouldKeepListening = false;
    this.isPausedForTTS = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.recognition && this.listening) {
      try {
        this.recognition.stop();
      } catch (err) {
        logger.warn('SpeechRecognition', 'Error stopping recognition:', err);
      }
    }
    this.listening = false;
  }

  isListening(): boolean {
    return this.listening;
  }

  isContinuous(): boolean {
    return this.shouldKeepListening;
  }
}

