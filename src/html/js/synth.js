export function memoryNeededForSfxBuffer(bufferSize, songNotes, noteLength, waves, volumes) {
    const io_period_and_amplitude = 2;
    const sampleU8 = bufferSize;
    const sampleF32 = bufferSize * 4;

    return sampleU8 + sampleF32 + songNotes.length + waves.length + volumes.length + io_period_and_amplitude;
}

export function growMemoryIfNeededForSfxBuffer(memory, bufferSize, songNotes, noteLength, waves, volumes) {
    // the extra 1 is because memory index 0 reserved to mean null
    const totalNeeded = memoryNeededForSfxBuffer(bufferSize, songNotes, noteLength, waves, volumes) + 1;
    if (memory.buffer.byteLength < totalNeeded) {
	memory.grow(totalNeeded - memory.buffer.byteLength);
    }
}

export function createTempSfxBuffer(memory, sfxBuffer, sampleRate, songNotes, noteLength, samplesToFill, waves, volumes, bufferToFill, songIndex, allocatorStart, prev_note_amplitude, prev_note_period, note_partial, segment_partial) {
    let allocatorIndex = allocatorStart || 1;
    let io_previous_note_amplitude = new Uint8Array(memory.buffer, allocatorIndex, 1);
    io_previous_note_amplitude[0] = prev_note_amplitude ?? 127;
    allocatorIndex += 1;	

    let io_note_period = new Uint8Array(memory.buffer, allocatorIndex, 1);
    io_note_period[0] = prev_note_period ?? 0;
    allocatorIndex += 1;

    allocatorIndex = allocateTo(allocatorIndex, 4);
    let io_note_partial = new Uint32Array(memory.buffer, allocatorIndex, 4);
    io_note_partial[0] = note_partial ?? 0;
    allocatorIndex += 4;

    allocatorIndex = allocateTo(allocatorIndex, 4);
    let io_segment_partial = new Int32Array(memory.buffer, allocatorIndex, 4);
    io_segment_partial[0] = segment_partial ?? 0;
    allocatorIndex += 4;

    let inputSong;
    [allocatorIndex, inputSong] = u8ArrayPopulate(memory.buffer, allocatorIndex, songNotes);
    let inputWaves;
    [allocatorIndex, inputWaves] = u8ArrayPopulate(memory.buffer, allocatorIndex, waves);
    let inputVolumes;
    [allocatorIndex, inputVolumes] = u8ArrayPopulate(memory.buffer, allocatorIndex, volumes);

    
    const u8Array = bufferToFill ?? new Uint8Array(memory.buffer, allocatorIndex, samplesToFill);
    if (!bufferToFill) {
	allocatorIndex += u8Array.length;
    }

    // create the sound
    sfxBuffer(
	inputSong.byteOffset, inputSong.length,
	inputWaves.byteOffset, inputWaves.length,
	inputVolumes.byteOffset, inputVolumes.length,
	u8Array.byteOffset, u8Array.length,
	io_previous_note_amplitude.byteOffset,
	io_note_period.byteOffset,
	io_note_partial.byteOffset,
	io_segment_partial.byteOffset,
	sampleRate,
	noteLength,
	songIndex ?? 0,
    );

    return {sample_buffer: u8Array, io_previous_note_amplitude, io_note_period, io_note_partial, io_segment_partial, allocatorIndex};
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
