const synthWASMModulePromise = synthModule();
let audioContext = null;

function __parseConstants(callback){
    const sampleRateEl = document.getElementById("playback-hz");
    const songNotesEl = document.getElementById("notes-to-play");
    const secondsLengthEl = document.getElementById("seconds-length");

    var sampleRate = sampleRateEl.value - 0;
    const songNotes = songNotesEl.value.split(',').map(x=>parseInt(x)).filter(x=>!isNaN(x));
    const secondsLength = secondsLengthEl.value - 0;
    if (sampleRate == 0) {
	sampleRate = 44100;
    }
    callback(sampleRate, songNotes, secondsLength);
    
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
    function playSoundEffect(sampleRate, songNotes, secondsLength) {
	let allocatorIndex=0;
	
	if (sampleRate !== lastSampleRate) {
	    audioContext = new AudioContext();
	} else {
	    audioContext = audioContext ?? new AudioContext();
	}

	const inputSong = new Uint8Array(memory.buffer, allocatorIndex, songNotes.length);
	for (var i = 0; i <  songNotes.length; ++i) {
	    inputSong[i] = songNotes[i];
	}
	allocatorIndex += songNotes.length;
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
	    songNotes.byteOffset, songNotes.length
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

async function downloadWav(sampleRate, songNotes, secondsLength){
    let allocatorIndex=0;
    const synthWASMModule = await synthWASMModulePromise;
    const {memory, sfxBuffer, u8ArrayToF32Array} = synthWASMModule;

    const inputSong = new Uint8Array(memory.buffer, allocatorIndex, songNotes.length);
    for (var i = 0; i <  songNotes.length; ++i) {
	inputSong[i] = songNotes[i];
    }
    allocatorIndex += songNotes.length;


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
	songNotes.byteOffset, songNotes.length
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
