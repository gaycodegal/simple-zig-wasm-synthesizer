import { synthModule } from './synth-loader.js';
import { u8ArrayPopulate, growMemoryIfNeededForSfxBuffer, allocateTo, createTempSfxBuffer } from './synth.js';

// in own process, cannot directly interact with browser js
class ZigSynthWorkletProcessor extends AudioWorkletProcessor {
    mainBuffer = null;
    sampleRate = 44100;
    waves = [0];
    songNotes = [47, 48, 49];
    noteLength = 5000;
    songIndex = 0;
    indexFloatCopyBuffer = 0;
    indexMainBuffer = 0;
    running = true;
    
    constructor() {
	super();
	this.port.onmessage = async function (event) {
	    if (event.data.wasmBinary) {
		await this.initWASM(event.data.wasmBinary);
		this.port.postMessage('ready');
	    } else if (event.data == 'stop') {
		this.running = false;
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

    sampleAlign(samplesRequired) {
	if (samplesRequired % this.noteLength != 0) {
	    samplesRequired += this.noteLength - (samplesRequired % this.noteLength);
	}
	return samplesRequired;
    }

    initMainBuffer(samplesRequired) {
	samplesRequired = this.sampleAlign(samplesRequired);
	let allocatorIndex = 0;

	this.mainBuffer = new Uint8Array(this.memory.buffer, allocatorIndex, samplesRequired);
	allocatorIndex += this.mainBuffer.length;
    }

    allocatedTo() {
	return this.floatCopyBuffer.byteOffset + this.floatCopyBuffer.length * 4;
    }

    initFloatCopyBuffer(samplesRequired){
	let allocatorIndex = this.mainBuffer.length;

	allocatorIndex = allocateTo(allocatorIndex, 4);
	this.floatCopyBuffer = new Float32Array(this.memory.buffer, allocatorIndex, samplesRequired);
    }

    fillMain () {
	const samplesRequired = this.mainBuffer.length;
	createTempSfxBuffer(this.memory, this.sfxBuffer, this.sampleRate, this.songNotes, this.noteLength, samplesRequired, this.waves, this.mainBuffer, this.songIndex, this.allocatedTo());
	this.songIndex = (this.songIndex + samplesRequired / this.noteLength) % this.songNotes.length;
    }

    copyBufferToFloat() {
	return this.u8ArrayToF32Array(
	    this.mainBuffer.byteOffset + this.indexMainBuffer,
	    Math.max(this.mainBuffer.length - this.indexMainBuffer, 0),
	    this.floatCopyBuffer.byteOffset + this.indexFloatCopyBuffer,
	    Math.max(this.floatCopyBuffer.length - this.indexFloatCopyBuffer, 0));
    }

    process(inputs, outputs, parameters) {
	if(!this.memory){
	    return this.running;
	}

	const outLen = outputs[0][0].length;
	
	if (!this.mainBuffer || outLen > this.mainBuffer.length) {
	    this.initMainBuffer(outLen);
	}
	
	if (!this.floatCopyBuffer || outLen > this.floatCopyBuffer.length) {
	    this.initFloatCopyBuffer(outLen);
	}

	this.indexFloatCopyBuffer = 0;
	let copied = -1;
	while(copied != 0 && this.indexFloatCopyBuffer < this.floatCopyBuffer.length) {
	    if (this.indexMainBuffer == 0) {
		this.fillMain();
	    }
	    copied = this.copyBufferToFloat();
	    this.indexFloatCopyBuffer += copied;
	    this.indexMainBuffer += copied;
	    if (this.indexMainBuffer >= this.mainBuffer.length) {
		this.indexMainBuffer = 0;
	    }
	}
	//console.log(copied, this.floatCopyBuffer);

	for (let channel = 0; channel < outputs.length; channel++) {
	    const outputChannel = outputs[channel];
	    // no clue why outputchannel is an array of float arrays?
	    outputChannel[0].set(this.floatCopyBuffer);
	}

	return this.running;
    }
}


registerProcessor('zig-synth-worklet-processor', ZigSynthWorkletProcessor);
