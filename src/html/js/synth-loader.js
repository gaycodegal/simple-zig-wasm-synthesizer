
async function _synthModule (accept, reject){
    const result = await fetchWASMBinary('src/html/js/synth.wasm');
    const mod = {};
    const decoder = new TextDecoder();
    WebAssembly.instantiate(result, {
	env: {
	    print: function(a, b){
		console.log(decoder.decode(new Uint8Array(mod.memory.buffer, a, b)));
	    }
	}})
	.then(module => {
	    
	    mod.module = module;
	    mod.memory = module.instance.exports.memory;
	    mod.u8ArrayToF32Array = module.instance.exports.u8ArrayToF32Array;
	    mod.sfxBuffer =  module.instance.exports.sfxBuffer;
	    accept(mod);
	});
}

function synthModule(){
    return new Promise(_synthModule);
}

