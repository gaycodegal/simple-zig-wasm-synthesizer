export function memoryNeededForSfxBuffer(sampleRate, songNotes, noteLength, secondsLength, waves) {
    const io_period_and_amplitude = 2;
    const sampleU8 = sampleRate * secondsLength;
    const sampleF32 = sampleRate * secondsLength * 4;
    const notesL = songNotes.length;
    const wavesL = waves.length;
    return sampleU8 + sampleF32 + notesL + wavesL + io_period_and_amplitude;
}

export function growMemoryIfNeededForSfxBuffer(memory, sampleRate, songNotes, noteLength, secondsLength, waves) {
    const totalNeeded = memoryNeededForSfxBuffer(sampleRate, songNotes, noteLength, secondsLength, waves);
    if (memory.buffer.byteLength < totalNeeded) {
	memory.grow(totalNeeded - memory.buffer.byteLength);
    }
}

export function createTempSfxBuffer(memory, sfxBuffer, sampleRate, songNotes, noteLength, secondsLength, waves) {
    let allocatorIndex=0;

    let io_previous_note_amplitude = new Uint8Array(memory.buffer, allocatorIndex, 1);
    io_previous_note_amplitude[0] = 7;
    allocatorIndex += 1;	

    let io_note_period = new Uint8Array(memory.buffer, allocatorIndex, 1);
    io_note_period[0] = 0;
    allocatorIndex += 1;

    let inputSong;
    [allocatorIndex, inputSong] = u8ArrayPopulate(memory.buffer, allocatorIndex, songNotes);
    let inputWaves;
    [allocatorIndex, inputWaves] = u8ArrayPopulate(memory.buffer, allocatorIndex, waves);
    const u8Array = new Uint8Array(memory.buffer, allocatorIndex, sampleRate * secondsLength);
    allocatorIndex += u8Array.length;


    // create the sound
    sfxBuffer(
	u8Array.byteOffset, u8Array.length,
	sampleRate,
	inputSong.byteOffset, inputSong.length,
	noteLength,
	inputWaves.byteOffset, inputWaves.length,
	io_previous_note_amplitude.byteOffset,
	io_note_period.byteOffset,
    );

    return {sample_buffer: u8Array, io_previous_note_amplitude, io_note_period, allocatorIndex};
}

export function allocateTo(alloced, size) {
    const mod = alloced % size;
    if (mod != 0){
	alloced += size - mod;
    }
    return alloced;
}

export function u8ArrayPopulate(buffer, allocatorIndex, sourceArray){
    const array = new Uint8Array(buffer, allocatorIndex, sourceArray.length);
    for (var i = 0; i <  sourceArray.length; ++i) {
	array[i] = sourceArray[i];
    }
    allocatorIndex += sourceArray.length;
    return [allocatorIndex, array];
}
