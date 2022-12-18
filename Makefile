


all:
	zig build-lib src/zig/synth.zig -target wasm32-freestanding -dynamic -O ReleaseSmall -femit-bin='./src/html/js/synth.wasm'
clean:
	git clean -fX
