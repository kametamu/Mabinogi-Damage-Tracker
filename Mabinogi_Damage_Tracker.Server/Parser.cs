using Mabinogi_Damage_Tracker;
using PacketDotNet;
using SharpPcap.LibPcap;
using SharpPcap;
using System.Buffers.Binary;
using System.ComponentModel;
using System.Diagnostics;
using System.Text;
using System;
using SQLitePCL;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Runtime.InteropServices;
using System.IO;

namespace Mabinogi_Damage_tracker
{
    public static class Parser
    {
        private const int MaxGameSubPacketLength = 2000;
        private const int MaxStreamBufferBytes = 256 * 1024;
        private const int MaxQueuedSegmentsPerStream = 64;
        private static readonly TimeSpan StreamIdleTimeout = TimeSpan.FromMinutes(2);
        private const ushort TcpFlagFin = 0x01;
        private const ushort TcpFlagSyn = 0x02;
        private const ushort TcpFlagRst = 0x04;
        private static readonly object combatDebugLogLock = new object();
        private static bool combatDebugProbeWritten = false;
        private static readonly object opcodeSkillHitLogLock = new object();
        private static bool opcodeSkillHitProbeWritten = false;
        private static readonly (ushort SkillId, string PatternType, byte[] PatternBytes)[] opcodeSkillHitPatterns = new[]
        {
            ((ushort)58009, "be16", new byte[] { 0xE2, 0x99 }),
            ((ushort)58009, "le16", new byte[] { 0x99, 0xE2 }),
            ((ushort)58009, "be32", new byte[] { 0x00, 0x00, 0xE2, 0x99 }),
            ((ushort)58009, "le32", new byte[] { 0x99, 0xE2, 0x00, 0x00 }),
            ((ushort)58100, "be16", new byte[] { 0xE2, 0xF4 }),
            ((ushort)58100, "le16", new byte[] { 0xF4, 0xE2 }),
            ((ushort)58100, "be32", new byte[] { 0x00, 0x00, 0xE2, 0xF4 }),
            ((ushort)58100, "le32", new byte[] { 0xF4, 0xE2, 0x00, 0x00 }),
            ((ushort)58101, "be16", new byte[] { 0xE2, 0xF5 }),
            ((ushort)58101, "le16", new byte[] { 0xF5, 0xE2 }),
            ((ushort)58101, "be32", new byte[] { 0x00, 0x00, 0xE2, 0xF5 }),
            ((ushort)58101, "le32", new byte[] { 0xF5, 0xE2, 0x00, 0x00 }),
        };

        private static DateTime lastStreamCleanupUtc = DateTime.MinValue;

        private readonly record struct TcpStreamKey(string SourceIp, int SourcePort, string DestinationIp, int DestinationPort)
        {
            public override string ToString() => $"{SourceIp}:{SourcePort}->{DestinationIp}:{DestinationPort}";
        }

        private sealed class TcpStreamState
        {
            public List<byte> Buffer { get; } = new List<byte>();
            public SortedDictionary<uint, byte[]> PendingSegments { get; } = new SortedDictionary<uint, byte[]>();
            public uint? NextSequence { get; set; }
            public DateTime LastSeenUtc { get; set; }
        }

        static CaptureFileWriterDevice captureFileWriter = new CaptureFileWriterDevice("out.pcapng");
        static bool savenextpacket = false;
        static BindingList<Name> character_names = new BindingList<Name>();
        static UInt64 last_healer = 0;
        public static string adapter_description;
        public static List<string> adapters = new List<string>();
        static Dictionary<TcpStreamKey, TcpStreamState> tcpStreams = new Dictionary<TcpStreamKey, TcpStreamState>();

        public static bool pause = false;
        #if DEBUG_LIVE || RELEASE
            static LibPcapLiveDevice device = null;
        #endif
        #if DEBUG_FILE
            static CaptureFileReaderDevice device = new CaptureFileReaderDevice("C:/packets/full glenn vhm run.pcapng");
        #endif
        static Thread reader;

        public static bool Stop()
        {
            device.Close();
            device.StopCapture();
            device.OnPacketArrival -= Device_OnPacketArrival;

            Stopwatch watchdog = Stopwatch.StartNew();
            while (watchdog.ElapsedMilliseconds < 5000 && (device.Opened == true || reader.ThreadState == System.Threading.ThreadState.Running))
            {
                Thread.Sleep(50);
            }
            if (reader.ThreadState == System.Threading.ThreadState.Running || device.Opened == true)
            {
                LogsController.WriteLog("Could not stop thread. Try restarting server");
                return false;
            }
            return true;
        }

        public static void Start()
        {
            reader = new Thread(Reader);
            reader.Name = "Reader Thread";
            reader.Start();
        }

