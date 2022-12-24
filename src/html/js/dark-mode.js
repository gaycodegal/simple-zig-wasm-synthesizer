window.addEventListener("load", function(){
    applyDarkmode();
});

const darkmodeLocalstoreKey = "darkmode";

function shouldDarkmodeBeOn() {
    return (localStorage.getItem(darkmodeLocalstoreKey) || "true") == "true";
}

function toggleDarkmode() {
    const wantDark = !shouldDarkmodeBeOn();
    if (wantDark) {
	localStorage.setItem(darkmodeLocalstoreKey, "true");
    } else {
	localStorage.setItem(darkmodeLocalstoreKey, "false");
    }
    applyDarkmode();
}

function applyDarkmode() {
    const wantDark = shouldDarkmodeBeOn();
    const isDark = document.body.classList.contains("dark");
    if (wantDark !== isDark) {
	if (wantDark) {
	    document.body.classList.add("dark");
	} else {
	    document.body.classList.remove("dark");
	}
    }
}
