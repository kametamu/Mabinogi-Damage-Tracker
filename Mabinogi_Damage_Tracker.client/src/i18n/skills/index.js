import enSkills from './en.json';
import jaSkills from './ja.json';

const skillMaps = {
  en: enSkills,
  ja: jaSkills,
};

export function getLocalizedSkillName(skillId, fallbackName, language) {
  const normalizedLanguage = language?.toLowerCase().startsWith('ja') ? 'ja' : 'en';
  const languageMap = skillMaps[normalizedLanguage] || skillMaps.en;

  if (skillId !== null && skillId !== undefined) {
    const localizedName = languageMap[String(skillId)];
    if (localizedName) {
      return localizedName;
    }
  }

  if (fallbackName) {
    return fallbackName;
  }

  return 'Unknown Skill';
}
