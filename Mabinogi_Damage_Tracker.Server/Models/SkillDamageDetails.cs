namespace Mabinogi_Damage_tracker.Models
{
    public class SkillDamageRow
    {
        public long playerId { get; set; }
        public string playerName { get; set; } = string.Empty;
        public int skillId { get; set; }
        public int? subSkillId { get; set; }
        public long totalDamage { get; set; }
        public int hitCount { get; set; }
    }
}
