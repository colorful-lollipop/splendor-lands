import { DEFAULT_SKINS } from './meta';
import type { SkinSettings } from './types';

const KEY = 'splendor-skins-v1';
const MIGRATION_KEY = 'splendor-skins-v2';

export function loadSkins(): SkinSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SKINS };
    const skins = { ...DEFAULT_SKINS, ...JSON.parse(raw) };

    // 旧版本只保存了画风没有对应贵族；升级后自动补上同主题贵族。
    if (localStorage.getItem(MIGRATION_KEY) !== '1') {
      if (skins.art === 'anime' && skins.noble === 'oil') skins.noble = 'anime';
      if (skins.art === 'glass' && skins.noble === 'oil') skins.noble = 'glass';
      localStorage.setItem(MIGRATION_KEY, '1');
      saveSkins(skins);
    }
    return skins;
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