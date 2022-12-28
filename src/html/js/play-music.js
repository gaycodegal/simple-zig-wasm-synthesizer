import { fetchWASMBinary } from './webassembly.js';
import { parseConstants } from './ui-helper.js';

class ZigSynthWorkletNode extends AudioWorkletNode {
    get parameterDescriptors() {
	return [{
	    name: 'test',
	    defaultValue: 0.15
	}];
    }

    constructor(context) {
	super(context, 'zig-synth-worklet-processor');
    }
}

let _stopMusic = null;
let audioContext = null;

export function stopMusic() {
    if (_stopMusic) {
	_stopMusic();
	_stopMusic = null;
    }
}

export async function startMusic() {
    parseConstants(music);
}
export async function music(sampleRate, songNotes, noteLength, secondsLength, waves, volumes) {
    sampleRate = sampleRate ?? 44100;
    stopMusic();

    const wasmBinary = await fetchWASMBinary('src/html/js/synth.wasm');

    if (sampleRate !== window.lastSampleRate) {
	window.lastSampleRate = sampleRate;
	audioContext = new AudioContext({sampleRate});
    } else {
	audioContext = audioContext ?? new AudioContext({sampleRate});
    }
    
    audioContext.audioWorklet.addModule('src/html/js/wasm-audio-worklet.js').then(() => {
	let node = new ZigSynthWorkletNode(audioContext);
	node.port.onmessage = (event) => {
	    if (event.data == "ready") {
		stopMusic();
		node.connect(audioContext.destination);
		_stopMusic = function (){
		    node.disconnect();
		    node.port.postMessage('stop');
		}
	    }
	};

	node.port.postMessage({wasmBinary: wasmBinary});
	node.port.postMessage(musicMessage(sampleRate, songNotes, noteLength, secondsLength, waves, volumes));
    });
}

function musicMessage(sampleRate, songNotes, noteLength, secondsLength, waves, volumes){
    return {
	type: 'music',
	sfx:[{
	    sampleRate,
	    songNotes,
	    noteLength,
	    waves,
	    volumes,
	}],
    };
}

window.startMusic = startMusic;
window.stopMusic = stopMusic;
