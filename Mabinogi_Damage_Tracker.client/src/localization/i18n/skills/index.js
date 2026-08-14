
import enSkills from './en.json';
import jaSkills from './ja.json';
//import cnSkills from './cn.json'

const skillMaps = {
  en: enSkills,
  ja: jaSkills
  //cn: cnSkills
};

export function getLocalizedSkillName(skillId, fallbackName, language) {
   
    const normalizedLanguage = language?.toLowerCase();
    const languageMap = skillMaps[normalizedLanguage] || skillMaps.en;

    console.log(languageMap);

    if (skillId !== null && skillId !== undefined) {
        const localizedName = languageMap[String(skillId)];
        if (localizedName) {
            return localizedName;
        }
    }

    if (fallbackName) {
        return fallbackName;
    }

    if (skillId !== null && skillId !== undefined) {
        return `Unknown Skill (${skillId})`;
    }

    return 'Unknown Skill';
}
