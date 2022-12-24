
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

let stopMusic = null;

function startMusic() {
    if (stopMusic) {
	stopMusic();
	stopMusic = null;
    }
    if (sampleRate !== lastSampleRate) {
	lastSampleRate = sampleRate;
	audioContext = new AudioContext({sampleRate});
    } else {
	audioContext = audioContext ?? new AudioContext({sampleRate});
    }
    
    context.audioWorklet.addModule('src/html/js/wasm-audio-worklet.js').then(() => {
	let node = new ZigSynthWorkletNode(context);
	node.port.onmessage = (event) => {
	    console.log(event.data);
	};

	node.port.postMessage('from browser');
	
	node.connect(audioContext.destination);

	stopMusic = node.disconnect();
    });
}
