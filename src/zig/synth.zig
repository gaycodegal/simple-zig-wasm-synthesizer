const pi = 3.14159265358979323846264338327950288419716939937510;
const u4Tou8WaveTransformConstant: f32 = 255.0 / 15.0;
const waveforms = @import("./waveforms.zig");

extern fn print(text: [*:0]const u8, length: usize) void;

fn print_(text: [:0]const u8) void {
    print(text, text.len);
}

// note frequencies list from https://github.com/nesbox/TIC-80/blob/main/src/core/sound.c MIT license
const NoteHz = [_]u16{ 0x10, 0x11, 0x12, 0x13, 0x15, 0x16, 0x17, 0x18, 0x1a, 0x1c, 0x1d, 0x1f, 0x21, 0x23, 0x25, 0x27, 0x29, 0x2c, 0x2e, 0x31, 0x34, 0x37, 0x3a, 0x3e, 0x41, 0x45, 0x49, 0x4e, 0x52, 0x57, 0x5c, 0x62, 0x68, 0x6e, 0x75, 0x7b, 0x83, 0x8b, 0x93, 0x9c, 0xa5, 0xaf, 0xb9, 0xc4, 0xd0, 0xdc, 0xe9, 0xf7, 0x106, 0x115, 0x126, 0x137, 0x14a, 0x15d, 0x172, 0x188, 0x19f, 0x1b8, 0x1d2, 0x1ee, 0x20b, 0x22a, 0x24b, 0x26e, 0x293, 0x2ba, 0x2e4, 0x310, 0x33f, 0x370, 0x3a4, 0x3dc, 0x417, 0x455, 0x497, 0x4dd, 0x527, 0x575, 0x5c8, 0x620, 0x67d, 0x6e0, 0x749, 0x7b8, 0x82d, 0x8a9, 0x92d, 0x9b9, 0xa4d, 0xaea, 0xb90, 0xc40, 0xcfa, 0xdc0, 0xe91, 0xf6f, 0x105a, 0x1153, 0x125b, 0x1372, 0x149a, 0x15d4, 0x1720, 0x1880 };

const period_per_note = 40;

const Note = struct {
    // nonzero
    waveform: *[32]u4,
    hz: u16,
    note: ?u8,
};

var testSong: [50]u8 = undefined;
var testSongInitialized = false;

fn getNote(pos: usize, song: []u8) Note {
    // if greater than song length, or bad note at index,
    // fake frequency is used, and note is set to null
    var hz: u16 = 256;
    var note: ?u8 = null;
    // don't check < 0, all types are unsigned
    if (pos < song.len) {
        const noteTemp = song[pos];
        if (noteTemp < NoteHz.len) {
            note = noteTemp;
            hz = NoteHz[noteTemp];
        }
    }

    return Note{
        .waveform = &waveforms.SineWave,
        .hz = hz,
        .note = note,
    };
}

fn samplesPerWave(note: Note, sampleRate: u32) u32 {
    if (note.hz == 0) {
        return sampleRate / 256;
    } else {
        return sampleRate / note.hz;
    }
}

// const std = @import("std");
// var buf: [100]u8 = undefined;
// var fba = std.heap.FixedBufferAllocator.init(&buf);
// const allocator = std.heap.FixedBufferAllocator.allocator(&fba);

/// generates 3 periods of each note starting near middle c (256hz, 0xf7)
/// each time it generates 3 periods, it increases the hz until it loops
export fn sfxBuffer(u8Array: [*]u8, u8ArrayLength: usize, sampleRate: u32) void {
    if (!testSongInitialized) {
        testSongInitialized = true;
        const max_note = 55;
        const min_note = 47;
        for (testSong[0..testSong.len]) |*val, pos| {
            val.* = @intCast(u8, pos % (max_note - min_note)) + min_note;
        }
    }

    var previous_note_amplitude: i32 = 7;
    var previous_note_period: u8 = 0;
    var note_period: u8 = 0;

    var song_index: usize = 0;
    var note = getNote(song_index, &testSong);
    var samples_per_wave = samplesPerWave(note, sampleRate);

    var i: usize = 0;
    var periods_at_note: u8 = 0;

    while (i < u8ArrayLength) {
        const period_or_end = @min(u8ArrayLength, i + samples_per_wave);
        var j: usize = i;
        var period_index: u32 = 0;
        // really should extract these into functions
        if (note.note == null) {
            while (j < period_or_end) : (j += 1) {
                u8Array[j] = 127;
                period_index += 1;
            }
        } else {
            while (j < period_or_end) {
                const samples_per_note_slice = samples_per_wave / 32;
                var k: i32 = 0;
                const note_amplitude: i32 = note.waveform[note_period];
                while (j < period_or_end and k < samples_per_note_slice) : (j += 1) {
                    k += 1;
                    const wave_as_u4 = @intToFloat(f32, previous_note_amplitude) + @intToFloat(f32, (note_amplitude - previous_note_amplitude) * k) / @intToFloat(f32, samples_per_note_slice);
                    // if (j < 20) {
                    //     const string = std.fmt.allocPrintZ(allocator, "fuck {d:.1}", .{wave_as_u4 * u4Tou8WaveTransformConstant}) catch unreachable;
                    //     print_(string);
                    //     allocator.free(string);
                    // }
                    u8Array[j] = @floatToInt(u8, wave_as_u4 * u4Tou8WaveTransformConstant);
                } else {
                    // if (j < 20) {
                    //     print_("hereio");
                    // }
                }

                // increment stuff
                previous_note_period = note_period;
                note_period = (note_period + 1) % 32;
                previous_note_amplitude = note_amplitude;
            }
        }
        periods_at_note += 1;
        i += samples_per_wave;
        if (periods_at_note >= period_per_note) {
            periods_at_note = 0;
            song_index += 1;
            previous_note_amplitude = note.waveform[previous_note_period];
            note = getNote(song_index, &testSong);
            samples_per_wave = samplesPerWave(note, sampleRate);
        }
    }
}

export fn u8ArrayToF32Array(u8Array: [*]u8, u8ArrayLength: usize, f32Array: [*]f32, f32ArrayLength: usize) void {
    const size = @min(u8ArrayLength, f32ArrayLength);
    for (u8Array[0..size]) |b, i| f32Array[i] = @intToFloat(f32, b) / 128.0 - 1;
}

test "print assumptions" {
    const std = @import("std");
    const stdout = std.io.getStdOut().writer();
    try stdout.print("Hello, {d}!\n", .{NoteHz.len});
}
