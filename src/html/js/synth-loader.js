
async function _synthModule (accept, reject){
    const result = await fetchWASMBinary('src/html/js/synth.wasm');
    WebAssembly.instantiate(result, {})
	.then(module => {
	    accept({
		module,
		memory: module.instance.exports.memory,
		u8ArrayToF32Array: module.instance.exports.u8ArrayToF32Array,
		sfxBuffer: module.instance.exports.sfxBuffer,
	    });
	});
}

function synthModule(){
    return new Promise(_synthModule);
}

