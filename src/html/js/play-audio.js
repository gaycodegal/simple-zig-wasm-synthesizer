import { synthModule } from './synth-loader.js';
import { u8ArrayPopulate, growMemoryIfNeededForSfxBuffer, allocateTo, createTempSfxBuffer } from './synth.js';

const synthWASMModulePromise = synthModule();
let audioContext = null;

async function __parseConstants(callback){
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
    await callback(sampleRate, songNotes, noteLength, secondsLength, waves);    
}

async function parseConstants(callback){
    try {
	await __parseConstants(callback);
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


export async function main(){

    const synthWASMModule = await synthWASMModulePromise;
    
    const {memory, sfxBuffer, u8ArrayToF32Array} = synthWASMModule;
    /**
       play a sound as a buffer

       should be able to play multiple at once
    */
    function playSoundEffect(sampleRate, songNotes, noteLength, secondsLength, waves) {
	growMemoryIfNeededForSfxBuffer(memory, sampleRate, songNotes, noteLength, secondsLength, waves);
	
	if (sampleRate !== window.lastSampleRate) {
	    window.lastSampleRate = sampleRate;
	    audioContext = new AudioContext({sampleRate});
	} else {
	    audioContext = audioContext ?? new AudioContext({sampleRate});
	}

	let {sample_buffer, io_previous_note_amplitude, io_note_period, allocatorIndex} = createTempSfxBuffer(memory, sfxBuffer, audioContext.sampleRate, songNotes, noteLength, sampleRate * secondsLength, waves);

	allocatorIndex = allocateTo(allocatorIndex, 4);
	const f32Array = new Float32Array(memory.buffer, allocatorIndex, audioContext.sampleRate * secondsLength);
	allocatorIndex += f32Array.length * 4;
	
	const audioBuffer = audioContext.createBuffer(
	    1,
	    audioContext.sampleRate * secondsLength, // secondsLength seconds
	    audioContext.sampleRate
	);
	
	// console.log(sample_buffer);
	
	// copy the sound to Float 32 because webassembly faster
	// we can't just pass the audioBuffer's buffer directly because
	// webassembly can only access memory it owns
	u8ArrayToF32Array(
	    sample_buffer.byteOffset, sample_buffer.length,
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

export async function _downloadWav(sampleRate, songNotes, noteLength, secondsLength, waves){
    const synthWASMModule = await synthWASMModulePromise;
    const {memory, sfxBuffer} = synthWASMModule;
    growMemoryIfNeededForSfxBuffer(memory, sampleRate, songNotes, noteLength, secondsLength, waves);
    const hz = sampleRate;
    let {sample_buffer, io_previous_note_amplitude, io_note_period, allocatorIndex} = createTempSfxBuffer(memory, sfxBuffer, sampleRate, songNotes, noteLength, sampleRate * secondsLength, waves);

    const WaveFile = wavefile.WaveFile;
    const wav = new WaveFile();

    wav.fromScratch(1, hz, '8', sample_buffer, {method: "point", LPF: false});
    download(wav.toDataURI(), "raw_wav_demo.wav");

    function download(d, name){
	const a = document.createElement("a");
	a.textContent = `download ${name}`;
	a.setAttribute("href", d);
	a.setAttribute("download", name);
	a.click();
    }
}

function downloadWav(){
    parseConstants(_downloadWav);
}

window.main = main;
window.downloadWav = downloadWav;