        private static void Reader()
        {
            Debug.WriteLine("starting Parser");
            LogsController.WriteLog("Starting Parser.");

            string filter = "ip and tcp and tcp portrange 11020-11023";
#if DEBUG_LIVE || RELEASE
            adapters = LibPcapLiveDeviceList.Instance.Select(a => a.Description).ToList();
            adapter_description = db_helper.Get_Local_Adapter();
            if (adapter_description != null && adapter_description != "")
            {
                try
                {
                    device = LibPcapLiveDeviceList.Instance.First(a => a.Description == adapter_description);
                    LogsController.WriteLog(string.Format("Starting with saved adapter: {0}", adapter_description));
                }
                catch
                {
                    device = null;
                }
            }
            if (adapter_description == null || adapter_description == "" || device == null)
            {
                foreach (var dev in LibPcapLiveDeviceList.Instance)
                {
                    Debug.WriteLine(dev.Description.ToString());
                    dev.Open(DeviceModes.Promiscuous, 1000);
                    dev.Filter = filter;

                    Stopwatch watchdog = Stopwatch.StartNew();

                    GetPacketStatus status;
                    PacketCapture pack;
                    while (watchdog.ElapsedMilliseconds < 2000 && device == null)
                    {
                        status = dev.GetNextPacket(out pack);
                        if (status == GetPacketStatus.PacketRead)
                        {
                            adapter_description = dev.Description;
                            Debug.WriteLine("found adapater");
                            LogsController.WriteLog("Found an adapter " + dev.Description);
                            LogsController.WriteLog("Save this adapter's name in the settings menu to skip scanning next time");
                            device = dev;
                            break;
                        }
                    }
                    dev.Close();
                    if (device != null) { break; }
                }
            }
            if (device == null)
            {
                LogsController.WriteLog("Could not find an adapter. Are you sure Mabi is running?");
                LogsController.WriteLog("Restart Parser and try moving while scanning. Check your setup and wireshark to confirm data received.");
                return;
            }
#endif

            try
            {
                device.Open(DeviceModes.Promiscuous);
                device.Filter = filter;
                device.OnPacketArrival += Device_OnPacketArrival;
                captureFileWriter.Open();
#if DEBUG_FILE
                device.Capture();
#endif
#if DEBUG_LIVE || RELEASE
                device.StartCapture();
#endif
            }
            catch (Exception ex)
            {
                LogsController.WriteLog("Failed to start parser. execption: " + ex.Message);
            }
        }

        private static void Device_OnPacketArrival(object s, PacketCapture e)
        {
            if (pause == true)
            {
                return;
            }

            RawCapture raw = e.GetPacket();

            if (savenextpacket)
            {
                savenextpacket = false;
                captureFileWriter.Write(raw);
            }

            Packet packet = Packet.ParsePacket(raw.LinkLayerType, raw.Data);
            TcpPacket tcp = packet.Extract<TcpPacket>();
            IPPacket ip = packet.Extract<IPPacket>();

            if (tcp == null || ip == null)
            {
                return;
            }

            DateTime nowUtc = DateTime.UtcNow;
            CleanupIdleStreams(nowUtc);

            TcpStreamKey streamKey = new TcpStreamKey(
                ip.SourceAddress.ToString(),
                tcp.SourcePort,
                ip.DestinationAddress.ToString(),
                tcp.DestinationPort);

            bool hasPayload = tcp.PayloadData != null && tcp.PayloadData.Length > 0;
            if (hasPayload)
            {
                ProcessTcpSegment(streamKey, tcp.PayloadData, (uint)tcp.SequenceNumber, nowUtc);
            }

            HandleConnectionLifecycleEvent(streamKey, tcp);
        }

        private static void ProcessTcpSegment(TcpStreamKey streamKey, byte[] payload, uint sequenceNumber, DateTime nowUtc)
        {
            TcpStreamState streamState = GetOrCreateStream(streamKey, nowUtc);
            streamState.LastSeenUtc = nowUtc;

            AppendTcpPayload(streamKey, streamState, sequenceNumber, payload);
            ParseReassembledStream(streamKey, streamState);
        }


        private static TcpStreamState GetOrCreateStream(TcpStreamKey streamKey, DateTime nowUtc)
        {
            if (!tcpStreams.TryGetValue(streamKey, out TcpStreamState? streamState))
            {
                streamState = new TcpStreamState
                {
                    LastSeenUtc = nowUtc
                };
                tcpStreams[streamKey] = streamState;
                LogsController.WriteLog($"[TCP] New stream created {streamKey}");
            }

            return streamState;
        }

        private static void HandleConnectionLifecycleEvent(TcpStreamKey streamKey, TcpPacket tcp)
        {
            ushort tcpFlags = tcp.Flags;
            ushort teardownFlags = (ushort)(TcpFlagFin | TcpFlagSyn | TcpFlagRst);
            if ((tcpFlags & teardownFlags) == 0)
            {
                return;
            }

            if (tcpStreams.Remove(streamKey))
            {
                string flag = (tcpFlags & TcpFlagRst) != 0
                    ? "RST"
                    : (tcpFlags & TcpFlagSyn) != 0
                        ? "SYN"
                        : "FIN";
                LogsController.WriteLog($"[TCP] Stream removed on {flag} for {streamKey}");
            }
        }

