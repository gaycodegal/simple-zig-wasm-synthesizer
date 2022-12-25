function print(text){
    const output = document.getElementById("output");
    output.textContent = text;
}

function printError(text){
    const output = document.getElementById("output");
    output.textContent = `error: ${text}`;
    output.classList = "error";
}

async function __parseConstants(callback){
    const sampleRateEl = document.getElementById("playback-hz");
    const songNotesEl = document.getElementById("notes-to-play");
    const wavesEl = document.getElementById("waves-to-play");
    const noteLengthEl = document.getElementById("note-length");
    const secondsLengthEl = document.getElementById("seconds-length");

    var sampleRate = sampleRateEl.value - 0;
    const songNotes = songNotesEl.value.split(',').map(x=>parseInt(x)).filter(x=>!isNaN(x));
    const waves = wavesEl.value.split(',').map(x=>parseInt(x)).filter(x=>!isNaN(x));
    const noteLength = noteLengthEl.value - 0;
    const secondsLength = secondsLengthEl.value - 0;
    if (sampleRate == 0) {
	sampleRate = 44100;
    }
    if (noteLength == 0) {
	noteLength = 100;
    }
    if (songNotes.length == 0) {
	throw new Error("must include notes to play");
    }
    await callback(sampleRate, songNotes, noteLength, secondsLength, waves);    
}

export async function parseConstants(callback){
    try {
	await __parseConstants(callback);
    } catch(e){
	printError(`${e.name} ${e.message}`);
    }
}
