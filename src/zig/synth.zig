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
export fn sfxBuffer(u8ArrayPointer: [*]u8, u8ArrayLength: usize, sampleRate: u32, songNotesPointer: [*]u8, songNotesLength: usize) void {
    const sample_array = u8ArrayPointer[0..u8ArrayLength];
    if (!testSongInitialized) {
        testSongInitialized = true;
        const max_note = 55;
        const min_note = 47;
        for (testSong[0..testSong.len]) |*val, pos| {
            val.* = @intCast(u8, pos % (max_note - min_note)) + min_note;
        }
    }

    var chosenSong = if (songNotesLength == 0)
        &testSong
    else
        songNotesPointer[0..songNotesLength];

    var previous_note_amplitude: i32 = 7;
    var note_period: u8 = 0;

    var song_index: usize = 0;
    var note = getNote(song_index, chosenSong);
    var samples_per_wave = samplesPerWave(note, sampleRate);

    var i: usize = 0;
    var periods_at_note: u8 = 0;

    while (i < sample_array.len) {
        const period_or_end = @min(sample_array.len, i + samples_per_wave);
        var sample_index: usize = i;
        var period_index: u32 = 0;
        // really should extract these into functions
        if (note.note == null) {
            while (sample_index < period_or_end) : (sample_index += 1) {
                sample_array[sample_index] = 127;
                period_index += 1;
            }
        } else {
            const updates = sfxBufferOnePeriod(sample_index, sample_array, samples_per_wave, note, note_period, period_or_end, previous_note_amplitude);
            sample_index = updates.sample_index;
            note_period = updates.note_period;
            previous_note_amplitude = updates.previous_note_amplitude;
        }
        periods_at_note += 1;
        i += samples_per_wave;
        if (periods_at_note >= period_per_note) {
            periods_at_note = 0;
            song_index += 1;
            if (song_index >= chosenSong.len) {
                song_index = 0;
            }
            note = getNote(song_index, chosenSong);
            samples_per_wave = samplesPerWave(note, sampleRate);
        }
    }
}

const sfxBufferOnePeriodValues = struct {
    sample_index: usize,
    note_period: u8,
    previous_note_amplitude: i32,
};

fn sfxBufferOnePeriod(sample_index_start: usize, sample_array: []u8, samples_per_wave: u32, note: Note, note_period_start: u8, period_or_end: usize, previous_note_amplitude_start: i32) sfxBufferOnePeriodValues {
    var sample_index = sample_index_start;
    var note_period = note_period_start;
    var previous_note_amplitude = previous_note_amplitude_start;

    var samples_left_to_do: i32 = @intCast(i32, samples_per_wave);
    while (sample_index < period_or_end and samples_left_to_do > 0) {
        const samples_per_note_slice: i32 = @divFloor(samples_left_to_do, @intCast(i32, note.waveform.len - note_period));
        samples_left_to_do -= samples_per_note_slice;

        var k: i32 = 0;
        const note_amplitude: i32 = note.waveform[note_period];
        while (sample_index < period_or_end and k < samples_per_note_slice) : (sample_index += 1) {
            k += 1;
            const wave_as_u4 = @intToFloat(f32, previous_note_amplitude) + @intToFloat(f32, (note_amplitude - previous_note_amplitude) * k) / @intToFloat(f32, samples_per_note_slice);

            sample_array[sample_index] = @floatToInt(u8, wave_as_u4 * u4Tou8WaveTransformConstant);
        }

        // increment stuff
        note_period = (note_period + 1) % 32;
        previous_note_amplitude = note_amplitude;
    }
    return .{
        .sample_index = sample_index,
        .note_period = note_period,
        .previous_note_amplitude = previous_note_amplitude,
    };
}

export fn u8ArrayToF32Array(u8Array: [*]u8, u8ArrayLength: usize, f32Array: [*]f32, f32ArrayLength: usize) void {
    const size = @min(u8ArrayLength, f32ArrayLength);
    for (u8Array[0..size]) |b, i| f32Array[i] = @intToFloat(f32, b) / 128.0 - 1;
}

test "print assumptions" {
    const std = @import("std");
    const stdout = std.io.getStdOut().writer();
    try stdout.print("Hello, {d}!\n", .{NoteHz.len});

    if (!testSongInitialized) {
        testSongInitialized = true;
        const max_note = 55;
        const min_note = 47;
        for (testSong[0..testSong.len]) |*val, pos| {
            val.* = @intCast(u8, pos % (max_note - min_note)) + min_note;
            try stdout.print("{d}, ", .{NoteHz[val.*]});
        }
    }
}
