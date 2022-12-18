
async function test(){
    const result = await fetchWASMBinary('js/synth.wasm');
    WebAssembly.instantiate(result, {
	env: {
	    //print: (result) => { console.log(`The result is ${result}`); }
	}})
	.then(result => {
	    const fibonacci = result.instance.exports.fibonacci;
	    for (var i = 0; i < 10; ++i){
		// having to use BigInt function is odd here.
		console.log(`fibonacci ${i} is ${fibonacci(BigInt(i))}`);
	    }
	});
}

test();
