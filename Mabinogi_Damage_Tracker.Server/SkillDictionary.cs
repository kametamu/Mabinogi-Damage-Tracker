using System;
using System.Collections.Generic;
using System.Linq;

namespace Mabinogi_Damage_Tracker
{
    public static class SkillDictionary
    {
        private static readonly HashSet<int> KnownSkillIds = Enum
            .GetValues(typeof(SkillId))
            .Cast<SkillId>()
            .Select(value => (int)value)
            .ToHashSet();

        public static bool IsKnownSkillId(int id)
        {
            return KnownSkillIds.Contains(id);
        }
    }
}
