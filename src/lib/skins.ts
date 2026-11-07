import { DEFAULT_SKINS } from './meta';
import type { SkinSettings } from './types';

const KEY = 'splendor-skins-v1';

export function loadSkins(): SkinSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SKINS };
    return { ...DEFAULT_SKINS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SKINS };
  }
}

export function saveSkins(skins: SkinSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(skins));
  } catch {
    /* ignore */
  }
}

export function applySkins(skins: SkinSettings) {
  const el = document.documentElement;
  el.dataset.frame = skins.frame;
  el.dataset.art = skins.art;
  el.dataset.gems = skins.gems;
  el.dataset.back = skins.back;
  el.dataset.table = skins.table;
  el.dataset.noble = skins.noble;
}