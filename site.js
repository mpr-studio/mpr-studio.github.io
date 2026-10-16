// Pages: show the section that holds the hash target, home otherwise.
function route() {
  const id = location.hash.slice(1);
  const target = id && document.getElementById(id);
  const page = (target && target.closest(".page")) || document.getElementById("home");
  for (const p of document.querySelectorAll(".page")) p.hidden = p !== page;
  for (const a of document.querySelectorAll("nav a")) {
    if (a.hash === (page.id === "home" ? "" : "#" + page.id)) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  if (page.id === "course") { map.invalidateSize(); fit(); }
  if (!target || target === page) scrollTo(0, 0);
  else target.scrollIntoView();
}

// Map: the three addresses from the syllabus.
const places = [
  [40.7147086, -73.9916872, "46 Canal Street"],
  [40.7194406, -73.9990778, "215 Centre Street"],
  [40.7167326, -74.0005831, "125 White Street"],
];
const map = L.map("map", { scrollWheelZoom: false });
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);
const fit = () => map.fitBounds(places.map(([lat, lon]) => [lat, lon]), { padding: [60, 60] });
fit();
for (const [lat, lon, label] of places) {
  L.circleMarker([lat, lon], { radius: 6, color: "black", weight: 1, fillOpacity: 1 })
    .bindTooltip(label, { permanent: true, direction: "right" })
    .addTo(map);
}

addEventListener("hashchange", route);
route();

// Player: always on screen, draggable, with what's playing now.
const STREAM = "https://167-235-224-167.sslip.io/listen/mpr-studio/radio.mp3";
const NOW = "https://167-235-224-167.sslip.io/api/nowplaying/mpr-studio";
const player = document.getElementById("player");
const button = document.getElementById("play");
const status = document.getElementById("status");
const now = document.getElementById("now");
const mute = document.getElementById("mute");
const volume = document.getElementById("volume");
const audio = new Audio();
audio.crossOrigin = "anonymous";  // the stream allows it, so we can read the waveform

// Web Audio: stream → analyser (waveform) → gain (volume) → speakers.
let gain = null, analyser = null;
function connect() {
  if (gain) return;
  try {
    const ctx = new AudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    gain = ctx.createGain();
    ctx.createMediaElementSource(audio).connect(analyser).connect(gain).connect(ctx.destination);
    setVolume();
  } catch { gain = analyser = null; }
}
function setVolume() {
  if (gain) { audio.volume = 1; audio.muted = false; }
  showMuted?.();
}

function store(key, value) { try { localStorage.setItem(key, value); } catch {} }
function stored(key) { try { return localStorage.getItem(key); } catch { return null; } }

function setPlaying(playing) {
  button.textContent = playing ? "■" : "▶";
  button.setAttribute("aria-label", playing ? "Stop" : "Play");
}

function toggle() {
  if (audio.paused) {
    connect();
    gain?.context.resume();
    audio.src = STREAM + "?t=" + Date.now();  // start at the live edge
    audio.play().catch(() => setPlaying(false));
    setPlaying(true);
  } else {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    setPlaying(false);
  }
}
button.onclick = () => {
  toggle();
  // Lock-screen and media-key controls, once someone has pressed play here.
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", () => audio.paused && toggle());
    navigator.mediaSession.setActionHandler("pause", () => !audio.paused && toggle());
    navigator.mediaSession.setActionHandler("stop", () => !audio.paused && toggle());
  }
};

let muted = false;
volume.value = stored("volume") ?? 1;
setVolume();
volume.oninput = () => {
  muted = false;
  showMuted();
  store("volume", volume.value);
};
mute.onclick = () => {
  muted = !muted;
  showMuted();
};
function showMuted() {
  player.classList.toggle("muted", muted);
  mute.setAttribute("aria-label", muted ? "Unmute" : "Mute");
  if (gain) gain.gain.value = muted ? 0 : Number(volume.value);
  else { audio.muted = muted; audio.volume = volume.value; }
}