        private static void CleanupIdleStreams(DateTime nowUtc)
        {
            if (nowUtc - lastStreamCleanupUtc < TimeSpan.FromSeconds(30))
            {
                return;
            }

            lastStreamCleanupUtc = nowUtc;
            List<TcpStreamKey> expiredKeys = tcpStreams
                .Where(stream => nowUtc - stream.Value.LastSeenUtc > StreamIdleTimeout)
                .Select(stream => stream.Key)
                .ToList();

            foreach (TcpStreamKey expiredKey in expiredKeys)
            {
                tcpStreams.Remove(expiredKey);
                LogsController.WriteLog($"[TCP] Idle stream expired {expiredKey}");
            }
        }

        private static void AppendTcpPayload(TcpStreamKey streamKey, TcpStreamState streamState, uint sequenceNumber, byte[] payload)
        {
            if (payload.Length == 0)
            {
                return;
            }

            if (streamState.NextSequence == null)
            {
                streamState.Buffer.AddRange(payload);
                streamState.NextSequence = sequenceNumber + (uint)payload.Length;
                EnsureStreamWithinLimits(streamKey, streamState);
                DrainQueuedSegments(streamKey, streamState);
                return;
            }

            uint nextSequence = streamState.NextSequence.Value;
            int sequenceComparison = CompareSequence(sequenceNumber, nextSequence);
            if (sequenceComparison == 0)
            {
                streamState.Buffer.AddRange(payload);
                streamState.NextSequence = nextSequence + (uint)payload.Length;
                EnsureStreamWithinLimits(streamKey, streamState);
                DrainQueuedSegments(streamKey, streamState);
                return;
            }

            if (sequenceComparison < 0)
            {
                int overlap = (int)(nextSequence - sequenceNumber);
                if (overlap >= payload.Length)
                {
                    LogsController.WriteLog($"[TCP] Duplicate segment ignored for {streamKey} at seq {sequenceNumber}");
                    return;
                }

                int remainingLength = payload.Length - overlap;
                streamState.Buffer.AddRange(payload.AsSpan(overlap, remainingLength).ToArray());
                streamState.NextSequence = nextSequence + (uint)remainingLength;
                LogsController.WriteLog($"[TCP] Overlapping segment trimmed for {streamKey} at seq {sequenceNumber}");
                EnsureStreamWithinLimits(streamKey, streamState);
                DrainQueuedSegments(streamKey, streamState);
                return;
            }

            if (streamState.PendingSegments.ContainsKey(sequenceNumber))
            {
                LogsController.WriteLog($"[TCP] Duplicate out-of-order segment ignored for {streamKey} at seq {sequenceNumber}");
                return;
            }

            streamState.PendingSegments[sequenceNumber] = payload.ToArray();
            LogsController.WriteLog($"[TCP] Out-of-order segment queued for {streamKey} at seq {sequenceNumber}, expecting {nextSequence}");

            if (streamState.PendingSegments.Count > MaxQueuedSegmentsPerStream)
            {
                ResetStream(streamKey, streamState, "too many queued out-of-order segments");
            }
        }

        private static void DrainQueuedSegments(TcpStreamKey streamKey, TcpStreamState streamState)
        {
            while (streamState.NextSequence != null && streamState.PendingSegments.Count > 0)
            {
                uint nextSequence = streamState.NextSequence.Value;
                KeyValuePair<uint, byte[]> nextPending = streamState.PendingSegments.First();
                int sequenceComparison = CompareSequence(nextPending.Key, nextSequence);

                if (sequenceComparison > 0)
                {
                    return;
                }

                streamState.PendingSegments.Remove(nextPending.Key);

                if (sequenceComparison < 0)
                {
                    int overlap = (int)(nextSequence - nextPending.Key);
                    if (overlap >= nextPending.Value.Length)
                    {
                        LogsController.WriteLog($"[TCP] Queued duplicate segment ignored for {streamKey} at seq {nextPending.Key}");
                        continue;
                    }

                    int remainingLength = nextPending.Value.Length - overlap;
                    streamState.Buffer.AddRange(nextPending.Value.AsSpan(overlap, remainingLength).ToArray());
                    streamState.NextSequence = nextSequence + (uint)remainingLength;
                    LogsController.WriteLog($"[TCP] Queued overlapping segment trimmed for {streamKey} at seq {nextPending.Key}");
                }
                else
                {
                    streamState.Buffer.AddRange(nextPending.Value);
                    streamState.NextSequence = nextSequence + (uint)nextPending.Value.Length;
                }

                EnsureStreamWithinLimits(streamKey, streamState);
            }
        }

