import { fetchWASMBinary } from './webassembly.js';

export function synthModule (optionalWasmBinary){
    return new Promise(async function(accept, reject) {
	const result = optionalWasmBinary ?? await fetchWASMBinary('src/html/js/synth.wasm');
	const mod = {};
	const decoder = typeof TextDecoder !== 'undefined' && new TextDecoder();
	WebAssembly.instantiate(result, {
	    env: {
		print: function(a, b){
		    if (decoder) {
			console.log(decoder.decode(new Uint8Array(mod.memory.buffer, a, b)));
		    } else {
			console.log(new Uint8Array(mod.memory.buffer, a, b));
		    }
		    
		}
	    }})
	    .then(module => {
		
		mod.module = module;
		mod.memory = module.instance.exports.memory;
		mod.u8ArrayToF32Array = module.instance.exports.u8ArrayToF32Array;
		mod.sfxBuffer =  module.instance.exports.sfxBuffer;
		accept(mod);
	    });
    });
}
