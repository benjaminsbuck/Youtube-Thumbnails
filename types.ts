export enum AppState {
  TITLE_INPUT = 'TITLE_INPUT',
  GENERATING_TITLES = 'GENERATING_TITLES',
  TITLES_DISPLAYED = 'TITLES_DISPLAYED',
  THUMBNAIL_INPUT = 'THUMBNAIL_INPUT',
}

export type Language = 'en' | 'ar';

export interface UploadedImage {
  file: File;
  preview: string;
}