        private static void ParseReassembledStream(TcpStreamKey streamKey, TcpStreamState streamState)
        {
            int consumedBytes = 0;
            List<healing> healingPacks = new List<healing>();
            Span<byte> buffer = CollectionsMarshal.AsSpan(streamState.Buffer);

            while (buffer.Length - consumedBytes >= 10)
            {
                int beginningOfPacketCursor = consumedBytes;
                byte sign = buffer[consumedBytes];
                _ = sign;
                consumedBytes += sizeof(byte);

                uint subPacketLength = BinaryPrimitives.ReadUInt32LittleEndian(buffer.Slice(consumedBytes));
                consumedBytes += sizeof(UInt32);

                if (subPacketLength == 0 || subPacketLength > MaxGameSubPacketLength)
                {
                    ResetStream(streamKey, streamState, $"invalid sub-packet length {subPacketLength}");
                    return;
                }

                if (streamState.Buffer.Count - beginningOfPacketCursor < subPacketLength)
                {
                    consumedBytes = beginningOfPacketCursor;
                    break;
                }

                byte headerFlag = buffer[consumedBytes];
                consumedBytes += sizeof(byte);

                if (subPacketLength < 10)
                {
                    consumedBytes = beginningOfPacketCursor + (int)subPacketLength;
                    continue;
                }

                if (headerFlag > 4 || headerFlag == 1 || headerFlag == 2)
                {
                    consumedBytes = beginningOfPacketCursor + (int)subPacketLength;
                    continue;
                }

                uint opcode = BinaryPrimitives.ReadUInt32BigEndian(buffer.Slice(consumedBytes));
                consumedBytes += sizeof(UInt32);

                ReadOnlySpan<byte> packetBytes = buffer;
                int subPacketPayloadLength = beginningOfPacketCursor + (int)subPacketLength - consumedBytes;
                if (subPacketPayloadLength > 0)
                {
                    ScanPacketForTargetSkillPatterns(packetBytes.Slice(consumedBytes, subPacketPayloadLength), opcode, subPacketLength, beginningOfPacketCursor);
                }
                switch (opcode)
                {
                    case Op_Codes.healing:
                        pack_healing(packetBytes, consumedBytes, ref healingPacks, (int)subPacketLength, beginningOfPacketCursor);
                        break;
                    case Op_Codes.ChatMessage:
                        read_chat(packetBytes, consumedBytes, beginningOfPacketCursor);
                        break;
                    case Op_Codes.CombatActionPack:
                        pack_damage(packetBytes, consumedBytes, (int)subPacketLength, beginningOfPacketCursor);
                        break;
                }

                consumedBytes = beginningOfPacketCursor + (int)subPacketLength;
            }

            if (consumedBytes > 0)
            {
                streamState.Buffer.RemoveRange(0, consumedBytes);
            }

            if (healingPacks.Count > 0)
            {
                healingPacks.ForEach(a => a.caster = last_healer);
                foreach (var item in healingPacks)
                {
                    if (item.heal > 10000) { return; }
                    db_helper.add_heal(item.caster, item.recepient, item.heal);
                    LogsController.WriteLog("[HEAL]" + item.caster + "->" + item.recepient + " for " + item.heal);
                    Debug.WriteLine("player {0}, was healed by {1}, for {2}", item.recepient, item.caster, item.heal);
                }
            }

            EnsureStreamWithinLimits(streamKey, streamState);
        }

        private static void pack_healing(ReadOnlySpan<byte> payloadData, int cursor, ref List<healing> healing_packs, int sub_packet_length, int begining_of_packet_cursor)
        {
            try
            {
                byte heal_type = payloadData[cursor + sizeof(UInt64)];
                healing healpack = new healing();

                switch (heal_type)
                {
                    case 0x0A:
                        healpack.recepient = BinaryPrimitives.ReadUInt64BigEndian(payloadData.Slice(cursor));
                        healpack.heal = BinaryPrimitives.ReadUInt32BigEndian(payloadData.Slice(cursor + 17));
                        healing_packs.Add(healpack);
                        break;
                    case 0x19:
                        last_healer = BinaryPrimitives.ReadUInt64BigEndian(payloadData.Slice(cursor));
                        break;
                    case 0x28:
                        last_healer = BinaryPrimitives.ReadUInt64BigEndian(payloadData.Slice(cursor));
                        cursor += 19;
                        int stringlength = payloadData[cursor];
                        cursor += stringlength;
                        while (cursor < sub_packet_length + begining_of_packet_cursor)
                        {
                            if (payloadData[cursor] != 4) { break; }
                            healing multiheal = new healing();
                            multiheal.recepient = BinaryPrimitives.ReadUInt64BigEndian(payloadData.Slice(cursor + 1));
                            multiheal.caster = last_healer;
                            healing_packs.Add(multiheal);
                            cursor += sizeof(UInt64);
                        }
                        break;
                }
            }
            catch
            {
            }
        }

