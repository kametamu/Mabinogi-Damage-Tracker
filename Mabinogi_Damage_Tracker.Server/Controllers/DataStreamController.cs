using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Threading.Channels;

[ApiController]
[Route("api/[controller]")]
public class DataStreamController : ControllerBase
{
    private static readonly Channel<object> _DamageStream = Channel.CreateUnbounded<object>();
    private static readonly Channel<object> _DoTstream = Channel.CreateUnbounded<object>();
    private static readonly Channel<object> _TotalDamagestream = Channel.CreateUnbounded<object>();
    private static readonly Channel<object> _DamageMeterStream = Channel.CreateUnbounded<object>();
    private static readonly Channel<object> _LiveSkillDamageStream = Channel.CreateUnbounded<object>();

    public static void WriteDamageStream(object data) => _DamageStream.Writer.TryWrite(data);
    public static void WriteDoTData(object data) => _DoTstream.Writer.TryWrite(data);
    public static void WriteTotalDamageData(object data) => _TotalDamagestream.Writer.TryWrite(data);
    public static void WriteDamageMeterData(object data) => _DamageMeterStream.Writer.TryWrite(data);
    public static void WriteLiveSkillDamageData(object data) => _LiveSkillDamageStream.Writer.TryWrite(data);

    private async Task WriteSse(ChannelReader<object> reader)
    {
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Connection", "keep-alive");

        Response.StatusCode = 200;

        var writer = Response.BodyWriter;
        await foreach (var message in reader.ReadAllAsync())
        {
            var sseLine = $"data: {message}\n\n";
            var bytes = Encoding.UTF8.GetBytes(sseLine);
            await writer.WriteAsync(bytes);
            await writer.FlushAsync();

            if (HttpContext.RequestAborted.IsCancellationRequested)
                break;
        }
    }

    [HttpGet("DamagePacketStream")]
    public async Task DamagePacketStream() => await WriteSse(_DamageStream.Reader);

    [HttpGet("DamageOverTime")]
    public async Task StreamDoT() => await WriteSse(_DoTstream.Reader);

    [HttpGet("TotalDamage")]
    public async Task StreamTotalDamage() => await WriteSse(_TotalDamagestream.Reader);

    [HttpGet("DamageMeter")]
    public async Task StreamDamageMeter() => await WriteSse(_DamageMeterStream.Reader);

    [HttpGet("LiveSkillDamage")]
    public async Task StreamLiveSkillDamage() => await WriteSse(_LiveSkillDamageStream.Reader);
}
