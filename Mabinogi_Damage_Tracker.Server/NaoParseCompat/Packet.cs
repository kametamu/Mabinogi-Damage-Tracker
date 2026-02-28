using System;
using System.Buffers.Binary;

namespace Mabinogi_Damage_Tracker.NaoParseCompat
{
    public enum PacketElementType : byte
    {
        None = 0,
        Byte = 1,
        Short = 2,
        Int = 3,
        Long = 4,
        Float = 5,
        String = 6,
        Bin = 7,
    }

    public class Packet
    {
        private readonly byte[] _buffer;
        private int _ptr;

        public int Op { get; }
        public long Id { get; }

        public Packet(byte[] buffer, int offset)
        {
            _buffer = buffer;
            _ptr = offset;

            Op = BinaryPrimitives.ReadInt32BigEndian(_buffer.AsSpan(_ptr));
            _ptr += sizeof(int);

            Id = BinaryPrimitives.ReadInt64BigEndian(_buffer.AsSpan(_ptr));
            _ptr += sizeof(long);

            _ = ReadVarInt(_buffer, ref _ptr); // bodyLen
            _ = ReadVarInt(_buffer, ref _ptr); // element count

            if (_ptr < _buffer.Length && _buffer[_ptr] == 0x00)
            {
                _ptr++;
            }
        }

        public PacketElementType Peek()
        {
            if (_ptr >= _buffer.Length)
            {
                return PacketElementType.None;
            }

            return (PacketElementType)_buffer[_ptr];
        }

        public bool NextIs(PacketElementType type)
        {
            return Peek() == type;
        }

        public byte GetByte()
        {
            Expect(PacketElementType.Byte);
            byte value = _buffer[_ptr];
            _ptr += sizeof(byte);
            return value;
        }

        public short GetShort()
        {
            Expect(PacketElementType.Short);
            short value = BinaryPrimitives.ReadInt16BigEndian(_buffer.AsSpan(_ptr));
            _ptr += sizeof(short);
            return value;
        }

        public ushort GetUShort()
        {
            Expect(PacketElementType.Short);
            ushort value = BinaryPrimitives.ReadUInt16BigEndian(_buffer.AsSpan(_ptr));
            _ptr += sizeof(ushort);
            return value;
        }

        public int GetInt()
        {
            Expect(PacketElementType.Int);
            int value = BinaryPrimitives.ReadInt32BigEndian(_buffer.AsSpan(_ptr));
            _ptr += sizeof(int);
            return value;
        }

        public long GetLong()
        {
            Expect(PacketElementType.Long);
            long value = BinaryPrimitives.ReadInt64BigEndian(_buffer.AsSpan(_ptr));
            _ptr += sizeof(long);
            return value;
        }

        public float GetFloat()
        {
            Expect(PacketElementType.Float);
            float value = BinaryPrimitives.ReadSingleBigEndian(_buffer.AsSpan(_ptr));
            _ptr += sizeof(float);
            return value;
        }

        public byte[] GetBin()
        {
            Expect(PacketElementType.Bin);
            ushort len = BinaryPrimitives.ReadUInt16BigEndian(_buffer.AsSpan(_ptr));
            _ptr += sizeof(ushort);
            byte[] value = _buffer.AsSpan(_ptr, len).ToArray();
            _ptr += len;
            return value;
        }

        private void Expect(PacketElementType type)
        {
            if (Peek() != type)
            {
                throw new ArgumentOutOfRangeException(nameof(type), $"Expected {type} at {_ptr}, got {Peek()}");
            }

            _ptr++;
        }

        private static ulong ReadVarInt(byte[] buffer, ref int ptr)
        {
            ulong value = 0;
            int shift = 0;

            while (ptr < buffer.Length)
            {
                byte b = buffer[ptr++];
                value |= ((ulong)(b & 0x7F)) << shift;
                if ((b & 0x80) == 0)
                {
                    break;
                }
                shift += 7;
            }

            return value;
        }
    }
}
