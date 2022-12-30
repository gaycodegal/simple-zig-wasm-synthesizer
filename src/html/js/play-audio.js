import { synthModule } from './synth-loader.js';
import { u8ArrayPopulate, growMemoryIfNeededForSfxBuffer, allocateTo, createTempSfxBuffer } from './synth.js';
import { parseConstants } from './ui-helper.js';

const synthWASMModulePromise = synthModule();
let audioContext = null;

export async function main(){

    const synthWASMModule = await synthWASMModulePromise;
    
    const {memory, sfxBuffer, u8ArrayToF32Array} = synthWASMModule;
    /**
       play a sound as a buffer

       should be able to play multiple at once
    */
    function playSoundEffect(sampleRate, songNotes, noteLength, secondsLength, waves, volumes) {
	growMemoryIfNeededForSfxBuffer(memory, sampleRate * secondsLength, songNotes, noteLength, waves, volumes);
	
	if (sampleRate !== window.lastSampleRate) {
	    window.lastSampleRate = sampleRate;
	    audioContext = new AudioContext({sampleRate});
	} else {
	    audioContext = audioContext ?? new AudioContext({sampleRate});
	}

	let {sample_buffer, io_previous_note_amplitude, io_note_period, allocatorIndex} = createTempSfxBuffer(memory, sfxBuffer, audioContext.sampleRate, songNotes, noteLength, sampleRate * secondsLength, waves, volumes);

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

export async function _downloadWav(sampleRate, songNotes, noteLength, secondsLength, waves, volumes){
    const synthWASMModule = await synthWASMModulePromise;
    const {memory, sfxBuffer} = synthWASMModule;
    const buffLen = 3200;
    growMemoryIfNeededForSfxBuffer(memory, buffLen, songNotes, noteLength, waves, volumes);
    const hz = sampleRate;
    const buffers = [];
    let io_previous_note_amplitude, io_note_period, io_note_partial, io_segment_partial;
    io_previous_note_amplitude = [127];
    io_note_period = [0];
    io_note_partial = [0];
    io_segment_partial = [0];
    for (var i = 0; i < sampleRate * secondsLength; i += buffLen) {
	const songIndex = ((i / noteLength) | 0);
	let r = createTempSfxBuffer(memory, sfxBuffer, sampleRate, songNotes, noteLength, buffLen, waves, volumes, null, songIndex, 1, io_previous_note_amplitude[0], io_note_period[0], io_note_partial[0], io_segment_partial[0]);
	io_previous_note_amplitude = r.io_previous_note_amplitude;
	io_note_period = r.io_note_period;
	io_note_partial = r.io_note_partial;
	io_segment_partial = r.io_segment_partial;
	
	buffers.push(Array.from(r.sample_buffer));
    }
    const WaveFile = wavefile.WaveFile;
    const wav = new WaveFile();
    wav.fromScratch(1, hz, '8', buffers.flat(), {method: "point", LPF: false});
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
