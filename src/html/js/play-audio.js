async function main(){
    const synthWASMModule = await synthModule();
    var audioContext = new AudioContext({sampleRate:256*32});
    const {memory, sfxBuffer, u8ArrayToF32Array} = synthWASMModule;
    /**
       play a sound as a buffer

       should be able to play multiple at once
    */
    function playSoundEffect() {
	const u8Array = new Float32Array(memory.buffer, 0, audioContext.sampleRate * 2)
	const f32Array = new Float32Array(memory.buffer, 0, audioContext.sampleRate * 2)
	const audioBuffer = audioContext.createBuffer(
	    1,
	    audioContext.sampleRate * 2, // 2 seconds
	    audioContext.sampleRate
	);

	// create the sound
	sfxBuffer(
	    u8Array.byteOffset, u8Array.length,
	    audioContext.sampleRate);

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

    playSoundEffect()
}