        private static void pack_damage(ReadOnlySpan<byte> payloadData, int cursor, int sub_packet_length, int begining_of_packet_cursor)
        {
            uint subsubPackLen = 0;

            try
            {
#if DEBUG_FILE
                Random rand = new Random();
                Thread.Sleep(rand.Next(55));
#endif

                UInt64 sub_packet_id = BinaryPrimitives.ReadUInt64BigEndian(payloadData.Slice(cursor));
                cursor += sizeof(UInt64);
                _ = sub_packet_id;

                UInt64 throwaway_uvint64;
                int variable_int_bytesread;
                read_variable_length_uint64(payloadData.Slice(cursor), out throwaway_uvint64, out variable_int_bytesread);
                if (variable_int_bytesread < 0)
                {
                    return;
                }
                cursor += variable_int_bytesread;

                byte sub_item_count = payloadData[cursor];
                cursor += sizeof(byte);
                _ = sub_item_count;

                if (payloadData[cursor] != 0) { cursor = sub_packet_length + begining_of_packet_cursor; return; }
                cursor++;

                cursor++;
                UInt32 actionpack_id = BinaryPrimitives.ReadUInt32BigEndian(payloadData.Slice(cursor));
                cursor += sizeof(UInt32);
                _ = actionpack_id;

                cursor++;
                UInt32 prev_actionpack_id = BinaryPrimitives.ReadUInt32BigEndian(payloadData.Slice(cursor));
                cursor += sizeof(UInt32);
                _ = prev_actionpack_id;

                cursor++;
                byte hit = payloadData[cursor];
                cursor += sizeof(byte);
                _ = hit;

                cursor++;
                byte ttype = payloadData[cursor];
                cursor += sizeof(byte);
                _ = ttype;

                cursor++;
                byte unk1 = payloadData[cursor];
                cursor += sizeof(byte);
                _ = unk1;

                cursor++;
                byte sub_header_flag = payloadData[cursor];
                cursor += sizeof(byte);

                if ((sub_header_flag & 0x1) != 0)
                {
                    cursor++;
                    cursor++;
                    cursor++;
                    cursor += sizeof(UInt32);
                    cursor += sizeof(UInt32);
                    cursor += sizeof(UInt64);
                }

                cursor++;
                UInt32 subsub_packet_count = BinaryPrimitives.ReadUInt32BigEndian(payloadData.Slice(cursor));
                cursor += sizeof(UInt32);

                UInt64 attacker_id = 0;
                UInt64 enemy_id = 0;
                SkillId skill = 0;
                SkillId subskill = 0;
                string throwawaypacket = "";
                const ulong MinPlayerId = 0x0010000000000001;
                const ulong MaxPlayerId = 0x0010010000000001;

                for (int i = 0; i < subsub_packet_count; i++)
                {
                    int subsub_pack_start_cursor = cursor + 8;
                    cursor++;
                    subsubPackLen = BinaryPrimitives.ReadUInt32BigEndian(payloadData.Slice(cursor));

                    cursor += 22;
                    cursor++;

                    UInt32 combatActionID = BinaryPrimitives.ReadUInt32BigEndian(payloadData.Slice(cursor));
                    cursor += sizeof(UInt32);
                    _ = combatActionID;

                    cursor++;
                    UInt64 entityID = BinaryPrimitives.ReadUInt64BigEndian(payloadData.Slice(cursor));
                    cursor += sizeof(UInt64);

                    cursor++;
                    byte subsub_ttype = payloadData[cursor];
                    cursor += sizeof(byte);

                    cursor++;
                    UInt16 stun = BinaryPrimitives.ReadUInt16BigEndian(payloadData.Slice(cursor));
                    cursor += sizeof(UInt16);
                    _ = stun;

                    cursor++;
                    UInt16 skillid = BinaryPrimitives.ReadUInt16BigEndian(payloadData.Slice(cursor));
                    cursor += sizeof(UInt16);

                    cursor++;
                    UInt16 subskillid = BinaryPrimitives.ReadUInt16BigEndian(payloadData.Slice(cursor));
                    cursor += sizeof(UInt16);

                    cursor++;
                    UInt16 subsub_unk1 = BinaryPrimitives.ReadUInt16BigEndian(payloadData.Slice(cursor));
                    cursor += sizeof(UInt16);
                    _ = subsub_unk1;

                    string debugLogPath = GetCombatDebugLogPath();
                    string currentEntityRole = GetCombatEntityRole(subsub_ttype);
                    UInt64 currentCandidateAttackerId = GetCandidateAttackerId(attacker_id, entityID, subsub_ttype);
                    UInt64 currentCandidateEnemyId = GetCandidateEnemyId(enemy_id, entityID, subsub_ttype);
                    WriteCombatInvestigationLog(
                        debugLogPath,
                        FormatCombatDebugRecord(
                            "subsub_packet_observed",
                            currentCandidateAttackerId,
                            currentCandidateEnemyId,
                            entityID,
                            skillid,
                            subskillid,
                            actionpack_id,
                            prev_actionpack_id,
                            combatActionID,
                            damage: null,
                            wound: null,
                            manaDamage: null,
                            options: null,
                            subsub_ttype,
                            cursor,
                            subsub_pack_start_cursor,
                            subsubPackLen,
                            payloadData,
                            currentEntityRole));

                    if ((subsub_ttype & 2) != 0)
                    {
                        attacker_id = entityID;
                        skill = (SkillId)skillid;
                        subskill = (SkillId)subskillid;

                        throwawaypacket = ("throw away packet: " + BitConverter.ToString(payloadData.Slice(subsub_pack_start_cursor + 43, (int)subsubPackLen).ToArray()));
                        _ = throwawaypacket;
                    }

                    if ((subsub_ttype & 1) != 0)
                    {
                        enemy_id = entityID;
                        cursor++;
                        UInt32 options = BinaryPrimitives.ReadUInt32BigEndian(payloadData.Slice(cursor));
                        cursor += sizeof(UInt32);

                        cursor++;
                        float damage = BinaryPrimitives.ReadSingleLittleEndian(payloadData.Slice(cursor));
                        cursor += sizeof(float);

                        cursor++;
                        float wound = BinaryPrimitives.ReadSingleLittleEndian(payloadData.Slice(cursor));
                        cursor += sizeof(float);

                        cursor++;
                        UInt32 manaDamage = BinaryPrimitives.ReadUInt32BigEndian(payloadData.Slice(cursor));
                        cursor += sizeof(UInt32);

                        if ((options & 33554432) != 0)
                        {
                            Debug.WriteLine("multiline found saving packet");
                        }

                        bool attackerInPlayerRange = attacker_id >= MinPlayerId && attacker_id <= MaxPlayerId;
                        WriteCombatInvestigationLog(
                            debugLogPath,
                            FormatCombatDebugRecord(
                                "candidate_before_drop",
                                currentCandidateAttackerId,
                                currentCandidateEnemyId,
                                entityID,
                                skillid,
                                subskillid,
                                actionpack_id,
                                prev_actionpack_id,
                                combatActionID,
                                damage,
                                wound,
                                manaDamage,
                                options,
                                subsub_ttype,
                                cursor,
                                subsub_pack_start_cursor,
                                subsubPackLen,
                                payloadData,
                                currentEntityRole));

                        WriteCombatInvestigationLog(
                            debugLogPath,
                            FormatCombatDebugRecord(
                                attackerInPlayerRange ? "damage_event" : "attacker_out_of_range",
                                attacker_id,
                                enemy_id,
                                entityID,
                                skillid,
                                subskillid,
                                actionpack_id,
                                prev_actionpack_id,
                                combatActionID,
                                damage,
                                wound,
                                manaDamage,
                                options,
                                subsub_ttype,
                                cursor,
                                subsub_pack_start_cursor,
                                subsubPackLen,
                                payloadData,
                                currentEntityRole));

                        if (!attackerInPlayerRange)
                        { break; }

                        if (damage < 0 || damage > 100000000 || skillid == 601 || skillid == 512 || skillid == 590) { break; }

                        WriteCombatInvestigationLog(
                            debugLogPath,
                            FormatCombatDebugRecord(
                                "saved_to_db",
                                attacker_id,
                                enemy_id,
                                entityID,
                                skillid,
                                subskillid,
                                actionpack_id,
                                prev_actionpack_id,
                                combatActionID,
                                damage,
                                wound,
                                manaDamage,
                                options,
                                subsub_ttype,
                                cursor,
                                subsub_pack_start_cursor,
                                subsubPackLen,
                                payloadData,
                                currentEntityRole));

                        LogsController.WriteLog(string.Format("[DAMAGE] Attacker: {0} -> Enemy: {1} for {2}", attacker_id, enemy_id, damage));
                        Debug.WriteLine("Damage {0}, Wound {1}, mana Damage {2}, Attacker {3} {4} -> Enemy {5}, with {6} : {7}", damage.ToString("0.0"), wound.ToString("0.0"), manaDamage, attacker_id, "", enemy_id, skill, subskill);
                        db_helper.add_damage((Int64)attacker_id, damage, wound, (int)manaDamage, (Int64)enemy_id, (int)skill, (int)subskill);
                    }
                    cursor = subsub_pack_start_cursor + (int)subsubPackLen;
                }
            }
            catch (ArgumentOutOfRangeException)
            {
                Debug.WriteLine("Cursor out of range, saving this packet and the next. cursor at {0}, packet length {1}, sub packet length {2}, sub sub packet length {3}", cursor, payloadData.Length, sub_packet_length, subsubPackLen);
                cursor = sub_packet_length + begining_of_packet_cursor;
                savenextpacket = true;
            }
            catch (Exception ex)
            {
                cursor = sub_packet_length + begining_of_packet_cursor;
                Debug.WriteLine("caught an execption after finding a damage packet: ex {0}", ex.ToString());
            }
        }

