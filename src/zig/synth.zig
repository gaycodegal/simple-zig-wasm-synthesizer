const pi = 3.14159265358979323846264338327950288419716939937510;

// note frequencies list from https://github.com/nesbox/TIC-80/blob/main/src/core/sound.c MIT license
const NoteHz = [_]u16{ 0x10, 0x11, 0x12, 0x13, 0x15, 0x16, 0x17, 0x18, 0x1a, 0x1c, 0x1d, 0x1f, 0x21, 0x23, 0x25, 0x27, 0x29, 0x2c, 0x2e, 0x31, 0x34, 0x37, 0x3a, 0x3e, 0x41, 0x45, 0x49, 0x4e, 0x52, 0x57, 0x5c, 0x62, 0x68, 0x6e, 0x75, 0x7b, 0x83, 0x8b, 0x93, 0x9c, 0xa5, 0xaf, 0xb9, 0xc4, 0xd0, 0xdc, 0xe9, 0xf7, 0x106, 0x115, 0x126, 0x137, 0x14a, 0x15d, 0x172, 0x188, 0x19f, 0x1b8, 0x1d2, 0x1ee, 0x20b, 0x22a, 0x24b, 0x26e, 0x293, 0x2ba, 0x2e4, 0x310, 0x33f, 0x370, 0x3a4, 0x3dc, 0x417, 0x455, 0x497, 0x4dd, 0x527, 0x575, 0x5c8, 0x620, 0x67d, 0x6e0, 0x749, 0x7b8, 0x82d, 0x8a9, 0x92d, 0x9b9, 0xa4d, 0xaea, 0xb90, 0xc40, 0xcfa, 0xdc0, 0xe91, 0xf6f, 0x105a, 0x1153, 0x125b, 0x1372, 0x149a, 0x15d4, 0x1720, 0x1880 };

const period_per_note = 40;

/// generates 3 periods of each note starting near middle c (256hz, 0xf7)
/// each time it generates 3 periods, it increases the hz until it loops
export fn sfxBuffer(u8Array: [*]u8, u8ArrayLength: usize, sampleRate: u32) void {
    var hz_index: usize = 47;
    var hz = NoteHz[hz_index];
    var samples_per_wave = sampleRate / hz;

    var i: usize = 0;
    var periods_at_note: u8 = 0;

    while (i < u8ArrayLength) : (i += samples_per_wave) {
        const period_or_end = @min(u8ArrayLength, i + samples_per_wave);
        var j: usize = i;
        var period_index: u32 = 0;
        while (j < period_or_end) : (j += 1) {
            u8Array[j] = @floatToInt(u8, @sin(@intToFloat(f32, period_index % samples_per_wave) / @intToFloat(f32, samples_per_wave) * 2 * pi) * 127.5 + 127.5);
            period_index += 1;
        }
        periods_at_note += 1;
        if (periods_at_note >= period_per_note) {
            periods_at_note = 0;
            hz_index += 1;
            if (hz_index >= @min(55, NoteHz.len)) {
                hz_index = 45;
            }
            hz = NoteHz[hz_index];
            samples_per_wave = sampleRate / hz;
        }
    }
}

export fn u8ArrayToF32Array(u8Array: [*]u8, u8ArrayLength: usize, f32Array: [*]f32, f32ArrayLength: usize) void {
    const size = @min(u8ArrayLength, f32ArrayLength);
    for (u8Array[0..size]) |b, i| f32Array[i] = @intToFloat(f32, b) / 128.0 - 1;
}
