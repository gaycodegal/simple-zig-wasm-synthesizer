# Simple Wave Synthesizer

The intention of this project is to create a small (in code size) synthesizer
to make bit tune sound effect / music for online games. This project is demonstrating compiling a polyphonic synthesizer in Zig and playing it from the web.

It is currently monophonic, but mostly usable.

## Rationale

- Games can easily use megabytes for music even if the rest of the game is very small due to pixel art or being text based.
- mod / xm would be great, but its not a format suited for sound effects, only for music
- mod / xm don't allow instruments to use multiple samples

Could I have used wave files for sfx and xm for music? Definitely, but I didn't want to, as I had already seen what Tic80 could do.

## Progress

In its current state, it could be used to play short sound effects for
online games. The code size is at last check ~15.9kb in js + wasm (without shortening variable names etc), or 7.4kb zipped. The audio it generates is 45kb/s 8bit audio.

The wasm binary itself is only 2kb.

- Play different notes from a note bank
- Play different waveforms from a waveform bank
- Music player which doesn't suffer the length limitations of audiobuffer, instead using AudioWorklet
- Message passing setup for the music player to allow for dynamic choice of song
- Volume control via volume list
    - technically, because volume now allows you to play less than at maximum amplitude, you can now do polyphony by just playing multiple things at once with low volume.

### Soon

- 4 track polyphony / maybe 8 track 4 volume, 4 sfx

### Later

- Waveform editing
- Make music be able to use notes and sfx alike to play music
- Make an optional file format for the music

## Licenses

This project is MIT licensed, the only outside code it uses is the NoteHz taken from Tic80 (which is also MIT Licensed). There is a license file for a file called wavefile.js but that code is not included in this github, and I only use it for testing to verify the waveforms are correct, but if you choose to download that file yourself, you have the license.