        private static string GetOpcodeSkillHitLogPath()
        {
            return Path.Combine(AppContext.BaseDirectory, "debug_opcode_skillid_hits.log");
        }

        private static void WriteOpcodeSkillHitLog(string path, string message)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            try
            {
                lock (opcodeSkillHitLogLock)
                {
                    if (!opcodeSkillHitProbeWritten)
                    {
                        string probeLine = $"{DateTime.Now:yyyy-MM-ddTHH:mm:ss.fff} probe=startup log_path=\"{path}\" base_directory=\"{AppContext.BaseDirectory}\"";
                        File.AppendAllText(path, probeLine + Environment.NewLine, Encoding.UTF8);
                        opcodeSkillHitProbeWritten = true;
                    }

                    File.AppendAllText(path, message + Environment.NewLine, Encoding.UTF8);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to write opcode skill hit log '{path}': {ex}");
            }
        }

        private static void ScanPacketForTargetSkillPatterns(ReadOnlySpan<byte> subPacketBytes, uint opcode, uint subPacketLength, int beginningOfPacketCursor)
        {
            string logPath = GetOpcodeSkillHitLogPath();

            foreach (var pattern in opcodeSkillHitPatterns)
            {
                foreach (int hitOffset in FindPatternOffsets(subPacketBytes, pattern.PatternBytes))
                {
                    WriteOpcodeSkillHitLog(
                        logPath,
                        FormatOpcodeSkillHitRecord(
                            opcode,
                            subPacketLength,
                            pattern.SkillId,
                            pattern.PatternType,
                            hitOffset,
                            beginningOfPacketCursor,
                            GetBoundedHexPreviewAroundOffset(subPacketBytes, hitOffset, pattern.PatternBytes.Length, 16, 32)));
                }
            }
        }

