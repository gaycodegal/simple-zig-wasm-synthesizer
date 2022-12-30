# Writing a Synth for the Web Using Zig and WASM (WebAssembly)

I have never written a synthesizer before, nor used Zig, but [Mozilla's Guide][use-webassembly]
suggested I use WebAssembly. I had tried Rust before, and found the constant
borrow checking errors slowed down my development a lot, and I don't have
a lot of time for this project. C or C++ would
be a nightmare to ensure I was protecting users from buggy code should they
ever want to run my code outside of WebAssembly, so I was looking for a safer
language. I had heard of Zig before, but I only seriously considered it for
this project when I heard [Zig had embraced WebAssembly with it's compiler][goodbye-c++].

## Dealing with Zig and C ABI Pain Points

The language promised some safety, low level control and speed, and a reasonable dev
experience so I gave it a try. Initially, compiling the code was a real pain to figure out.
I wanted to compile for a non-standard target the doesn't have a `main` symbol, wanted
to optimize for size rather than speed, and was hoping to avoid a complicated build setup.
`ReleaseSmall`, the build option, I eventually found in [Zig's documentation][ReleaseSmall], but my
predisposition to `-Os` from `gcc` was getting me nowhere on google. Likewise, most Zig
projects using `zig.build` made it confusing to figure out setting the build target to
WebAssembly, but this too was [found in Zig's documentation][zig-wasm] and I shoved it into a Makefile.
Make may have its flaws, but it helps organize common tasks in a way most users understand
without having to look up custom `zig` commands.

Once I got started, the languages `for` loop ranges confused me, forcing while syntax seemed
an unsafe choice compared to Rust. Once I started to need to specify step size,
Zig's `for` loops just couldn't keep up. I did find Github user [ityonemo][ityonemo]'s
[Zig in 30 Minutes Gist][zig-30-min] really useful for helping me to learn about things like this.
The `export` keyword was handy for exposing my code
to WebAssembly, but it meant I lost the safety of Zig's slice syntax. Luckily, Zig had
good patterns to help solve some of the dangers of dealing with the C ABI you must use
when exporting Zig functions to WebAssembly. C functions only allow taking raw pointers,
always allows `null` pointers to be passed, and don't come with an intrinsic length attached
either.

To properly solve for converting [Optional Unknown Length Pointers][unknown-pointer] into proper Zig
Slices, you need a way of coercing Optional typed things into non-null types. I'm a fan of being
able to use const variable definitions whenever possible, and the `guard` pattern from Apple's Swift
language, but the syntax for this in Zig took some figuring out. I tried using Zig's 
`if(...) ... else ...` ternary syntax, but this wasn't satisfying the type checker.
unlike Rust, the typical if else can't be used to convert types either, so I tried
searching for Zig's equivalent of a ["null coalescing operator"][null-coalescing-operator]
or ["elvis operator"][elvis-operator] (like Kotlin).
I was in luck with Zig's `orelse` operater, which works with Optional types and can
properly unpack them. Thus, converting Optional C Pointers into a Zig Slice looks like
this in my code:

```zig
export fn sfxBuffer(
    in_examplePointer: ?[*]u8,
    in_exampleLength: usize,
) void {
    // zero length pointers aren't useful for my algorithms
    if (in_exampleLength == 0) {
        return;
    }
    const example_slice = (in_examplePointer orelse return)[0..in_exampleLength];
}
```

Now example_slice is ready to use, and can work with Zig's ReleaseSafe or Debug checks.
I ended up using the prefixes `in_`, `out_`, and `io_` to give hints to callers what kind
of data the pointer arguments to my functions take.

A funny coincidence with installing checking in my code was realizing that WebAssembly
memory starts at 0, which is the C `null` pointer by definition, so I had to refactor
my WebAssembly code to avoid using the 0 memory address. With Zig, using Memory Allocators
is not by default a necessary pattern. I'm trying to generate a small library binary,
so I chose to let the caller use their own allocator when calling my function.
This means that for my project JavaScript is actually the memory allocator, and this
did allow me to shave down the size of my binary significantly.

## Writing the Synthesizer

I began writing a simple Sine Wave generator in Zig and connecting it to
JavaScript with both the `AudioContext.createBuffer` and the `AudioWorklet`
APIs. One thing I did notice was that my code which used the `@sin` Zig BuiltIn
was much larger (+5kb) than the code once I had switched to using my own wave
generator implementation, which I found strange.

JavaScript has a few failings in using AudioWorklets with WebAssembly successfully:

1.  `XMLHttpRequest` is not usable in AudioWorklet context, so you must use
    the `postMessage` interface to send in the WASM binary blob.
1.  TextDecoder, which I had been using to help with Zig print statments
    does not exist in the Worklet context.
1.  The AudioWorklet `process` method's output buffers are of a fixed,
    unchangable size.
1.  AudioWorklets can only be played from https sources or over http://localhost

However, once I got used to these restrictions I was able to start designing
the synthesizer algorithm. For my synthesizer, I am heavily basing the user interface around TIC-80's
synthesizer, but implementing the code required to provide that experience
and solve common problems that arise myself. 

The outline of the algorithm used is as follows:

1.  The user has 16 Waveforms that they can modify in a WaveBank
1.  Each Waveform is 4 bit (0-15) in amplitude and 32 values in length.
1.  Those 4 bit Waveform values are multiplied by 3 bits of volume (1-8)
    and shifted so their mid point lines up with the value 127, or the
    half way point of an 8 bit audio stream.
1.  Between the values pulled from the 4 bit waveforms, we interpolate
    in a straight line from one 8 bit value to the next.
1.  The length of these interpolated waveform segments is calculated so that
    the total length of the wave is the correct number of samples so the
    wave is played back at the desired frequency to create a musical note.
1.  To create polyphony, multiple 8 bit audio streams are added together
    into the chosen output format (for WebAssembly this is 32 bit
    Floating Point audio), and then divided by some value indicating the
    maximum amount of channels / sounds that can be played at once
    -   Because of the way the maximum 4 bit amplitude (120 or 15 * 8) maps onto
        the 8 bit wave space (0 to 255), the exact formula is
        `sum(channel data) / (maximum channels / 2)`
        
Polyphony is the playback of the sum of multiple waveforms at once so that 
multiple tones can be heard, and is the basis of turning a simple one
not sound effect synth into something usable for making real music.
Once this was achieved, the next steps would be to add effects like
vibrato, tremolo, and pitch / volume sliding, and to create
a music editor.
        
For the creation of the synth itself I was fairly happy with the end result,
but it was definitely labor intensive to make. There wasn't any great 
guides to using WebAssembly with AudioWorklets, and doing waveform
mathematics is very prone to errors. To that end, I used Github user
[rochar][rochar]'s [wavefile.js][wavefile-js] to download my 8 bit audio streams
and viewed them in audacity to focus in on what was causing any 
undesired audio effects. I do complain that there isn't really
a good way to write a file to disk in javascript in multiple parts,
which means the limit of the wavefile size that can be downloaded is
proportional to the amount of memory a site is allowed to have by the
browser and physical computer. This is another reason it's great
to have a small music player for web games: you don't have to worry
about running into the memory limits of users computers, nor the time
it would take to download large audio files.

## Writing a Tracker UI

Like TIC-80, I'm going to be writing a Tracker-style UI to edit the
music for the synthesizer. I'll be making it accessible to users
with visual impairments and to screen reader users. The tracker
will be available as both a Portable Web App (PWA), or a zip
download of the site.

The features I intend this to support are:

1.  Runs offline, no user data uploaded nor ads
1.  Can download a wave file version of songs made, or a text format
1.  Edit songs in a tracker like format
1.  Conveniences built in for people who don't know music theory
    like scale snapping.

## Packaging the Synth Library for Online Playback

The current size of the WebAssembly binary blob is 3 kilobytes,
and the total zipped size of the WebAssembly and JavaScript combined
is about 8.5 kilobytes, which is a lot smaller than even a single
ogg or mp3 music file, which can reach 100+ kilobytes per second of audio.

The intended API is to have a few convenience methods such as:

1.  load(music_file_url)
1.  sfx(id)
1.  music(id)
1.  stop_music()
1.  stop_sfx()

This API and the code that supports it will be bundled together into either
a single file, or a JavaScript file + a WASM binary.

## Final Thoughts

-   We're still missing a language that can compile itself to WebAssembly from
    within the browser itself. I think that would be cool.
-   Zig helped me not embed an Allocator into my code and keep accidental
    static cloning to a minimum.
-   Zig was decent for keeping code size small. I am unsure if a second
    optimizer pass from a 3rd party WASM tool would help.
-   Zig did improve the quality of my code, and made my code clearer.
-   JavaScript's lack of direct file access is annoying
-   The lack of a common WebApp shipped in a single file users can
    have forever is not ideal.


[use-webassembly]:https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet
[goodbye-c++]:https://ziglang.org/news/goodbye-cpp/
[ReleaseSmall]:https://ziglang.org/documentation/master/#ReleaseSmall
[zig-wasm]:https://ziglang.org/documentation/master/#WebAssembly
[ityonemo]:https://github.com/ityonemo
[zig-30-min]:https://gist.github.com/ityonemo/769532c2017ed9143f3571e5ac104e50
[unknown-pointer]:https://ziglang.org/documentation/master/#Pointers
[null-coalescing-operator]:https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Nullish_coalescing
[elvis-operator]:https://kotlinlang.org/docs/null-safety.html#elvis-operator
[rochar]:https://github.com/rochars
[wavefile-js]:https://github.com/rochars/wavefile/blob/master/bin/wavefile.js
