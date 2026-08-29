import { db } from '../storage/database';
import { logger } from '../utils/logger';

export interface UserProfile {
  name: string;
  preferredName?: string;
  assistantCallsign: string;
  preferences: string[];
  goals: string[];
  notes: string[];
  preferredMode: 'voice' | 'text';
  speechRate: number;
  pitch: number;
  volume: number;
  selectedVoiceURI: string;
  updatedAt: number;
}

const USER_PROFILE_KEY = 'user_profile';

const DEFAULT_PROFILE: UserProfile = {
  name: 'User',
  preferredName: '',
  assistantCallsign: 'Apollo',
  preferences: [],
  goals: [],
  notes: [],
  preferredMode: 'voice',
  speechRate: 0.8,
  pitch: 0.1,
  volume: 1.0,
  selectedVoiceURI: '',
  updatedAt: Date.now(),
};

export class UserManager {
  static getProfile(): UserProfile {
    const profile = db.getItem<UserProfile>(USER_PROFILE_KEY, DEFAULT_PROFILE);
    // Ensure array fields exist
    return {
      ...DEFAULT_PROFILE,
      ...profile,
      preferences: Array.isArray(profile.preferences) ? profile.preferences : [],
      goals: Array.isArray(profile.goals) ? profile.goals : [],
      notes: Array.isArray(profile.notes) ? profile.notes : [],
    };
  }

  static updateProfile(partial: Partial<UserProfile>): UserProfile {
    const current = this.getProfile();
    const updated: UserProfile = {
      ...current,
      ...partial,
      updatedAt: Date.now(),
    };
    db.setItem(USER_PROFILE_KEY, updated);
    logger.info('UserManager', 'User profile updated');
    return updated;
  }

  static addPreference(pref: string): UserProfile {
    const trimmed = pref.trim();
    if (!trimmed) return this.getProfile();
    const current = this.getProfile();
    if (!current.preferences.includes(trimmed)) {
      return this.updateProfile({
        preferences: [...current.preferences, trimmed],
      });
    }
    return current;
  }

  static removePreference(pref: string): UserProfile {
    const current = this.getProfile();
    return this.updateProfile({
      preferences: current.preferences.filter((p) => p !== pref),
    });
  }

  static addGoal(goal: string): UserProfile {
    const trimmed = goal.trim();
    if (!trimmed) return this.getProfile();
    const current = this.getProfile();
    if (!current.goals.includes(trimmed)) {
      return this.updateProfile({
        goals: [...current.goals, trimmed],
      });
    }
    return current;
  }

  static removeGoal(goal: string): UserProfile {
    const current = this.getProfile();
    return this.updateProfile({
      goals: current.goals.filter((g) => g !== goal),
    });
  }

  static addNote(note: string): UserProfile {
    const trimmed = note.trim();
    if (!trimmed) return this.getProfile();
    const current = this.getProfile();
    if (!current.notes.includes(trimmed)) {
      return this.updateProfile({
        notes: [...current.notes, trimmed],
      });
    }
    return current;
  }

  static removeNote(note: string): UserProfile {
    const current = this.getProfile();
    return this.updateProfile({
      notes: current.notes.filter((n) => n !== note),
    });
  }
}