// Waveform: moving while playing, flat when stopped.
const wave = document.getElementById("wave");
const samples = new Uint8Array(1024);
function draw() {
  const dpr = devicePixelRatio || 1;
  const w = wave.clientWidth * dpr, h = wave.clientHeight * dpr;
  if (wave.width !== w || wave.height !== h) Object.assign(wave, { width: w, height: h });
  const g = wave.getContext("2d");
  g.clearRect(0, 0, w, h);
  g.strokeStyle = getComputedStyle(wave).color;
  g.lineWidth = 1.5 * dpr;
  g.beginPath();
  const playing = analyser && !audio.paused;
  if (playing) analyser.getByteTimeDomainData(samples);
  const n = 128;
  for (let i = 0; i <= n; i++) {
    const v = playing ? (samples[Math.floor(i * (samples.length - 1) / n)] - 128) / 128 : 0;
    const x = i / n * w, y = h / 2 + v * h / 2;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.stroke();
  if (playing) requestAnimationFrame(draw);
}
audio.addEventListener("playing", draw);
audio.addEventListener("pause", draw);
addEventListener("load", draw);

// The next show from the schedule on the home page (each runs an hour),
// in words, in New York time.
function nextShow() {
  const t = Date.now();
  const time = [...document.querySelectorAll("#home time")]
    .find((el) => Date.parse(el.dateTime) + 3600e3 > t);
  if (!time) return "";
  const start = Date.parse(time.dateTime);
  if (start <= t) return "Show starting soon";
  const zone = { timeZone: "America/New_York" };
  const day = (ms) => new Date(new Date(ms).toLocaleDateString("en-US", zone)).getTime();
  const days = Math.round((day(start) - day(t)) / 864e5);
  const hour = new Date(start).toLocaleTimeString("en-US", { ...zone, hour: "numeric", minute: "2-digit" })
    .replace(":00", "").replace("AM", "am").replace("PM", "pm");
  const when = days === 0 ? "today"
    : days === 1 ? "tomorrow"
    : days < 7 ? new Date(start).toLocaleDateString("en-US", { ...zone, weekday: "long" })
    : new Date(start).toLocaleDateString("en-US", { ...zone, weekday: "long", month: "long", day: "numeric" }) + ",";
  return "Next show: " + when + " at " + hour;
}

// Now playing: one line, scrolling like a marquee when it doesn't fit.
let nowText = null;
function setNow(text) {
  if (text === nowText) return;
  nowText = text;
  now.textContent = "";
  if (!text) return;
  const span = document.createElement("span");
  span.textContent = "Now playing: " + text;
  now.append(span);
  now.classList.remove("marquee");
  if (span.offsetWidth > now.clientWidth) {
    span.textContent += "\u2003\u2003";
    now.append(span.cloneNode(true));
    now.style.setProperty("--duration", span.offsetWidth / 40 + "s");  // 40 px per second
    now.classList.add("marquee");
  }
}

// AzuraCast reports a live streamer (a show) or AutoDJ (the library).
const ICON = {
  live: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/><path d="M5 5a4.2 4.2 0 0 0 0 6M11 5a4.2 4.2 0 0 1 0 6M2.8 2.8a7.3 7.3 0 0 0 0 10.4M13.2 2.8a7.3 7.3 0 0 1 0 10.4"/></svg>',
  library: '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.25"/><circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/></svg>',
};

async function nowPlaying() {
  try {
    const d = await (await fetch(NOW)).json();
    const live = d.live.is_live;
    const listening = d.listeners.current ? " · " + d.listeners.current + " listening" : "";
    status.innerHTML = live ? ICON.live + " On air" + listening : ICON.library + " From the library" + listening;
    status.className = live ? "live" : "";
    const song = d.now_playing.song;
    setNow(live ? d.live.streamer_name || song.text : song.text);
    document.getElementById("next").textContent = live ? "" : nextShow();
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: nowText,
        artist: "Montez Press Radio Studio Radio",
        artwork: song.art ? [{ src: song.art }] : [],
      });
    }
  } catch {
    status.textContent = "Off air";
    status.className = "";
    setNow("");
    document.getElementById("next").textContent = nextShow();
  }
}
nowPlaying();
setInterval(nowPlaying, 10000);



// Dragging, remembered between visits.
function place(x, y) {
  x = Math.min(Math.max(0, x), innerWidth - player.offsetWidth);
  y = Math.min(Math.max(0, y), innerHeight - player.offsetHeight);
  Object.assign(player.style, { left: x + "px", top: y + "px", right: "auto", bottom: "auto" });
}
const saved = JSON.parse(stored("player") || "null");
if (saved) place(saved.x * innerWidth, saved.y * innerHeight);

let drag = null;
player.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button, input")) return;
  const r = player.getBoundingClientRect();
  drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
  player.setPointerCapture(e.pointerId);
  player.classList.add("dragging");
});
player.addEventListener("pointermove", (e) => {
  if (drag) place(e.clientX - drag.dx, e.clientY - drag.dy);
});
player.addEventListener("pointerup", () => {
  if (!drag) return;
  drag = null;
  player.classList.remove("dragging");
  const r = player.getBoundingClientRect();
  store("player", JSON.stringify({ x: r.left / innerWidth, y: r.top / innerHeight }));
});
addEventListener("resize", () => {
  if (player.style.left) place(player.offsetLeft, player.offsetTop);
});
