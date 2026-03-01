using System.Text.Json;
using Mabinogi_Damage_tracker.Controllers;
using Mabinogi_Damage_tracker.Models;

namespace Mabinogi_Damage_tracker.Live
{
    public static class LiveAggregators
    {
        private static readonly object _sync = new object();
        private static readonly Dictionary<long, double> _totalsByPlayer = new Dictionary<long, double>();
        private static readonly Dictionary<long, SortedDictionary<long, double>> _bucketByPlayerSecond = new Dictionary<long, SortedDictionary<long, double>>();
        private static readonly Dictionary<(long playerId, int skillId), double> _skillByPlayer = new Dictionary<(long playerId, int skillId), double>();

        private static bool _started = false;

        public static void Start()
        {
            if (_started) return;
            _started = true;
            _ = Task.Run(ReadLoop);
            _ = Task.Run(PublishLoop);
        }

        public static void Reset()
        {
            lock (_sync)
            {
                _totalsByPlayer.Clear();
                _bucketByPlayerSecond.Clear();
                _skillByPlayer.Clear();
            }
        }

        private static async Task ReadLoop()
        {
            await foreach (var ev in EventBus.DamageReader.ReadAllAsync())
            {
                lock (_sync)
                {
                    _totalsByPlayer[ev.AttackerId] = (_totalsByPlayer.TryGetValue(ev.AttackerId, out var total) ? total : 0) + ev.Damage;

                    if (!_bucketByPlayerSecond.TryGetValue(ev.AttackerId, out var buckets))
                    {
                        buckets = new SortedDictionary<long, double>();
                        _bucketByPlayerSecond[ev.AttackerId] = buckets;
                    }

                    buckets[ev.Ut] = (buckets.TryGetValue(ev.Ut, out var existing) ? existing : 0) + ev.Damage;

                    var skillId = ev.ResolvedSkill != 0 ? ev.ResolvedSkill : ev.RawSkill;
                    if (skillId != 0)
                    {
                        var key = (ev.AttackerId, skillId);
                        _skillByPlayer[key] = (_skillByPlayer.TryGetValue(key, out var skillTotal) ? skillTotal : 0) + ev.Damage;
                    }
                }
            }
        }

        private static async Task PublishLoop()
        {
            while (true)
            {
                await Task.Delay(250);

                object totalPayload;
                object dotPayload;
                object meterPayload;
                object liveSkillPayload;

                lock (_sync)
                {
                    totalPayload = _totalsByPlayer
                        .Select(kv => new { playerId = kv.Key, totalDamage = kv.Value })
                        .OrderByDescending(x => x.totalDamage)
                        .ToList();

                    dotPayload = _bucketByPlayerSecond
                        .Select(kv =>
                        {
                            double running = 0;
                            var points = kv.Value
                                .Select(p =>
                                {
                                    running += p.Value;
                                    return new { ut = p.Key, cumulativeDamage = running };
                                })
                                .TakeLast(120)
                                .ToList();
                            return new { playerId = kv.Key, points };
                        })
                        .ToList();

                    var combinedTotal = _totalsByPlayer.Values.Sum();
                    var maxSecond = _bucketByPlayerSecond.Values.SelectMany(v => v.Values).DefaultIfEmpty(0).Max();
                    var dps = _bucketByPlayerSecond.Values.SelectMany(v => v).GroupBy(v => v.Key).Select(g => g.Sum(x => x.Value)).DefaultIfEmpty(0).TakeLast(5).Average();

                    meterPayload = new
                    {
                        totalDamage = combinedTotal,
                        currentDps = dps,
                        avgDps = _bucketByPlayerSecond.Count == 0 ? 0 : combinedTotal / Math.Max(1, _bucketByPlayerSecond.Values.SelectMany(v => v.Keys).Distinct().Count()),
                        maxDps = maxSecond,
                    };

                    liveSkillPayload = _skillByPlayer
                        .Select(kv => new { playerId = kv.Key.playerId, skillId = kv.Key.skillId, totalDamage = kv.Value })
                        .OrderByDescending(x => x.totalDamage)
                        .Take(200)
                        .ToList();
                }

                DataStreamController.WriteTotalDamageData(JsonSerializer.Serialize(totalPayload));
                DataStreamController.WriteDoTData(JsonSerializer.Serialize(dotPayload));
                DataStreamController.WriteDamageMeterData(JsonSerializer.Serialize(meterPayload));
                DataStreamController.WriteLiveSkillDamageData(JsonSerializer.Serialize(liveSkillPayload));
            }
        }
    }
}
