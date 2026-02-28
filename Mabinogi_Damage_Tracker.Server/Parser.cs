using Mabinogi_Damage_Tracker;
using PacketDotNet;
using SharpPcap.LibPcap;
using SharpPcap;
using System.Buffers.Binary;
using System.ComponentModel;
using System.Diagnostics;
using System.Text;
using Microsoft.AspNetCore.Identity.UI.Services;
using System;
using System.Linq.Expressions;
using System.Reflection.Metadata.Ecma335;
using SQLitePCL;
using Mabinogi_Damage_Tracker.NaoParseCompat;



namespace Mabinogi_Damage_tracker
{
    public static class Parser
    {
        static CaptureFileWriterDevice captureFileWriter = new CaptureFileWriterDevice("out.pcapng");
        static bool savenextpacket = false;
        static BindingList<Name> character_names = new BindingList<Name>();
        static UInt64 last_healer = 0;
        public static string? adapter_description;
        public static List<string> adapters = new List<string>();
        
        
        public static bool pause = false;
        #if DEBUG_LIVE || RELEASE
            static LibPcapLiveDevice? device = null;
        #endif
        #if DEBUG_FILE
            static CaptureFileReaderDevice device = new CaptureFileReaderDevice("C:/packets/full glenn vhm run.pcapng");
        #endif
        static Thread? reader;


        //i am unconvinced this is the best way to handle the thread managing the event handler
        public static bool Stop()
        {
            if (device == null)
            {
                return true;
            }

            device.Close();
            device.StopCapture();
            device.OnPacketArrival -= Device_OnPacketArrival;
            
            Stopwatch watchdog = Stopwatch.StartNew();
            while (watchdog.ElapsedMilliseconds < 5000 && (device.Opened == true || (reader != null && reader.ThreadState == System.Threading.ThreadState.Running)))
            {
                Thread.Sleep(50);
            }
            if ((reader != null && reader.ThreadState == System.Threading.ThreadState.Running) || device.Opened == true)
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
            //populate a list of adapters for the front end
            adapters = LibPcapLiveDeviceList.Instance.Select(a => a.Description).ToList();
            //check if we have a saved adapter
            adapter_description = db_helper.Get_Local_Adapter();
            if(adapter_description != null && adapter_description !="")
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
                    //lets walk through each adapter and see if we can get a packet
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

            if (device == null)
            {
                return;
            }

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
            catch(Exception ex)
            {
                LogsController.WriteLog("Failed to start parser. execption: " + ex.Message);
            }
        }

