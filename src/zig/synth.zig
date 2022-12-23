const pi = 3.14159265358979323846264338327950288419716939937510;
/// u4 waves have to be multiplied by 17 to get them in the range 0 - 255
const u4Tou8WaveTransformConstant: f32 = 255.0 / 15.0;

const waveforms = @import("./waveforms.zig");

/// if we have to print a string to javascript, we can do it
/// without allocating memory for predefined strings
/// but it would be better to get a putch version in here
/// as that can do formatting without allocation...
extern fn print(text: [*:0]const u8, length: usize) void;

fn print_(text: [:0]const u8) void {
    print(text, text.len);
}

/// note frequencies list from https://github.com/nesbox/TIC-80/blob/main/src/core/sound.c MIT license
const NoteHz = [_]u16{ 0x10, 0x11, 0x12, 0x13, 0x15, 0x16, 0x17, 0x18, 0x1a, 0x1c, 0x1d, 0x1f, 0x21, 0x23, 0x25, 0x27, 0x29, 0x2c, 0x2e, 0x31, 0x34, 0x37, 0x3a, 0x3e, 0x41, 0x45, 0x49, 0x4e, 0x52, 0x57, 0x5c, 0x62, 0x68, 0x6e, 0x75, 0x7b, 0x83, 0x8b, 0x93, 0x9c, 0xa5, 0xaf, 0xb9, 0xc4, 0xd0, 0xdc, 0xe9, 0xf7, 0x106, 0x115, 0x126, 0x137, 0x14a, 0x15d, 0x172, 0x188, 0x19f, 0x1b8, 0x1d2, 0x1ee, 0x20b, 0x22a, 0x24b, 0x26e, 0x293, 0x2ba, 0x2e4, 0x310, 0x33f, 0x370, 0x3a4, 0x3dc, 0x417, 0x455, 0x497, 0x4dd, 0x527, 0x575, 0x5c8, 0x620, 0x67d, 0x6e0, 0x749, 0x7b8, 0x82d, 0x8a9, 0x92d, 0x9b9, 0xa4d, 0xaea, 0xb90, 0xc40, 0xcfa, 0xdc0, 0xe91, 0xf6f, 0x105a, 0x1153, 0x125b, 0x1372, 0x149a, 0x15d4, 0x1720, 0x1880 };

/// This contains the basic information to play one note
const Note = struct {
    /// nonzero
    waveform: *[32]u4,
    hz: u16,
    note: ?u8,
};

/// get the note to play at a position of the song, or "silence"
/// fake note otherwise.
///
/// a silent note has .note set to null
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

/// get how many samples a note should play for
/// given the sampleRate
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

/// write a sfx defined by the notes of "in_songNotes"
/// to the output buffer out_sampleArray.
///
/// songNotes should be indexes into NoteHz, or in other words
/// values from 0 to 103. Any other notes will be treated as silence.
///
/// this will fill out the whole of out_sampleArray, and any samples
/// after the end of this sound effect will be set to 127 or "silence"
///
/// the out_sampleArray is a 8 bit waveform buffer
export fn sfxBuffer(out_sampleArrayPointer: [*]u8, out_sampleArrayLength: usize, sampleRate: u32, in_songNotesPointer: [*]u8, in_songNotesLength: usize, noteLength: u32) void {
    const sample_array = out_sampleArrayPointer[0..out_sampleArrayLength];

    var chosenSong = in_songNotesPointer[0..in_songNotesLength];

    var previous_note_amplitude: i32 = 7;
    var note_period: u8 = 0;

    var song_index: usize = 0;
    var note = getNote(song_index, chosenSong);
    var samples_per_wave = samplesPerWave(note, sampleRate);

    var sample_index: usize = 0;

    while (sample_index < sample_array.len) {
        const sample_index_iter_end = @min(sample_array.len, sample_index + noteLength);

        // really should extract these into functions
        if (note.note == null) {
            while (sample_index < sample_index_iter_end) : (sample_index += 1) {
                sample_array[sample_index] = 127;
            }
        } else {
            const updates = sfxBufferPlayNoteUntilIndex(sample_index, sample_index_iter_end, sample_array, samples_per_wave, note, note_period, previous_note_amplitude);
            sample_index = updates.sample_index;
            note_period = updates.note_period;
            previous_note_amplitude = updates.previous_note_amplitude;
        }

        if (true) {
            song_index += 1;
            if (song_index >= chosenSong.len) {
                song_index = 0;
            }
            note = getNote(song_index, chosenSong);
            samples_per_wave = samplesPerWave(note, sampleRate);
        }
    }
}

/// since sfxBufferPlayNoteUntilIndex is meant to be inline
/// we need to change multiple values, which are these
const sfxBufferPlayNoteUntilIndexValues = struct {
    sample_index: usize,
    note_period: u8,
    previous_note_amplitude: i32,
};

/// write a single note's waveform to the output out_sampleArray buffer
/// for the length defined from start_index_start to sample_index_iter_end
fn sfxBufferPlayNoteUntilIndex(sample_index_start: usize, sample_index_iter_end: usize, out_sampleArray: []u8, samples_per_wave: u32, note: Note, note_period_start: u8, previous_note_amplitude_start: i32) sfxBufferPlayNoteUntilIndexValues {
    var sample_index = sample_index_start;
    var note_period = note_period_start;
    var previous_note_amplitude = previous_note_amplitude_start;

    while (sample_index < sample_index_iter_end) {
        var samples_left_to_do: i32 = @intCast(i32, samples_per_wave);
        while (sample_index < sample_index_iter_end and samples_left_to_do > 0) {
            const samples_per_note_slice: i32 = @divFloor(samples_left_to_do, @intCast(i32, note.waveform.len - note_period));
            samples_left_to_do -= samples_per_note_slice;

            var k: i32 = 0;
            const note_amplitude: i32 = note.waveform[note_period];
            while (sample_index < sample_index_iter_end and k < samples_per_note_slice) : (sample_index += 1) {
                k += 1;
                const wave_as_u4 = @intToFloat(f32, previous_note_amplitude) + @intToFloat(f32, (note_amplitude - previous_note_amplitude) * k) / @intToFloat(f32, samples_per_note_slice);

                out_sampleArray[sample_index] = @floatToInt(u8, wave_as_u4 * u4Tou8WaveTransformConstant);
            }

            // increment stuff
            note_period = (note_period + 1) % 32;
            previous_note_amplitude = note_amplitude;
        }
    }
    return .{
        .sample_index = sample_index,
        .note_period = note_period,
        .previous_note_amplitude = previous_note_amplitude,
    };
}

export fn u8ArrayToF32Array(in_u8Array: [*]const u8, in_u8ArrayLength: usize, out_f32Array: [*]f32, out_f32ArrayLength: usize) void {
    const size = @min(in_u8ArrayLength, out_f32ArrayLength);
    for (in_u8Array[0..size]) |b, i| out_f32Array[i] = @intToFloat(f32, b) / 128.0 - 1;
}

test "print assumptions" {
    const std = @import("std");
    const stdout = std.io.getStdOut().writer();
    try stdout.print("Hello, {d}!\n", .{NoteHz.len});
}
