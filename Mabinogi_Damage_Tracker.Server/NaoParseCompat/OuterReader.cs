using System;
using System.Buffers.Binary;

namespace Mabinogi_Damage_Tracker.NaoParseCompat
{
    public class OuterReader
    {
        private readonly byte[] _buf;
        private int _ptr;

        public OuterReader(byte[] buf, int offset)
        {
            _buf = buf;
            _ptr = offset;
        }

        public PacketElementType Peek()
        {
            if (_ptr >= _buf.Length)
            {
                return PacketElementType.None;
            }

            return (PacketElementType)_buf[_ptr];
        }

        public bool NextIs(PacketElementType t)
        {
            return Peek() == t;
        }

        public byte GetByte()
        {
            Expect(PacketElementType.Byte);
            byte value = _buf[_ptr];
            _ptr += sizeof(byte);
            return value;
        }

        public int GetInt()
        {
            Expect(PacketElementType.Int);
            int value = BinaryPrimitives.ReadInt32BigEndian(_buf.AsSpan(_ptr));
            _ptr += sizeof(int);
            return value;
        }

        public long GetLong()
        {
            Expect(PacketElementType.Long);
            long value = BinaryPrimitives.ReadInt64BigEndian(_buf.AsSpan(_ptr));
            _ptr += sizeof(long);
            return value;
        }

        public float GetFloat()
        {
            Expect(PacketElementType.Float);
            float value = BinaryPrimitives.ReadSingleBigEndian(_buf.AsSpan(_ptr));
            _ptr += sizeof(float);
            return value;
        }

        public byte[] GetBin()
        {
            Expect(PacketElementType.Bin);
            ushort len = BinaryPrimitives.ReadUInt16BigEndian(_buf.AsSpan(_ptr));
            _ptr += sizeof(ushort);
            byte[] value = _buf.AsSpan(_ptr, len).ToArray();
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
    }
}