        private static void Device_OnPacketArrival(object s, PacketCapture e)
        {
            if(pause == true)
            {
                return;
            }

            //type of message
            DateTime time = e.Header.Timeval.Date;
            int len = e.Data.Length;
            RawCapture raw = e.GetPacket();

            if (savenextpacket)
            {
                savenextpacket = false;
                captureFileWriter.Write(raw);
            }

            PacketDotNet.Packet parsedPacket = PacketDotNet.Packet.ParsePacket(raw.LinkLayerType, raw.Data);

            TcpPacket tcp = parsedPacket.Extract<PacketDotNet.TcpPacket>();

            if(tcp == null) { return; }

            #region packet info
            //each packet has sub packets
            //the first byte of the packet is 'sign' ? dont know what it does
            //the next 4 bytes (byte[1-4]) are a little eden unit32 'length' of the sub packet
            //byte 5 is 'flag' sometimes used as a heart beat or keep alive should always be less than 4
            //packet must have more than 6 bytes + 13 bytes 6 for header 13 for data
            //
            //that completes the header
            //the body starts with an 'opcode' big eden uint32          data packets use opcode 0x7926
            //then an big eden uint64 'id'
            //the next type is a variable int with a max of 64bits. a custom function needs to be written like golang's binary.Uvarint where each byte is checked if its greater than 0x80 and bit shifted until one less than 0x80 is found
            //the above vaiable int is not used for anything
            //
            //then the data of the packet
            //
            //the first byte[0] is how many items are in the data packet this is also a uvarint but we do not care because damage packets are less than 1 byte big (128)
            //the next byte[1] should always be 0
            //the next byte[2] is the data type of the following number using this enumarator
            //          1,2,3,4,5,6,7 
            //          byte, short, int32, long, float, string, bin
            //the reaminder of the packet is data
            //damage packets have a subsub packet that contains the damage. the header of the subpacket (that we are in so far) contains the following
            //uint32 actionpack-id
            //uint32 prev-actionpack-id
            //byte hit
            //byte ttype
            //byte unk1
            //byte flag
            //      we must check flag for 0 if flag is a non zero then the attack was blocked and there is more data, atm these packets are just skipped for future refence it is an int, int, long we could possibly skip this section
            //int subsubpacket-count
            //
            //a sub sub packet is made up of an int and a bin
            //      we skip the int in the subpacket dont know what it does
            //inside the bin of the subsub packet we have the info we want
            //      uint32 combatActionID
            //      uint64 entityID
            //      byte ttype
            //      uint16 stun
            //      uint16 skillid
            //      uint16 subskillid
            //      unit16 unk1
            // we then have to check bits 1 and 2 with a bitewise and on ttype to make sure they are 1 this is done is 2 seperate sup sup packets
            //bitwise and 2 != 0 packet gives the following:
            //              uint64 targetID
            //              uint32 options
            //              byte usedWeaponset
            //              byte weaponParameterType
            //              uint32 unk1
            //              uint32 posX
            //              uint32 posY
            //a bitewise and 1 != 0 packet gives the following:
            //              uint32 options
            //              float damage (wow ding ding ding)
            //              float wound
            //              uint32 manadamage
            //thats the packet structure.

            //main tcp packet
            //      sub game packet
            //          --header start--
            //          byte[1-4]   length        
            //          byte[5]     flag
            //          byte[6-9]   opcode        
            //          byte[10-18] id
            //          byte[19-?]  ?  unisgned, vairable int
            //          --header end--
            //          --sub sub packet beging--
            //          byte[0]     how many items are in the packet also a unsigned variable int but we dont need to check other than making sure its less than 0x80
            //          byte[1] should be 0
            //              --data chunk--
            //              byte[0] data type 1,2,3,4,5,6,7
            //              byte[1-?] data
            //              --end data chuck--
            //          the rest of the packet is data

            //Debug.WriteLine("packet read len {0}", raw.Data.Length);
            #endregion

            int cursor = 0;

                        List<Healing> healing_packs = new List<Healing>();
            

            while (cursor + 10 < tcp.PayloadData.Length)
            { 
                //parse sub packet header
                int begining_of_packet_cursor = cursor;
                byte sign = tcp.PayloadData[cursor];
                cursor += sizeof(byte);

                //we use AsSpan to not chop up the raw packet. this handles creating and disposing a section or snip of the data packet
                UInt32 sub_packet_length = BinaryPrimitives.ReadUInt32LittleEndian(tcp.PayloadData.AsSpan(cursor));
                if (sub_packet_length > 2000 || sub_packet_length == 0)
                {
                    //bad data skip packet
                    continue;
                }
                cursor += sizeof(UInt32);

                byte header_flag = tcp.PayloadData[cursor];
                cursor += sizeof(byte);

                if (sub_packet_length < 5) { cursor = (int)sub_packet_length + begining_of_packet_cursor; continue; }
                if (header_flag > 4 || header_flag == 1 || header_flag == 2) { cursor = (int)sub_packet_length + begining_of_packet_cursor; continue; }

                //header done next is opcode
                UInt32 opcode = BinaryPrimitives.ReadUInt32BigEndian(tcp.PayloadData.AsSpan(cursor));
                cursor += sizeof(UInt32);

                switch(opcode)
                {
                    case Op_Codes.healing:         //healing
                        pack_healing(tcp, cursor, ref healing_packs, (int)sub_packet_length, begining_of_packet_cursor);
                        break;
                    case Op_Codes.ChatMessage:
                        read_chat(tcp, cursor);
                        break;
                    case Op_Codes.CombatActionPack:
                        pack_damage(tcp, cursor, (int)sub_packet_length, begining_of_packet_cursor);
                        break;
                }
                cursor = (int)sub_packet_length + begining_of_packet_cursor; 
                continue; 
            }

            if(healing_packs.Count > 0)
            {
                healing_packs.ForEach(a => a.caster = last_healer);
                foreach (var item in healing_packs)
                {
                    if(item.heal > 10000) { return; }
                    db_helper.add_heal(item.caster, item.recepient, item.heal);
                    LogsController.WriteLog("[HEAL]" + item.caster + "->" + item.recepient + " for " + item.heal);
                    Debug.WriteLine("player {0}, was healed by {1}, for {2}",item.recepient,item.caster,item.heal);
                }
            }

            return;
        }

