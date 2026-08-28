export type VoiceProfilePreset = 'titan_mech' | 'deep_robotic' | 'jarvis' | 'ultra_deep' | 'standard_male' | 'custom';

export interface VoiceSettings {
  voiceEnabled: boolean;
  selectedVoiceURI: string;
  speechRate: number; // 0.5 to 2.0
  pitch: number;      // 0.1 to 2.0 (supports deep baritone and robotic pitches)
  volume: number;     // 0.0 to 1.0
  voicePreset?: VoiceProfilePreset;
  soundEffectsEnabled?: boolean;
  continuousListening?: boolean; // Hands-free continuous voice detection (Direct Listening)
  wakeWordEnabled?: boolean;      // Require wake word "Apollo" or direct speech
}

export type RecognitionState = 'inactive' | 'starting' | 'listening' | 'processing' | 'error';

export interface SpeechRecognitionResultPayload {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

export interface ISpeechRecognitionProvider {
  isSupported(): boolean;
  startListening(callbacks: {
    onResult: (result: SpeechRecognitionResultPayload) => void;
    onError: (error: string) => void;
    onEnd: () => void;
    onStart?: () => void;
  }): void;
  stopListening(): void;
  isListening(): boolean;
}

export interface ISpeechSynthesisProvider {
  isSupported(): boolean;
  getVoices(): SpeechSynthesisVoice[];
  speak(text: string, settings: VoiceSettings, callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: string) => void;
  }): void;
  stop(): void;
  isSpeaking(): boolean;
}

/**
 * Wake Word Provider interface prepared for future expansion (e.g., "Hey Apollo").
 */
export interface IWakeWordProvider {
  name: string;
  isSupported(): boolean;
  start(onWakeWordDetected: () => void): void;
  stop(): void;
}
