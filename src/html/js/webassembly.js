function fetchWASMBinary(path){
    return new Promise((accept, reject)=>{
	function downloadSuccess() {
	    const dataview = new DataView(this.response);
	    if (dataview.getUint32(0) == 0x3c21444f) {
		const dec = new TextDecoder();
		const text = dec.decode(this.response);
		reject(`
You appear to have downloaded a html file instead of WebAssembly.
This is likely because you have hit a 404 page.

path: ${path}

html:
${text}
`);
	    } else {
		accept(this.response);
	    }
	}
	
	const req = new XMLHttpRequest();
	req.addEventListener("load", downloadSuccess);
	req.addEventListener("error", reject);
	req.responseType = "arraybuffer";
	req.open("GET", path);
	req.send();
    });
}
