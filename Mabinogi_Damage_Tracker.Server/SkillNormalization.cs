namespace Mabinogi_Damage_Tracker
{
    public static class SkillNormalization
    {
        public const int Version = 1;

        public static (int resolvedSkill, string reason) Resolve(int rawSkill, int rawSubSkill)
        {
            if (SkillDictionary.IsKnownSkillId(rawSubSkill))
            {
                return (rawSubSkill, "subskill-known");
            }

            if (SkillDictionary.IsKnownSkillId(rawSkill))
            {
                return (rawSkill, "skill-known");
            }

            if (rawSubSkill >= 20000 && rawSubSkill <= 50000)
            {
                return (rawSubSkill, "subskill-range-fallback");
            }

            return (rawSkill, "fallback-rawSkill");
        }
    }
}
