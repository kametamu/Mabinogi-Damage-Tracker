using Mabinogi_Damage_Tracker;

namespace Mabinogi_Damage_tracker.Models
{

    public class Damage_View
    {
        public List<Damage_Simple> damage_piechart {  get; set; } = new List<Damage_Simple>();
        public List<Damage_Simple> damage_linechart {  get; set; } = new List<Damage_Simple>();
        public string PauseButton_Text {  get; set; } = "Pause";
        public Damage_View()
        {
            PauseButton_Text = "Pause";
        }
        public Damage_View(List<Damage_Simple> damages)
        {
            damage_piechart = damages;
        }

    }
    public class Damage_Simple
    {
        public double damage { get; set; }
        public UInt64 player_id { get; set; }
        public string player_name { get; set; } = string.Empty;
        public string datetime_newest_record {  get; set; } = string.Empty;
        public Int32 unix_timestamp { get; set; }
        public Damage_Simple(double dmg, UInt64 id, string name) 
        {
            damage = dmg;
            player_id = id;
            player_name = name;
        }
        public Damage_Simple(double dmg, Int64 id, string name)
        {
            damage = dmg;
            player_id = (UInt64)id;
            player_name = name;
        }
        public Damage_Simple(double dmg, Int64 id, string name, string dt)
        {
            damage = dmg;
            player_id = (UInt64)id;
            player_name = name;
            datetime_newest_record = dt;
        }
        public Damage_Simple(double dmg, Int64 id, string name, Int32 dt)
        {
            damage = dmg;
            player_id = (UInt64)id;
            player_name = name;
            unix_timestamp = dt;
        }
        public Damage_Simple(double dmg, Int64 id, Int32 ut)
        {
            damage = dmg;
            player_id = (UInt64)id;
            unix_timestamp = ut;
        }
    }

    
}
