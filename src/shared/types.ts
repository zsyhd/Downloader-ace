export type SongErrorCode =
  | 'INVALID_URL'
  | 'SONG_NOT_FOUND'
  | 'NO_PUBLIC_AUDIO'
  | 'CORS_BLOCKED'
  | 'AUTH_OR_SUBSCRIPTION_REQUIRED'
  | 'SERVER_UNREACHABLE'
  | 'DOWNLOAD_INCOMPLETE';

export type AudioFormat = 'mp3' | 'wav' | 'flac' | 'ogg' | 'm4a' | 'unknown';

export type AceModelKey =
  | 'ace-step-1.5-xl'
  | 'ace-music-v1'
  | 'ace-music-v1.1-preview'
  | 'other';

export interface LyricsSection {
  heading: string;
  lines: string[];
}

export interface SongMetadata {
  songId: string;
  shareToken: string | null;
  normalizedUrl: string;
  title: string;
  creator: string | null;
  coverUrl: string | null;
  durationText: string | null;
  durationSeconds: number | null;
  publishedDate: string | null;
  styleTags: string | null;
  modelKey: AceModelKey;
  modelName: string;
  state: 'ready' | 'making' | 'failed' | 'unknown';
  visibility: string | null;
  availableFormats: string[];
  freeFormats: string[];
  isPaidOwner: boolean;
  audioUrl: string | null;
  audioFormat: AudioFormat;
  audioMimeType: string | null;
  audioExtension: string;
  fileSizeBytes: number | null;
  downloadable: boolean;
  downloadFilename: string;
  lyrics: LyricsSection[];
  extractionSources: string[];
}

export interface AnalyzeSuccessResponse {
  ok: true;
  song: SongMetadata;
  corsNote: string;
}

export interface AnalyzeErrorResponse {
  ok: false;
  errorCode: SongErrorCode;
  message: string;
  details: string;
  song?: Partial<SongMetadata>;
}

export type AnalyzeResponse = AnalyzeSuccessResponse | AnalyzeErrorResponse;
