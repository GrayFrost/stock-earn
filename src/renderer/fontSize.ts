import type { FontSize } from '../shared/types';

const FONT_SIZE_STORAGE_KEY = 'stock-earn-font-size';
const FONT_SIZES: FontSize[] = ['base', 'comfortable', 'large', 'extra-large'];

export function getStoredFontSize(): FontSize | null {
  const value = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
  return FONT_SIZES.includes(value as FontSize) ? value as FontSize : null;
}

export function resolveFontSize(fontSize?: FontSize): FontSize {
  return getStoredFontSize() ?? fontSize ?? 'base';
}

export function storeFontSize(fontSize: FontSize) {
  window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize);
}

export function clearStoredFontSize() {
  window.localStorage.removeItem(FONT_SIZE_STORAGE_KEY);
}
