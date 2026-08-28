import {
  ISpeechRecognitionProvider,
  ISpeechSynthesisProvider,
  IWakeWordProvider,
  VoiceSettings,
  VoiceProfilePreset,
  SpeechRecognitionResultPayload,
} from './types';
import { BrowserSpeechRecognitionProvider } from './speech-recognition';
import { BrowserSpeechSynthesisProvider } from './speech-synthesis';
import { ApolloAgent } from '../agent/agent';
import { ApolloState } from '../agent/types';
import { db } from '../storage/database';
import { logger } from '../utils/logger';

const VOICE_SETTINGS_KEY = 'apollo_voice_settings';

export const VOICE_PRESETS: Record<
  VoiceProfilePreset,
  { name: string; description: string; pitch: number; speechRate: number }
> = {
  titan_mech: {
    name: 'Titan Cyber-Mech',
    description: 'Extreme sub-bass robotic baritone with heavy mechanical modulation (Uploaded Sample)',
    pitch: 0.10,
    speechRate: 0.80,
  },
  deep_robotic: {
    name: 'Deep Male Robotic',
    description: 'Deep masculine AI voice with synthesized robotic cadence',
    pitch: 0.44,
    speechRate: 0.88,
  },
  ultra_deep: {
    name: 'Sub-Bass Titan',
    description: 'Extreme low-frequency baritone mechanical voice',
    pitch: 0.18,
    speechRate: 0.80,
  },
  jarvis: {
    name: 'J.A.R.V.I.S. Protocol',
    description: 'Sophisticated, articulate British cadence with deep resonant timbre',
    pitch: 0.76,
    speechRate: 0.96,
  },
  standard_male: {
    name: 'Natural Male',
    description: 'Clear, natural conversational male AI voice',
    pitch: 0.85,
    speechRate: 1.0,
  },
  custom: {
    name: 'Custom Calibration',
    description: 'User-defined pitch and speech rate',
    pitch: 0.10,
    speechRate: 0.80,
  },
};

const DEFAULT_SETTINGS: VoiceSettings = {
  voiceEnabled: true,
  selectedVoiceURI: '',
  speechRate: 0.80,
  pitch: 0.10,
  volume: 1.0,
  voicePreset: 'titan_mech',
  soundEffectsEnabled: true,
  continuousListening: true, // Direct Hands-Free Voice Detection enabled by default
  wakeWordEnabled: false,    // Direct Open Mic (processes voice directly without requiring wake word)
};

export class VoiceManager {
  private static instance: VoiceManager;

  private recognitionProvider: BrowserSpeechRecognitionProvider;
  private synthesisProvider: ISpeechSynthesisProvider;
  private wakeWordProvider?: IWakeWordProvider;

  private settings: VoiceSettings;
  private isListeningState: boolean = false;
  private currentTranscript: string = '';
  private activeRecognizeCallback?: (transcript: string) => void;
  private errorListeners: Set<(err: string) => void> = new Set();
  private transcriptListeners: Set<(text: string, isFinal: boolean) => void> = new Set();

  private constructor() {
    this.recognitionProvider = new BrowserSpeechRecognitionProvider();
    this.synthesisProvider = new BrowserSpeechSynthesisProvider();
    
    // Retrieve stored settings or apply deep robotic defaults
    const stored = db.getItem<VoiceSettings | null>(VOICE_SETTINGS_KEY, null);
    if (!stored) {
      this.settings = DEFAULT_SETTINGS;
      db.setItem(VOICE_SETTINGS_KEY, this.settings);
    } else {
      // Update stored settings if on titan_mech or legacy presets to apply lowered pitch (0.10)
      if (!stored.voicePreset || stored.voicePreset === 'titan_mech' || stored.voicePreset === ('deep_robotic' as any) || stored.voicePreset === ('deep_humanoid' as any)) {
        this.settings = { ...stored, pitch: 0.10, speechRate: 0.80, voicePreset: 'titan_mech', soundEffectsEnabled: true, continuousListening: stored.continuousListening ?? true };
        db.setItem(VOICE_SETTINGS_KEY, this.settings);
      } else {
        this.settings = { ...DEFAULT_SETTINGS, ...stored };
      }
    }
  }

  static getInstance(): VoiceManager {
    if (!this.instance) {
      this.instance = new VoiceManager();
    }
    return this.instance;
  }

  getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  applyPreset(preset: VoiceProfilePreset): void {
    const config = VOICE_PRESETS[preset];
    if (config) {
      this.updateSettings({
        voicePreset: preset,
        pitch: config.pitch,
        speechRate: config.speechRate,
      });
    }
  }

  updateSettings(partial: Partial<VoiceSettings>): void {
    this.settings = { ...this.settings, ...partial };
    db.setItem(VOICE_SETTINGS_KEY, this.settings);
    logger.info('VoiceManager', 'Updated voice settings', this.settings);

    // If voice disabled, stop any active speech immediately
    if (this.settings.voiceEnabled === false) {
      this.stopSpeaking();
    }
  }

  isSpeechRecognitionSupported(): boolean {
    return this.recognitionProvider.isSupported();
  }

