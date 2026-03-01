import en from './en.json';
import ja from './ja.json';

const skillMaps = {
  en,
  ja,
};

const normalizeLanguage = (lang) => (lang || 'en').toLowerCase().startsWith('ja') ? 'ja' : 'en';

export function localizeSkillName(skillId, fallbackName, lang = 'en') {
  if (skillId === null || skillId === undefined) {
    return fallbackName ?? '';
  }

  const normalizedLang = normalizeLanguage(lang);
  const skillKey = String(skillId);

  const localized = skillMaps[normalizedLang]?.[skillKey];
  if (localized) {
    return localized;
  }

  if (fallbackName) {
    return fallbackName;
  }

  const english = skillMaps.en?.[skillKey];
  if (english) {
    return english;
  }

  return `Unknown (${skillKey})`;
}

export default skillMaps;
