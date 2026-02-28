namespace Mabinogi_Damage_Tracker
{
    public static class SkillNormalization
    {
        public const int Version = 1;
        private const int CombatMasteryId = (int)SkillId.CombatMastery;

        public static (int resolvedSkill, string reason) Resolve(int rawSkill, int rawSubSkill)
        {
            if (rawSubSkill != 0 &&
                rawSubSkill != CombatMasteryId &&
                SkillDictionary.IsKnownSkillId(rawSubSkill))
            {
                return (rawSubSkill, "subskill-known-specific");
            }

            if (rawSkill != 0 && SkillDictionary.IsKnownSkillId(rawSkill))
            {
                return (rawSkill, "skill-known");
            }

            return (rawSkill, "fallback-rawSkill");
        }
    }
}
