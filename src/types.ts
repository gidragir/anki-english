export interface WordItem {
  en: string;
  ru: string;
}

export interface AppConfig {
  githubToken?: string;
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  filePath?: string;
}

export interface ValidationResult {
  valid: boolean;
  data?: WordItem[];
  error?: string;
}

export interface MergeResult {
  merged: WordItem[];
  addedCount: number;
  duplicatesCount: number;
}
