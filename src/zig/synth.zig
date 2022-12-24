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
fn getNote(pos: usize, song: []u8, wave_pos: usize, song_waves: []u8) Note {
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

    var waveform = &waveforms.SilentWave;
    if (wave_pos < song_waves.len) {
        const bank_pos = song_waves[wave_pos];
        if (bank_pos < waveforms.WaveBank.len) {
            waveform = waveforms.WaveBank[bank_pos];
        } else if (wave_pos == 0) {
            print_("second fail");
        }
    } else if (wave_pos == 0) {
        print_("first fail");
    }

    return Note{
        .waveform = waveform,
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
export fn sfxBuffer(out_sampleArrayPointer: [*]u8, out_sampleArrayLength: usize, sampleRate: u32, in_songNotesPointer: [*]u8, in_songNotesLength: usize, noteLength: u32, in_noteWaveFormsPointer: [*]u8, in_noteWaveFormsLength: usize) void {
    const sample_array = out_sampleArrayPointer[0..out_sampleArrayLength];

    var chosenSong = in_songNotesPointer[0..in_songNotesLength];
    const noteWaveForms = in_noteWaveFormsPointer[0..in_noteWaveFormsLength];

    var previous_note_amplitude: i32 = 7;
    // notes have waveforms, which are all 32 in length.
    // as we're writing the note to the output sample buffer
    // we need to move from index to index inside the note's
    // waveform, and this keeps track of it.
    //
    // When we swap notes we want a smooth transition
    // from note to note, so the next note keeps playing its
    // own waveform from whatever position the previous
    // note was at when it stopped.
    //
    // This is especially useful when swapping between
    // notes of the same waveform but different frequencies (hz)
    // which allows us to smoothly transition between them
    // without 'audio clicking'.
    var note_period: u8 = 0;

    // index into the chosenSong
    var song_index: usize = 0;
    var wave_index: usize = 0;
    var note = getNote(song_index, chosenSong, wave_index, noteWaveForms);
    var samples_per_wave = samplesPerWave(note, sampleRate);

    // index into the output sample_array
    var sample_index: usize = 0;

    // each loop of this array should write one note's worth of samples
    // to the sample_array or an equivalent amount of silence
    while (sample_index < sample_array.len) {

        // we want to write out the next full note to the sample_array,
        // but can't overshoot the length.
        // notes are noteLength long in samples
        //
        // maybe i should consider writing silence if we can't fit in a
        // full note, but i think this is a fine default for now.
        // change it yourself if it is inconvienient for you.
        // you shouldn't have to, as you pass in both out_sampleArrayLength,
        // and noteLength, so just make sure the former is divisible
        // evenly by the latter
        const sample_index_iter_end = @min(sample_array.len, sample_index + noteLength);

        if (note.note == null) {
            // write silence to the buffer for a null note
            while (sample_index < sample_index_iter_end) : (sample_index += 1) {
                sample_array[sample_index] = 127;
            }
        } else {
            // write noteLength many samples of note to the sample_array
            // increase the sample_index accordingly,
            // and save information like note_period and
            // previous_note_amplitude, which are required to smoothly
            // transition into the next note.
            const updates = sfxBufferPlayNoteUntilIndex(sample_index, sample_index_iter_end, sample_array, samples_per_wave, note, note_period, previous_note_amplitude);
            sample_index = updates.sample_index;
            note_period = updates.note_period;
            previous_note_amplitude = updates.previous_note_amplitude;
        }

        // play the next note
        if (true) {
            song_index += 1;
            // loop the song. could have used modulo, but may add additional
            // logic later
            if (song_index >= chosenSong.len) {
                song_index = 0;
            }
            wave_index += 1;
            // loop the waveforms. could have used modulo, but may
            // add additional logic later
            if (wave_index >= noteWaveForms.len) {
                wave_index = 0;
            }
            note = getNote(song_index, chosenSong, wave_index, noteWaveForms);
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

    // the outer loop ensures the inner loop has done enough iterations
    // to fill out the whole note length
    while (sample_index < sample_index_iter_end) {

        // this inner loop only fills in one period.
        // we need the two loops because samples_left_to_do needs to
        // be tracked over time and allows for error corrections
        // when samples_per_note is not evenly divisible
        // into the note.waveform.len (common)
        //
        // if we did not do this, notes could only be evenly divisible
        // frequencies
        var samples_left_to_do: i32 = @intCast(i32, samples_per_wave);
        while (sample_index < sample_index_iter_end and samples_left_to_do > 0) {
            // bookkeeping to ensure error correction for uneven divisibility
            // is taken into account
            const samples_per_note_slice: i32 = @divFloor(samples_left_to_do, @intCast(i32, note.waveform.len - note_period));
            samples_left_to_do -= samples_per_note_slice;

            // write one slice of the note to the sample_array
            // what is a note slice? well since notes have 32 samples
            // in their wave form, and we want to evenly interpolate between
            // those samples, one slice is the number of samples from
            // one waveform index to the next.
            var k: i32 = 0;
            const note_amplitude: i32 = note.waveform[note_period];
            while (sample_index < sample_index_iter_end and k < samples_per_note_slice) : (sample_index += 1) {
                k += 1;
                // waves are u4 and we must convert that to our
                // own output format, u8.
                //
                // currently we fill out the full 0-255 space.
                // this formula is part linear interpolation, and
                // part correcting for the transition from u4 to u8
                const wave_as_u4 = @intToFloat(f32, previous_note_amplitude) + @intToFloat(f32, (note_amplitude - previous_note_amplitude) * k) / @intToFloat(f32, samples_per_note_slice);

                out_sampleArray[sample_index] = @floatToInt(u8, wave_as_u4 * u4Tou8WaveTransformConstant);
            }

            // increment note period so we play the next part of the waveform
            // on the next pass
            note_period = (note_period + 1) % 32;
            // keep track of the previous amplitude, because
            // we need to interpolate from it to the next note
            // on the next round this code is run.
            previous_note_amplitude = note_amplitude;
        }
    }
    return .{
        .sample_index = sample_index,
        .note_period = note_period,
        .previous_note_amplitude = previous_note_amplitude,
    };
}

/// Converts unsigned 8 bit wave data to float 32 wave data.
/// 8 bit is 0-256
/// float 32 is -1.0 to 1.0
export fn u8ArrayToF32Array(in_u8Array: [*]const u8, in_u8ArrayLength: usize, out_f32Array: [*]f32, out_f32ArrayLength: usize) void {
    const size = @min(in_u8ArrayLength, out_f32ArrayLength);
    for (in_u8Array[0..size]) |b, i| out_f32Array[i] = @intToFloat(f32, b) / 128.0 - 1;
}

test "print assumptions" {
    const std = @import("std");
    const stdout = std.io.getStdOut().writer();
    try stdout.print("Hello, {d}!\n", .{NoteHz.len});
}