        private static List<int> FindPatternOffsets(ReadOnlySpan<byte> buffer, byte[] pattern)
        {
            List<int> hitOffsets = new List<int>();
            if (pattern.Length == 0 || buffer.Length < pattern.Length)
            {
                return hitOffsets;
            }

            for (int i = 0; i <= buffer.Length - pattern.Length; i++)
            {
                if (buffer.Slice(i, pattern.Length).SequenceEqual(pattern))
                {
                    hitOffsets.Add(i);
                }
            }

            return hitOffsets;
        }

        private static string FormatOpcodeSkillHitRecord(
            uint opcode,
            uint subPacketLength,
            ushort targetSkillId,
            string patternType,
            int hitOffset,
            int beginningOfPacketCursor,
            string hexPreview)
        {
            return $"{DateTime.Now:yyyy-MM-ddTHH:mm:ss.fff} reason=skillid_pattern_hit opcode={opcode} opcode_hex=0x{opcode:X8} " +
                   $"subPacketLength={subPacketLength} target_skill_id={targetSkillId} pattern_type={patternType} hit_offset={hitOffset} " +
                   $"beginningOfPacketCursor={beginningOfPacketCursor} hex_preview=\"{hexPreview}\"";
        }

        private static string GetBoundedHexPreviewAroundOffset(ReadOnlySpan<byte> buffer, int hitOffset, int matchLength, int bytesBefore, int bytesAfter)
        {
            try
            {
                if (hitOffset < 0 || hitOffset >= buffer.Length)
                {
                    return string.Empty;
                }

                int previewStart = Math.Max(0, hitOffset - bytesBefore);
                int previewEndExclusive = Math.Min(buffer.Length, hitOffset + matchLength + bytesAfter);
                int previewLength = previewEndExclusive - previewStart;
                if (previewLength <= 0)
                {
                    return string.Empty;
                }

                return BitConverter.ToString(buffer.Slice(previewStart, previewLength).ToArray()).Replace("-", " ");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to build opcode skill hit preview: {ex}");
                return string.Empty;
            }
        }

        private static string GetCombatDebugLogPath()
        {
            return Path.Combine(AppContext.BaseDirectory, "debug_combat_actionpack_subsubs.log");
        }

        private static void WriteCombatInvestigationLog(string? path, string message)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            try
            {
                lock (combatDebugLogLock)
                {
                    if (!combatDebugProbeWritten)
                    {
                        string probeLine = $"{DateTime.Now:yyyy-MM-ddTHH:mm:ss.fff} probe=startup log_path=\"{path}\" base_directory=\"{AppContext.BaseDirectory}\"";
                        File.AppendAllText(path, probeLine + Environment.NewLine, Encoding.UTF8);
                        combatDebugProbeWritten = true;
                    }

                    File.AppendAllText(path, message + Environment.NewLine, Encoding.UTF8);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to write combat debug log '{path}': {ex}");
            }
        }

        private static string FormatCombatDebugRecord(
            string reason,
            ulong attacker_id,
            ulong enemy_id,
            ulong entityID,
            ushort skillid,
            ushort subskillid,
            uint actionpack_id,
            uint prev_actionpack_id,
            uint combatActionID,
            float? damage,
            float? wound,
            uint? manaDamage,
            uint? options,
            byte subsub_ttype,
            int packetCursor,
            int subsubPacketCursor,
            uint subsubPackLen,
            ReadOnlySpan<byte> payloadData,
            string currentEntityRole)
        {
            string timestamp = DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ss.fff");
            string hexPreview = GetHexPreview(payloadData, subsubPacketCursor, subsubPackLen, 64);

            return $"{timestamp} reason={reason} opcode=CombatActionPack " +
                   $"attacker_id={attacker_id} enemy_id={enemy_id} entityID={entityID} skillid={skillid} subskillid={subskillid} " +
                   $"actionpack_id={actionpack_id} prev_actionpack_id={prev_actionpack_id} combatActionID={combatActionID} " +
                   $"damage={(damage.HasValue ? damage.Value.ToString("0.###") : "null")} wound={(wound.HasValue ? wound.Value.ToString("0.###") : "null")} " +
                   $"manaDamage={(manaDamage.HasValue ? manaDamage.Value.ToString() : "null")} options={(options.HasValue ? $"0x{options.Value:X8}" : "null")} " +
                   $"subsub_ttype=0x{subsub_ttype:X2} current_entity_role={currentEntityRole} packet_cursor={packetCursor} subsub_packet_cursor={subsubPacketCursor} subsub_packet_len={subsubPackLen} " +
                   $"hex_preview=\"{hexPreview}\"";
        }