  isSpeechSynthesisSupported(): boolean {
    return this.synthesisProvider.isSupported();
  }

  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.synthesisProvider.getVoices();
  }

  isListening(): boolean {
    return this.isListeningState;
  }

  isContinuous(): boolean {
    return Boolean(this.settings.continuousListening);
  }

  isSpeaking(): boolean {
    return this.synthesisProvider.isSpeaking();
  }

  onError(cb: (err: string) => void): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  onTranscript(cb: (text: string, isFinal: boolean) => void): () => void {
    this.transcriptListeners.add(cb);
    return () => this.transcriptListeners.delete(cb);
  }

  /**
   * Start listening to the microphone for user speech (supports continuous hands-free voice detection).
   */
  startListening(onRecognized: (transcript: string) => void, continuous?: boolean): void {
    const agent = ApolloAgent.getInstance();
    const useContinuous = continuous !== undefined ? continuous : (this.settings.continuousListening !== false);

    this.activeRecognizeCallback = onRecognized;

    // Stop speaking if Apollo is currently talking
    this.stopSpeaking();

    if (!this.isSpeechRecognitionSupported()) {
      const err = 'Speech recognition is not supported in this browser. Please type your message instead.';
      this.notifyError(err);
      agent.setState('ERROR', err);
      return;
    }

    this.isListeningState = true;
    agent.setState('LISTENING');

    this.recognitionProvider.startListening(
      {
        onStart: () => {
          this.isListeningState = true;
          agent.setState('LISTENING');
        },
        onResult: (res: SpeechRecognitionResultPayload) => {
          this.currentTranscript = res.transcript;
          this.notifyTranscript(res.transcript, res.isFinal);

          if (res.isFinal && res.transcript.trim()) {
            const rawText = res.transcript.trim();

            // Wake word verification if enabled
            if (this.settings.wakeWordEnabled) {
              const lower = rawText.toLowerCase();
              const wakeWords = ['apollo', 'hey apollo', 'hi apollo', 'ok apollo', 'okay apollo'];
              const matchedWake = wakeWords.find((w) => lower.includes(w));

              if (matchedWake) {
                // Strip the wake word prefix/suffix
                const cleaned = rawText
                  .replace(new RegExp(`\\b${matchedWake}\\b`, 'gi'), '')
                  .replace(/^[,.\s]+|[,.\s]+$/g, '')
                  .trim();
                
                const finalCommand = cleaned || rawText;
                if (!useContinuous) {
                  this.isListeningState = false;
                }
                this.activeRecognizeCallback?.(finalCommand);
              }
            } else {
              // Direct Open Mic: process speech command directly!
              if (!useContinuous) {
                this.isListeningState = false;
              }
              this.activeRecognizeCallback?.(rawText);
            }
          }
        },
        onError: (err: string) => {
          if (!useContinuous) {
            this.isListeningState = false;
            this.notifyError(err);
            agent.setState('ERROR', err);
          }
        },
        onEnd: () => {
          if (!useContinuous) {
            this.isListeningState = false;
            if (agent.getState() === 'LISTENING') {
              agent.setState('IDLE');
            }
          }
        },
      },
      useContinuous
    );
  }

  /**
   * Manually stop listening.
   */
  stopListening(): void {
    this.recognitionProvider.stopListening();
    this.isListeningState = false;
    this.activeRecognizeCallback = undefined;
    const agent = ApolloAgent.getInstance();
    if (agent.getState() === 'LISTENING') {
      agent.setState('IDLE');
    }
  }

  /**
   * Speak Apollo's response text aloud if voice output is enabled.
   */
  speakResponse(text: string, onComplete?: () => void): void {
    const agent = ApolloAgent.getInstance();

    if (!this.settings.voiceEnabled || !text.trim()) {
      agent.setState('IDLE');
      onComplete?.();
      // If continuous listening is active, ensure we resume listening
      if (this.settings.continuousListening && this.isListeningState) {
        agent.setState('LISTENING');
        this.recognitionProvider.resumeAfterSpeech();
      }
      return;
    }

    // Pause recognition temporarily while vocalizing response so Apollo doesn't pick up its own voice
    this.recognitionProvider.pauseForSpeech();
    agent.setState('SPEAKING');

    this.synthesisProvider.speak(text, this.settings, {
      onStart: () => {
        agent.setState('SPEAKING');
      },
      onEnd: () => {
        agent.setState('IDLE');
        onComplete?.();
        // Automatically re-arm continuous direct voice detection!
        if (this.settings.continuousListening && this.isListeningState) {
          agent.setState('LISTENING');
          this.recognitionProvider.resumeAfterSpeech();
        }
      },
      onError: (err) => {
        logger.warn('VoiceManager', `TTS warning: ${err}`);
        agent.setState('IDLE');
        onComplete?.();
        if (this.settings.continuousListening && this.isListeningState) {
          agent.setState('LISTENING');
          this.recognitionProvider.resumeAfterSpeech();
        }
      },
    });
  }

  /**
   * Immediately abort speech output.
   */
  stopSpeaking(): void {
    this.synthesisProvider.stop();
    const agent = ApolloAgent.getInstance();
    if (agent.getState() === 'SPEAKING') {
      agent.setState('IDLE');
      if (this.settings.continuousListening && this.isListeningState) {
        agent.setState('LISTENING');
        this.recognitionProvider.resumeAfterSpeech();
      }
    }
  }

  /**
   * Set custom or future wake word provider (e.g. for "Hey Apollo").
   */
  setWakeWordProvider(provider: IWakeWordProvider): void {
    this.wakeWordProvider = provider;
    logger.info('VoiceManager', `Wake word provider configured: ${provider.name}`);
  }

  private notifyError(err: string) {
    this.errorListeners.forEach((fn) => fn(err));
  }

  private notifyTranscript(text: string, isFinal: boolean) {
    this.transcriptListeners.forEach((fn) => fn(text, isFinal));
  }
}
