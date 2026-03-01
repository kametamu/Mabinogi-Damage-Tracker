namespace Mabinogi_Damage_tracker.Models
{
    public sealed class DamageEvent
    {
        public long Ut { get; init; }
        public long AttackerId { get; init; }
        public long EnemyId { get; init; }
        public float Damage { get; init; }
        public float Wound { get; init; }
        public int ManaDamage { get; init; }
        public int RawSkill { get; init; }
        public int RawSubSkill { get; init; }
        public int ResolvedSkill { get; init; }
        public int NormalizationVersion { get; init; }
        public long? DbRowId { get; init; }

        public static DamageEvent CreateNow(
            long attackerId,
            long enemyId,
            float damage,
            float wound,
            int manaDamage,
            int rawSkill,
            int rawSubSkill,
            int resolvedSkill,
            int normalizationVersion)
        {
            return new DamageEvent
            {
                Ut = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                AttackerId = attackerId,
                EnemyId = enemyId,
                Damage = damage,
                Wound = wound,
                ManaDamage = manaDamage,
                RawSkill = rawSkill,
                RawSubSkill = rawSubSkill,
                ResolvedSkill = resolvedSkill,
                NormalizationVersion = normalizationVersion,
            };
        }
    }
}
