import { synthModule } from './synth-loader.js';
import { u8ArrayPopulate, growMemoryIfNeededForSfxBuffer, allocateTo, createTempSfxBuffer } from './synth.js';

// in own process, cannot directly interact with browser js
class ZigSynthWorkletProcessor extends AudioWorkletProcessor {
    mainBuffer = null;
    songIndex = 0;
    indexFloatCopyBuffer = 0;
    indexMainBuffer = 0;
    last_note_amplitude = 127;
    last_note_period = 0;
    last_segment_partial = 0;
    last_note_partial = 0;
    running = true;
    music = null;
    
    constructor() {
	super();
	this.port.onmessage = async function (event) {
	    if (event.data.wasmBinary) {
		await this.initWASM(event.data.wasmBinary);
		this.port.postMessage('ready');
	    } else if (event.data == 'stop') {
		this.running = false;
	    } else if (event.data.type == 'music') {
		this.music = event.data;

	    }
	};
	this.port.onmessage = this.port.onmessage.bind(this);
    }

    async initWASM(wasmBinary) {
	const synthWASM = await synthModule(wasmBinary);
	this.memory = synthWASM.memory;
	this.sfxBuffer = synthWASM.sfxBuffer;
	this.u8ArrayToF32Array = synthWASM.u8ArrayToF32Array;
    }

    sampleAlign(samplesRequired, sfx) {
	if (samplesRequired % sfx.noteLength != 0) {
	    samplesRequired += sfx.noteLength - (samplesRequired % sfx.noteLength);
	}
	return samplesRequired;
    }

    initMainBuffer(samplesRequired, sfx) {
	samplesRequired = 3200;//this.sampleAlign(samplesRequired, sfx);
	// 0 reserved for null
	let allocatorIndex = 1;
	this.mainBuffer = new Uint8Array(this.memory.buffer, allocatorIndex, samplesRequired);
    }

    allocatedTo() {
	return this.floatCopyBuffer.byteOffset + this.floatCopyBuffer.length * 4;
    }

    initFloatCopyBuffer(samplesRequired){
	let allocatorIndex = this.mainBuffer.byteOffset + this.mainBuffer.length;

	allocatorIndex = allocateTo(allocatorIndex, 4);
	this.floatCopyBuffer = new Float32Array(this.memory.buffer, allocatorIndex, samplesRequired);
    }

    fillBuffer (buffer, sfx) {
	const samplesRequired = buffer.length;
	const result = createTempSfxBuffer(this.memory, this.sfxBuffer, sfx.sampleRate, sfx.songNotes, sfx.noteLength, samplesRequired, sfx.waves, sfx.volumes, buffer, this.songIndex, this.allocatedTo(), this.last_note_amplitude, this.last_note_period, this.last_note_partial, this.last_segment_partial);
	this.last_note_amplitude = result.io_previous_note_amplitude[0];
	this.last_note_period = result.io_note_period[0];
	this.last_note_partial = result.io_note_partial[0];
	this.last_segment_partial = result.io_segment_partial[0];
	//console.log(this.last_note_partial, this.last_segment_partial);

	this.songIndex = (this.songIndex + samplesRequired / sfx.noteLength) % sfx.songNotes.length;
    }

    copyBufferToFloat() {
	return this.u8ArrayToF32Array(
	    this.mainBuffer.byteOffset + this.indexMainBuffer,
	    this.mainBuffer.length - this.indexMainBuffer,
	    this.floatCopyBuffer.byteOffset + this.indexFloatCopyBuffer * 4,
	    this.floatCopyBuffer.length - this.indexFloatCopyBuffer);
    }

    process(inputs, outputs, parameters) {
	if(!this.memory || !this.music){
	    return this.running;
	}

	const outLen = outputs[0][0].length;
	
	if (!this.mainBuffer || outLen > this.mainBuffer.length) {
	    this.initMainBuffer(outLen, this.music.sfx[0]);
	}
	
	if (!this.floatCopyBuffer || outLen > this.floatCopyBuffer.length) {
	    this.initFloatCopyBuffer(outLen);
	}

	this.indexFloatCopyBuffer = 0;
	let copied = -1;
	while(copied != 0 && this.indexFloatCopyBuffer < this.floatCopyBuffer.length) {
	    if (this.indexMainBuffer == 0) {
		
		this.fillBuffer(this.mainBuffer, this.music.sfx[0]);
	    }
	    copied = this.copyBufferToFloat();
	    this.indexFloatCopyBuffer += copied;
	    this.indexMainBuffer += copied;
	    if (this.indexMainBuffer >= this.mainBuffer.length) {
		this.indexMainBuffer = 0;
	    }
	}

	for (let channel = 0; channel < outputs.length; channel++) {
	    const outputChannel = outputs[channel];
	    // no clue why outputchannel is an array of float arrays?
	    outputChannel[0].set(this.floatCopyBuffer);
	}

	return this.running;
    }
}


registerProcessor('zig-synth-worklet-processor', ZigSynthWorkletProcessor);
