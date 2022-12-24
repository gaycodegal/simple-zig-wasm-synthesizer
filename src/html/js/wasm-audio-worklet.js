// in own process, cannot directly interact with browser js
class ZigSynthWorkletProcessor extends AudioWorkletProcessor {
    buffer1 = null;
    buffer2 = null;
    constructor() {
	super();
	this.port.onmessage = (event) => {
	    console.log(event.data);
	};
	
	this.port.postMessage('from audio worklet');
    }

    process(inputs, outputs, parameters) {
	// true -> silent?
	return true;
    }
}

registerProcessor('zig-synth-worklet-processor', ZigSynthWorkletProcessor);
