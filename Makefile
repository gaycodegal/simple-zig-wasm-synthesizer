


all:
	zig build-lib src/zig/synth.zig -target wasm32-freestanding -dynamic -O ReleaseSmall -femit-bin='./src/html/js/synth.wasm'
js-small:
	cat src/html/js/webassembly.js src/html/js/synth-loader.js src/html/js/play-audio.js | uglifyjs > synth-all.js 
clean:
	git clean -fX
