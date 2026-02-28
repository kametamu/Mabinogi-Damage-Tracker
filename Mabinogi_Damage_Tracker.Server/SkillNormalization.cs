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

            if (rawSubSkill >= 20000 && rawSubSkill <= 50000 && rawSubSkill != CombatMasteryId)
            {
                return (rawSubSkill, "subskill-range-fallback");
            }

            return (rawSkill, "fallback-rawSkill");
        }
    }
}