        private static void pack_healing(TcpPacket tcp, int cursor, ref List<Healing> healing_packs, int sub_packet_length, int begining_of_packet_cursor)
        {
            #region healing packet notes
            //healing packets have 2 back to back opcodes the firstpacket has plain text 'healing'
            //the first packet starts with the caster uid uint64
            //then a flag,
            //0x0A = has the recepient id and the healing value -- it apears that the 2 bytes before the value indicate if it was, hp, mana, stamina, wound
            //0x19 = healing cast which is a packet that says who casted healing on who
            //0x28 = party healing cast
            //0x13 = hands of restoration cast -- note hands of restoration seems to return a 0 when the receptient is at full hp or at all times? all HS skils behaive this way
            //??? = voices of vitality
            //??? = echos of salvation

            //then at location 16 a string indicator with a length of 8 that says 'healing'
            //then a uint64 for the recepiant id
            
            //then right after there should be another healing packet
            //the first section of the packet is a uint64 for the recepient id
            //skip a byte
            //uint16
            //skip 2 bytes
            //byte
            //uint32 healing received
            #endregion
            try
            {
                byte heal_type = tcp.PayloadData[cursor + sizeof(UInt64)];
                Healing healpack = new Healing();

                switch (heal_type)
                {
                    case 0x0A:  //healing received
                        healpack.recepient = BinaryPrimitives.ReadUInt64BigEndian(payload.AsSpan(cursor));
                        healpack.heal = BinaryPrimitives.ReadUInt32BigEndian(tcp.PayloadData.AsSpan(cursor + 17));
                        healing_packs.Add(healpack);
                        break;
                    case 0x19: //healing cast
                        last_healer = BinaryPrimitives.ReadUInt64BigEndian(payload.AsSpan(cursor));
                        break;
                    case 0x28: //party healing
                        last_healer = BinaryPrimitives.ReadUInt64BigEndian(payload.AsSpan(cursor));
                        //get the string length
                        cursor += 19;
                        int stringlength = tcp.PayloadData[cursor];
                        cursor += stringlength;
                        //multiple player ids possible check that we arnt over the sub packet and that they are uint64s
                        while (cursor < sub_packet_length + begining_of_packet_cursor)
                        {
                            if (tcp.PayloadData[cursor] != 4) { break; }
                            Healing multiheal = new Healing();
                            multiheal.recepient = BinaryPrimitives.ReadUInt64BigEndian(tcp.PayloadData.AsSpan(cursor + 1));
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

        private static void pack_damage(TcpPacket tcp, int cursor, int sub_packet_length, int begining_of_packet_cursor)
        {
            byte[]? payload = tcp.PayloadData;
            if (payload == null)
            {
                return;
            }

            try
            {
#if DEBUG_FILE
                Random rand = new Random();
                Thread.Sleep(rand.Next(55));
#endif

                UInt64 sub_packet_id = BinaryPrimitives.ReadUInt64BigEndian(payload.AsSpan(cursor));
                cursor += sizeof(UInt64);

                UInt64 throwaway_uvint64;
                int variable_int_bytesread;
                read_variable_length_uint64(payload.AsSpan(cursor), out throwaway_uvint64, out variable_int_bytesread);
                cursor += variable_int_bytesread;

                byte sub_item_count = payload[cursor];
                cursor += sizeof(byte);

                if (payload[cursor] != 0)
                {
                    return;
                }
                cursor++;

                var reader = new OuterReader(payload, cursor);

                int actionpack_id = reader.GetInt();
                int prev_actionpack_id = reader.GetInt();

                byte hit = reader.GetByte();
                if (hit == 0)
                {
                    return;
                }

                byte maxhits = reader.GetByte();
                reader.GetByte();
                byte sub_header_flag = reader.GetByte();

                int subsub_packet_count = reader.GetInt();

                ushort lastSkillId = 0;
                bool hasSkill = false;

                for (int i = 0; i < subsub_packet_count; i++)
                {
                    int len = reader.GetInt();

                    if (reader.Peek() != PacketElementType.Bin)
                    {
                        reader.GetLong();
                        subsub_packet_count = reader.GetInt();
                        len = reader.GetInt();
                    }

                    byte[] buff = reader.GetBin();
                    var actionPacket = new Mabinogi_Damage_Tracker.NaoParseCompat.Packet(buff, 0);

                    actionPacket.GetInt();
                    long creatureEntityId = actionPacket.GetLong();
                    byte type = actionPacket.GetByte();

                    bool attackerAction = (len < 86 && type != 0);

                    short stun = actionPacket.GetShort();
                    ushort skillId = actionPacket.GetUShort();
                    actionPacket.GetShort();
                    if (actionPacket.Peek() == PacketElementType.Short)
                    {
                        actionPacket.GetShort();
                    }

                    if (attackerAction)
                    {
                        lastSkillId = skillId;
                        hasSkill = true;

                        if (Config.DebugSkillPackets)
                        {
                            LogsController.WriteLog($"[SKILL DEBUG][ATTACKER] len={len} type=0x{type:X2} creature={creatureEntityId} skill={skillId}");
                            if (Config.DebugSkillHex)
                            {
                                LogsController.WriteLog($"[SKILL HEX][ATTACKER] {BitConverter.ToString(buff)}");
                            }
                        }

                        continue;
                    }

                    if (actionPacket.Peek() == PacketElementType.None)
                    {
                        continue;
                    }

                    if (actionPacket.NextIs(PacketElementType.Int))
                    {
                        actionPacket.GetInt();
                    }

                    int alignSteps = 0;
                    while (actionPacket.Peek() != PacketElementType.Float &&
                           actionPacket.Peek() != PacketElementType.None &&
                           alignSteps < 32)
                    {
                        switch (actionPacket.Peek())
                        {
                            case PacketElementType.Byte:
                                actionPacket.GetByte();
                                break;
                            case PacketElementType.Short:
                                actionPacket.GetShort();
                                break;
                            case PacketElementType.Int:
                                actionPacket.GetInt();
                                break;
                            case PacketElementType.Long:
                                actionPacket.GetLong();
                                break;
                            default:
                                alignSteps = 32;
                                break;
                        }
                        alignSteps++;
                    }

                    if (!actionPacket.NextIs(PacketElementType.Float))
                    {
                        continue;
                    }

                    float damage = actionPacket.GetFloat();
                    if (!actionPacket.NextIs(PacketElementType.Float))
                    {
                        continue;
                    }
                    float wound = actionPacket.GetFloat();
                    if (!actionPacket.NextIs(PacketElementType.Int))
                    {
                        continue;
                    }
                    int manaDamage = actionPacket.GetInt();

                    if (actionPacket.NextIs(PacketElementType.Int))
                    {
                        actionPacket.GetInt();
                    }

                    if (actionPacket.NextIs(PacketElementType.Float))
                    {
                        actionPacket.GetFloat();
                    }
                    if (actionPacket.NextIs(PacketElementType.Float))
                    {
                        actionPacket.GetFloat();
                    }

                    if (actionPacket.NextIs(PacketElementType.Float))
                    {
                        actionPacket.GetFloat();
                        if (actionPacket.NextIs(PacketElementType.Float))
                        {
                            actionPacket.GetFloat();
                        }
                        if (actionPacket.NextIs(PacketElementType.Int))
                        {
                            actionPacket.GetInt();
                        }
                    }

                    while (actionPacket.NextIs(PacketElementType.Int))
                    {
                        actionPacket.GetInt();
                    }

                    if (actionPacket.NextIs(PacketElementType.Byte))
                    {
                        actionPacket.GetByte();
                    }
                    if (actionPacket.NextIs(PacketElementType.Int))
                    {
                        actionPacket.GetInt();
                    }

                    if (!actionPacket.NextIs(PacketElementType.Long))
                    {
                        continue;
                    }

                    long attacker = actionPacket.GetLong();
                    long enemy = creatureEntityId;

                    ushort rawSkill = hasSkill ? lastSkillId : (ushort)0;
                    ushort rawSubSkill = 0;

                    if (!hasSkill && Config.DebugSkillPackets)
                    {
                        LogsController.WriteLog($"[SKILL DEBUG][TARGET] no attacker-skill yet. attacker={attacker} enemy={enemy} dmg={damage}");
                    }

                    if (damage < 0 || damage > 100000000)
                    {
                        continue;
                    }

                    if (rawSkill == 601 || rawSkill == 512 || rawSkill == 590)
                    {
                        continue;
                    }

                    if (attacker < 0x0010000000000001 || attacker > 0x0010010000000001)
                    {
                        continue;
                    }

                    var normalized = SkillNormalization.Resolve(rawSkill, rawSubSkill);
                    int effectiveSkillId = normalized.resolvedSkill;

                    if (Config.DebugSkillPackets)
                    {
                        LogsController.WriteLog($"[SKILL DEBUG][TARGET] attacker={attacker} enemy={enemy} dmg={damage:0.###} rawSkill={rawSkill} rawSub={rawSubSkill} resolved={effectiveSkillId} ({normalized.reason})");
                        LogsController.WriteLog($"[SKILL RESOLVE] rawSkill={rawSkill} rawSubSkill={rawSubSkill} resolved={effectiveSkillId}");
                        if (Config.DebugSkillHex)
                        {
                            LogsController.WriteLog($"[SKILL HEX][TARGET] {BitConverter.ToString(buff)}");
                        }
                    }

                    LogsController.WriteLog(string.Format("[DAMAGE] Attacker: {0} -> Enemy: {1} for {2}", attacker, enemy, damage));
                    db_helper.add_damage(attacker, damage, wound, manaDamage, enemy, effectiveSkillId, rawSkill, rawSubSkill);
                }
            }
            catch (ArgumentOutOfRangeException ex)
            {
                cursor = (int)sub_packet_length + begining_of_packet_cursor;
                savenextpacket = true;
                Debug.WriteLine("Cursor out of range while parsing combat packet: {0}", ex.ToString());
            }
            catch (Exception ex)
            {
                cursor = (int)sub_packet_length + begining_of_packet_cursor;
                Debug.WriteLine("caught an execption after finding a damage packet: ex {0}", ex.ToString());
            }
        }

        private static void read_chat(TcpPacket packet, int cursor)
        {
            byte[]? payload = packet.PayloadData;
            if (payload == null)
            {
                return;
            }

            try
            {
                //the next uint64 is the palyer id
                UInt64 playerid = BinaryPrimitives.ReadUInt64BigEndian(payload.AsSpan(cursor));

                if (playerid < 0x0010000000000001 || playerid > 0x0010010000000001)
                {
                    return;
                }

                if (character_names.Select(a => a.player_id).Contains(playerid))
                {
                    return;
                }

                cursor = 25;
                byte namelength = payload[25];

                if (namelength > 36 || namelength <= 1) { return; }
                cursor++;
                //the next [namelength] bytes is the name

                string playername = Encoding.UTF8.GetString(payload, cursor, (int)namelength - 1);
                playername = playername.Trim();

                if (string.IsNullOrWhiteSpace(playername))
                {
                    return;
                }

                // Reject only non-printable control characters
                if (playername.Any(char.IsControl))
                {
                    return;
                }

                //character_names.Add(new Name(playername, playerid));
                db_helper.add_player(playername, (Int64)playerid);
                LogsController.WriteLog("[PLAYER DISCOVERED]" + playerid.ToString() + " -> " + playername);
                Debug.WriteLine("chat message read, playerid: {0}, username {1}", playerid.ToString(), playername);
            }
            catch
            {
                Debug.WriteLine("couldnt parse a name packet saving packet");
                if (payload != null)
                {
                    captureFileWriter.Write(payload);
                }
            }
        }

        private static void read_variable_length_uint64(Span<byte> bytes, out UInt64 parsedint, out int bytesread)
        {
            bytesread = 0;
            parsedint = 0;
            foreach (byte b in bytes)
            {
                if (bytesread == 10)
                {
                    //we read more bytes than we should have return an error
                    parsedint = 0;
                    bytesread = -1;
                    return;
                }
                if (b < 0x80)
                {
                    if (b > 1 && bytesread == 9)
                    {
                        //we read more bytes than we should have return an error
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
            return;
        }

    }
}
