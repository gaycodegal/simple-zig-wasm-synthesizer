const synthWASMModulePromise = synthModule();
let audioContext = null;

function __parseConstants(callback){
    const sampleRateEl = document.getElementById("playback-hz");
    const songNotesEl = document.getElementById("notes-to-play");
    const wavesEl = document.getElementById("waves-to-play");
    const noteLengthEl = document.getElementById("note-length");
    const secondsLengthEl = document.getElementById("seconds-length");

    var sampleRate = sampleRateEl.value - 0;
    const songNotes = songNotesEl.value.split(',').map(x=>parseInt(x)).filter(x=>!isNaN(x));
    const waves = wavesEl.value.split(',').map(x=>parseInt(x)).filter(x=>!isNaN(x));
    const noteLength = noteLengthEl.value - 0;
    const secondsLength = secondsLengthEl.value - 0;
    if (sampleRate == 0) {
	sampleRate = 44100;
    }
    if (noteLength == 0) {
	noteLength = 100;
    }
    if (songNotes.length == 0) {
	throw new Error("must include notes to play");
    }
    callback(sampleRate, songNotes, noteLength, secondsLength, waves);    
}

function parseConstants(callback){
    try{
	__parseConstants(callback);
    } catch(e){
	printError(`${e.name} ${e.message}`);
    }
}

function print(text){
    const output = document.getElementById("output");
    output.textContent = text;
}

function printError(text){
    const output = document.getElementById("output");
    output.textContent = `error: ${text}`;
    output.classList = "error";
}

let lastSampleRate = 0;

function allocateTo(alloced, size) {
    const mod = alloced % size;
    if (mod != 0){
	alloced += size - mod;
    }
    return alloced;
}

async function main(){

    const synthWASMModule = await synthWASMModulePromise;
    
    const {memory, sfxBuffer, u8ArrayToF32Array} = synthWASMModule;
    /**
       play a sound as a buffer

       should be able to play multiple at once
    */
    function playSoundEffect(sampleRate, songNotes, noteLength, secondsLength, waves) {
	growMemoryIfNeededForSfxBuffer(memory, sampleRate, songNotes, noteLength, secondsLength, waves);
	
	let allocatorIndex=0;
	
	if (sampleRate !== lastSampleRate) {
	    audioContext = new AudioContext({sampleRate});
	} else {
	    audioContext = audioContext ?? new AudioContext({sampleRate});
	}
	let inputSong;
	[allocatorIndex, inputSong] = u8ArrayPopulate(memory.buffer, allocatorIndex, songNotes);
	let inputWaves;
	[allocatorIndex, inputWaves] = u8ArrayPopulate(memory.buffer, allocatorIndex, waves);
	const u8Array = new Uint8Array(memory.buffer, allocatorIndex, audioContext.sampleRate * secondsLength);
	allocatorIndex += u8Array.length;

	// abusing the fact that javascript is single threaded to only allocate
	// memory during this function, and disposing of it afterwards.
	// assumes the memory address space is big enough to fit in both
	// arrays into memory. I should fix that
	allocatorIndex = allocateTo(allocatorIndex, 4);
	const f32Array = new Float32Array(memory.buffer, allocatorIndex, audioContext.sampleRate * secondsLength);
	allocatorIndex += f32Array.length * 4;
	
	const audioBuffer = audioContext.createBuffer(
	    1,
	    audioContext.sampleRate * secondsLength, // secondsLength seconds
	    audioContext.sampleRate
	);


	// create the sound
	sfxBuffer(
	    u8Array.byteOffset, u8Array.length,
	    audioContext.sampleRate,
	    inputSong.byteOffset, inputSong.length,
	    noteLength,
	    inputWaves.byteOffset, inputWaves.length,
	);
	//console.log(u8Array);
	
	// copy the sound to Float 32 because webassembly faster
	// we can't just pass the audioBuffer's buffer directly because
	// webassembly can only access memory it owns
	u8ArrayToF32Array(
	    u8Array.byteOffset, u8Array.length,
	    f32Array.byteOffset, f32Array.length);

	// copy the Float 32 to the audio context
	audioBuffer.getChannelData(0).set(f32Array);
	
	// actually play the buffer
	const bufferSource = audioContext.createBufferSource();
	bufferSource.buffer = audioBuffer;
	bufferSource.connect(audioContext.destination);
	bufferSource.start();
    }

    parseConstants(playSoundEffect);
}

async function downloadWav(sampleRate, songNotes, noteLength, secondsLength, waves){
    growMemoryIfNeededForSfxBuffer(memory, sampleRate, songNotes, noteLength, secondsLength, waves);
    let allocatorIndex=0;
    const synthWASMModule = await synthWASMModulePromise;
    const {memory, sfxBuffer, u8ArrayToF32Array} = synthWASMModule;

    let inputSong;
    [allocatorIndex, inputSong] = u8ArrayPopulate(memory.buffer, allocatorIndex, songNotes);
    let inputWaves;
    [allocatorIndex, inputWaves] = u8ArrayPopulate(memory.buffer, allocatorIndex, waves);


    const hz = sampleRate;
    const length = hz * secondsLength;

    const u8Array = new Uint8Array(memory.buffer, allocatorIndex, length);
    allocatorIndex += length;
    const WaveFile = wavefile.WaveFile;
    wav = new WaveFile();


    // create the sound
    sfxBuffer(
	u8Array.byteOffset, u8Array.length,
	sampleRate,
	inputSong.byteOffset, inputSong.length,
	noteLength,
	inputWaves.byteOffset, inputWaves.length,
    );

    wav.fromScratch(1, hz, '8', u8Array, {method: "point", LPF: false});
    download(wav.toDataURI(), "raw_wav_demo.wav");

    function download(d, name){
	const a = document.createElement("a");
	a.textContent = `download ${name}`;
	a.setAttribute("href", d);
	a.setAttribute("download", name);
	a.click();
    }
}

function growMemoryIfNeededForSfxBuffer(memory, sampleRate, songNotes, noteLength, secondsLength, waves){
    const sampleU8 = sampleRate * secondsLength;
    const sampleF32 = sampleRate * secondsLength * 4;
    const notesL = songNotes.length;
    const wavesL = waves.length;
    const totalNeeded = sampleU8 + sampleF32 + notesL + wavesL;
    if (memory.buffer.byteLength < totalNeeded) {
	memory.grow(totalNeeded - memory.buffer.byteLength);
    }
}

function u8ArrayPopulate(buffer, allocatorIndex, sourceArray){
    const array = new Uint8Array(buffer, allocatorIndex, sourceArray.length);
    for (var i = 0; i <  sourceArray.length; ++i) {
	array[i] = sourceArray[i];
    }
    allocatorIndex += sourceArray.length;
    return [allocatorIndex, array];
}
