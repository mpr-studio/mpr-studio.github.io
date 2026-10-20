// Pages: show the section that holds the hash target, home otherwise.
function route() {
  const id = location.hash.slice(1);
  const target = id && document.getElementById(id);
  const page = (target && target.closest(".page")) || document.getElementById("home");
  for (const p of document.querySelectorAll(".page")) p.hidden = p !== page;
  for (const a of document.querySelectorAll("nav a")) {
    const section = page.id.startsWith("broadcast-") ? "broadcasts" : page.id;
    if (a.hash === (section === "home" ? "" : "#" + section)) a.setAttribute("aria-current", "page");
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
    pauseShows?.();
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

// Recorded shows: a player per show page, in the floating player's style.
// The waveform is the whole show (peaks computed when the file is made);
// click it to jump. Playing a show stops the live player, and vice versa.
const shows = [];
function pauseShows() { for (const s of shows) s.audio.pause(); }
const clock = t => {
  t = Math.max(0, Math.floor(t));
  const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};
for (const el of document.querySelectorAll(".show")) {
  const a = new Audio();
  a.preload = "none";
  a.src = el.dataset.src;
  const show = { audio: a, peaks: [] };
  shows.push(show);
  const play = el.querySelector(".show-play"), time = el.querySelector(".show-time");
  const canvas = el.querySelector(".show-wave"), vol = el.querySelector(".show-vol input");
  const duration = () => a.duration || Number(el.dataset.duration) || 0;
  const paint = () => {
    const dpr = devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) Object.assign(canvas, { width: w, height: h });
    const g = canvas.getContext("2d");
    g.clearRect(0, 0, w, h);
    const done = duration() ? a.currentTime / duration() * w : 0;
    const n = show.peaks.length, step = 3 * dpr;
    for (let x = 0; x < w; x += step) {
      const v = n ? show.peaks[Math.floor(x / w * n)] : 0;
      const y = Math.max(1.5 * dpr, v * h);
      g.fillStyle = x < done ? "black" : "#bbb";
      g.fillRect(x, (h - y) / 2, 1.5 * dpr, y);
    }
    time.textContent = `${clock(a.currentTime)} / ${clock(duration())}`;
  };
  fetch(el.dataset.peaks).then(r => r.json()).then(p => { show.peaks = p; paint(); }).catch(() => {});
  const set = playing => {
    play.textContent = playing ? "❚❚" : "▶";
    play.setAttribute("aria-label", playing ? "Pause" : "Play");
  };
  play.onclick = () => {
    if (a.paused) {
      if (!audio.paused) toggle();  // stop the live stream
      pauseShows();
      a.play().catch(() => set(false));
    } else a.pause();
  };
  a.addEventListener("play", () => set(true));
  a.addEventListener("pause", () => set(false));
  a.addEventListener("timeupdate", paint);
  a.addEventListener("loadedmetadata", paint);
  // Jump: before the file has loaded, remember the time and apply it once it has.
  let pending = null;
  const seek = t => {
    if (a.readyState >= 1) a.currentTime = t;
    else { pending = t; a.preload = "metadata"; a.load(); }
    paint();
  };
  a.addEventListener("loadedmetadata", () => { if (pending !== null) { a.currentTime = pending; pending = null; paint(); } });
  canvas.onclick = e => { if (duration()) seek(e.offsetX / canvas.clientWidth * duration()); };
  const mute = el.querySelector(".show-mute");
  vol.value = stored("volume") ?? 1;
  a.volume = vol.value;
  vol.oninput = () => { a.muted = false; a.volume = vol.value; el.classList.remove("muted"); };
  mute.onclick = () => { a.muted = !a.muted; el.classList.toggle("muted", a.muted); mute.setAttribute("aria-label", a.muted ? "Unmute" : "Mute"); };
  const page = el.closest(".page");
  for (const b of page.querySelectorAll(".chapters [data-t]")) {
    b.onclick = () => {
      seek(Number(b.dataset.t));
      if (a.paused) play.click();
    };
  }
  addEventListener("resize", paint);
  addEventListener("hashchange", () => requestAnimationFrame(paint));
  requestAnimationFrame(paint);
}
