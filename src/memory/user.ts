import { db } from '../storage/database';

export interface UserProfile {
  name: string;
  assistantCallsign: string;
  preferredMode: 'voice' | 'text';
  speechRate: number;
  pitch: number;
  volume: number;
  selectedVoiceURI: string;
}

const USER_PROFILE_KEY = 'user_profile';

const DEFAULT_PROFILE: UserProfile = {
  name: 'User',
  assistantCallsign: 'Apollo',
  preferredMode: 'voice',
  speechRate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  selectedVoiceURI: '',
};

export class UserManager {
  static getProfile(): UserProfile {
    return db.getItem<UserProfile>(USER_PROFILE_KEY, DEFAULT_PROFILE);
  }

  static updateProfile(partial: Partial<UserProfile>): UserProfile {
    const current = this.getProfile();
    const updated = { ...current, ...partial };
    db.setItem(USER_PROFILE_KEY, updated);
    return updated;
  }
}
