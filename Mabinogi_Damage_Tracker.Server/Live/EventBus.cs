using System.Threading.Channels;
using Mabinogi_Damage_tracker.Models;

namespace Mabinogi_Damage_tracker.Live
{
    public static class EventBus
    {
        private static readonly Channel<DamageEvent> _damage = Channel.CreateBounded<DamageEvent>(
            new BoundedChannelOptions(20000)
            {
                SingleReader = true,
                SingleWriter = false,
                FullMode = BoundedChannelFullMode.DropOldest,
            });

        public static bool PublishDamage(DamageEvent ev) => _damage.Writer.TryWrite(ev);

        public static ChannelReader<DamageEvent> DamageReader => _damage.Reader;
    }
}
