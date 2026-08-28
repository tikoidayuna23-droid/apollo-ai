import { ISpeechSynthesisProvider, VoiceSettings } from './types';
import { roboticAudio } from '../utils/audio-effects';
import { logger } from '../utils/logger';

export class BrowserSpeechSynthesisProvider implements ISpeechSynthesisProvider {
  private utterance: SpeechSynthesisUtterance | null = null;
  private speaking: boolean = false;

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (!this.isSupported()) return [];
    return window.speechSynthesis.getVoices();
  }

  speak(
    text: string,
    settings: VoiceSettings,
    callbacks?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (error: string) => void;
    }
  ): void {
    if (!this.isSupported()) {
      callbacks?.onError?.('Speech synthesis not supported in this browser.');
      callbacks?.onEnd?.();
      return;
    }

    if (!settings.voiceEnabled) {
      callbacks?.onEnd?.();
      return;
    }

    // Cancel any ongoing speech
    this.stop();

    // Clean text for speech: remove code blocks, markdown symbols, asterisks, brackets
    const speechText = this.cleanTextForSpeech(text);
    if (!speechText.trim()) {
      callbacks?.onEnd?.();
      return;
    }

    // Play optional sci-fi robotic comms chime
    if (settings.soundEffectsEnabled !== false) {
      roboticAudio.playCommsOpen();
    }

    try {
      this.utterance = new SpeechSynthesisUtterance(speechText);
      this.utterance.rate = Math.max(0.4, Math.min(2.0, settings.speechRate || 0.86));
      this.utterance.pitch = Math.max(0.1, Math.min(2.0, settings.pitch !== undefined ? settings.pitch : 0.40));
      this.utterance.volume = Math.max(0.0, Math.min(1.0, settings.volume ?? 1.0));

      const voices = this.getVoices();
      if (settings.selectedVoiceURI && voices.length > 0) {
        const found = voices.find((v) => v.voiceURI === settings.selectedVoiceURI);
        if (found) {
          this.utterance.voice = found;
        }
      } else if (voices.length > 0) {
        // Find best male / robotic / AI voice
        const preferredVoice = this.findBestDeepMaleRoboticVoice(voices);
        if (preferredVoice) {
          this.utterance.voice = preferredVoice;
        }
      }

      this.utterance.onstart = () => {
        this.speaking = true;
        logger.info('SpeechSynthesis', 'Speech started');
        callbacks?.onStart?.();
      };

      this.utterance.onend = () => {
        this.speaking = false;
        this.utterance = null;
        logger.info('SpeechSynthesis', 'Speech finished');
        callbacks?.onEnd?.();
      };

      this.utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        this.speaking = false;
        this.utterance = null;
        logger.warn('SpeechSynthesis', `Speech error: ${event.error}`);
        // "canceled" or "interrupted" is normal when user stops or starts new input
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          callbacks?.onError?.(`Speech synthesis error: ${event.error}`);
        }
        callbacks?.onEnd?.();
      };

      window.speechSynthesis.speak(this.utterance);
    } catch (err: unknown) {
      this.speaking = false;
      const msg = err instanceof Error ? err.message : 'Speech synthesis failed';
      logger.error('SpeechSynthesis', 'Exception during speak:', err);
      callbacks?.onError?.(msg);
      callbacks?.onEnd?.();
    }
  }

  stop(): void {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        logger.warn('SpeechSynthesis', 'Error cancelling speech:', err);
      }
    }
    this.speaking = false;
    this.utterance = null;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  private cleanTextForSpeech(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/`([^`]+)`/g, '$1')     // remove inline code ticks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links -> text
      .replace(/[*_~#]/g, '')         // remove markdown symbols
      .replace(/[:;]\)|[:;]D|:\(/g, '') // remove ASCII emoticons
      .replace(/\s+/g, ' ')           // normalize whitespace
      .trim();
  }

  /**
   * Selects the most optimal deep masculine, robotic, or AI voice available on the host system.
   */
  public findBestDeepMaleRoboticVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (!voices || voices.length === 0) return null;

    const femaleKeywords = [
      'female', 'samantha', 'victoria', 'karen', 'zira', 'susan', 'hazel', 'jenny',
      'aria', 'ava', 'allison', 'catherine', 'fiona', 'moira', 'tessa', 'veena', 'yuri',
    ];
    const isFemale = (name: string) => femaleKeywords.some(f => name.toLowerCase().includes(f));

    // Priority Tier 1: Dedicated synthetic robotic or deep masculine voices (Fred, Zarvox, David, Mark, Alex, Google US English Male)
    const roboticMaleKeywords = [
      'zarvox', 'fred', 'david', 'mark', 'google us english male', 'google uk english male',
      'daniel', 'robotic', 'robot', 'synthesizer', 'richard', 'george', 'ryan', 'oliver', 'guy', 'natural male', 'male'
    ];
    const tier1 = voices.find(
      (v) => v.lang.startsWith('en') &&
             roboticMaleKeywords.some(k => v.name.toLowerCase().includes(k)) &&
             !isFemale(v.name)
    );
    if (tier1) return tier1;

    // Priority Tier 2: Any English voice that is not explicitly female
    const tier2 = voices.find(
      (v) => v.lang.startsWith('en') && !isFemale(v.name)
    );
    if (tier2) return tier2;

    // Priority Tier 3: Fallback to any English voice
    return voices.find((v) => v.lang.startsWith('en')) || voices[0];
  }

  public findBestJarvisMaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    return this.findBestDeepMaleRoboticVoice(voices);
  }
}
