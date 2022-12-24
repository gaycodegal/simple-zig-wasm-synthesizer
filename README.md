# Simple Wave Synthesizer

The intention of this project is to create a small (in code size) synthesizer
to make bit tune sound effect / music for online games. This project is demonstrating compiling a polyphonic synthesizer in Zig and playing it from the web.

## Rationale

- Games can easily use megabytes for music even if the rest of the game is very small due to pixel art or being text based.
- mod / xm would be great, but its not a format suited for sound effects, only for music
- mod / xm don't allow instruments to use multiple samples

Could I have used wave files for sfx and xm for music? Definitely, but I didn't want to, as I had already seen what Tic80 could do.

## Progress

In its current state, it could be used to play short sound effects for
online games. The code size is at last check ~5kb in js + wasm, or 2.6kb zipped. The audio it generates is 45kb/s 8bit audio.

- Play different notes from a note bank
- Play different waveforms from a waveform bank

### Soon

- Music player which doesn't suffer the length limitations of audiobuffer, instead using AudioWorklet

### Later

- configure max amplitude (probably in the f32 converter)
- Make music be able to use notes and sfx alike to play music
- Make an optional file format for the music

## Licenses

This project is MIT licensed, the only outside code it uses is the NoteHz taken from Tic80 (which is also MIT Licensed). There is a license file for a file called wavefile.js but that code is not included in this github, and I only use it for testing to verify the waveforms are correct, but if you choose to download that file yourself, you have the license.