        private static string GetCombatEntityRole(byte subsub_ttype)
        {
            bool isAttacker = (subsub_ttype & 2) != 0;
            bool isEnemy = (subsub_ttype & 1) != 0;

            if (isAttacker && isEnemy)
            {
                return "attacker+enemy";
            }

            if (isAttacker)
            {
                return "attacker";
            }

            if (isEnemy)
            {
                return "enemy";
            }

            return "unknown";
        }

        private static UInt64 GetCandidateAttackerId(UInt64 previousAttackerId, UInt64 entityID, byte subsub_ttype)
        {
            return (subsub_ttype & 2) != 0 ? entityID : previousAttackerId;
        }

        private static UInt64 GetCandidateEnemyId(UInt64 previousEnemyId, UInt64 entityID, byte subsub_ttype)
        {
            return (subsub_ttype & 1) != 0 ? entityID : previousEnemyId;
        }

        private static string GetHexPreview(ReadOnlySpan<byte> payloadData, int start, uint packetLength, int maxPreviewBytes)
        {
            try
            {
                if (start < 0 || start >= payloadData.Length)
                {
                    return string.Empty;
                }

                int boundedLength = (int)Math.Min(packetLength, (uint)maxPreviewBytes);
                boundedLength = Math.Min(boundedLength, payloadData.Length - start);
                if (boundedLength <= 0)
                {
                    return string.Empty;
                }

                byte[] previewBytes = payloadData.Slice(start, boundedLength).ToArray();
                return BitConverter.ToString(previewBytes).Replace("-", " ");
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Failed to build combat debug hex preview: {ex}");
                return string.Empty;
            }
        }

        private static void read_chat(ReadOnlySpan<byte> payloadData, int cursor, int begining_of_packet_cursor)
        {
            try
            {
                UInt64 playerid = BinaryPrimitives.ReadUInt64BigEndian(payloadData.Slice(cursor));

                if (playerid < 0x0010000000000001 || playerid > 0x0010010000000001)
                {
                    return;
                }

                if (character_names.Select(a => a.player_id).Contains(playerid))
                {
                    return;
                }

                cursor = begining_of_packet_cursor + 25;
                byte namelength = payloadData[cursor];

                if (namelength > 36 || namelength <= 1) { return; }
                cursor++;

                string playername = Encoding.UTF8.GetString(payloadData.Slice(cursor, (int)namelength - 1));

                if (string.IsNullOrWhiteSpace(playername)) { return; }
                playername = playername.Trim();
                if (playername.Any(char.IsControl)) { return; }

                if (playername.Length >= 3 && playername.StartsWith("<") && playername.EndsWith(">")) { return; }

                db_helper.add_player(playername, (Int64)playerid);
                LogsController.WriteLog("[PLAYER DISCOVERED]" + playerid.ToString() + " -> " + playername);
                Debug.WriteLine("chat message read, playerid: {0}, username {1}", playerid.ToString(), playername);
            }
            catch
            {
                Debug.WriteLine("couldnt parse a name packet saving packet");
            }
        }

        private static void read_variable_length_uint64(ReadOnlySpan<byte> bytes, out UInt64 parsedint, out int bytesread)
        {
            bytesread = 0;
            parsedint = 0;
            foreach (byte b in bytes)
            {
                if (bytesread == 10)
                {
                    parsedint = 0;
                    bytesread = -1;
                    return;
                }
                if (b < 0x80)
                {
                    if (b > 1 && bytesread == 9)
                    {
                        parsedint = 0;
                        bytesread = -1;
                        return;
                    }
                    parsedint = parsedint | (UInt64)b << bytesread * 8;
                    bytesread += 1;
                    return;
                }
                parsedint |= (UInt64)(b & 127) << (bytesread * 8) - bytesread;
                bytesread += 1;
            }
            parsedint = 0;
            bytesread = -1;
        }

        private static int CompareSequence(uint left, uint right)
        {
            return unchecked((int)(left - right));
        }

        private static void EnsureStreamWithinLimits(TcpStreamKey streamKey, TcpStreamState streamState)
        {
            if (streamState.Buffer.Count <= MaxStreamBufferBytes)
            {
                return;
            }

            ResetStream(streamKey, streamState, $"buffer exceeded {MaxStreamBufferBytes} bytes");
        }

        private static void ResetStream(TcpStreamKey streamKey, TcpStreamState streamState, string reason)
        {
            LogsController.WriteLog($"[TCP] Resetting stream {streamKey}: {reason}");
            streamState.Buffer.Clear();
            streamState.PendingSegments.Clear();
            streamState.NextSequence = null;
        }
    }
}
