// Player: always on screen, draggable, with what's playing now.
const STREAM = "https://167-235-224-167.sslip.io/listen/mpr-studio/radio.mp3";
const NOW = "https://167-235-224-167.sslip.io/api/nowplaying/mpr-studio";
const player = document.getElementById("player");
const swap = document.getElementById("swap");
const schedule = JSON.parse(player.dataset.schedule || "[]");
const button = document.getElementById("play");
const status = document.getElementById("status");
const now = document.getElementById("now");
const mute = document.getElementById("mute");
const volume = document.getElementById("volume");
const audio = new Audio();
let show = null;  // a broadcast loaded in the player (see Broadcasts below), or null for live
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
  button.textContent = playing ? (show ? "❚❚" : "■") : "▶";
  button.setAttribute("aria-label", playing ? (show ? "Pause" : "Stop") : "Play");
}

function toggle() {
  if (show) {  // a broadcast: pause and resume where it was
    if (audio.paused) { connect(); gain?.context.resume(); audio.play().catch(() => {}); }
    else audio.pause();
    return;
  }
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

// Waveform: moving while playing, flat when stopped; for a broadcast,
// the whole show with the played part filled in.
const wave = document.getElementById("wave");
const samples = new Uint8Array(1024);
function draw() {
  if (show) { paintShow(wave, show, audio.currentTime, getComputedStyle(wave).color); return; }
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
  const time = schedule.find((s) => Date.parse(s.start) + 3600e3 > t);
  if (!time) return "";
  const start = Date.parse(time.start);
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
  span.textContent = text;
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

// Home page: the next broadcast, in words, or "On air now" during a show.
let onAir = false;
function nextBroadcast() {
  const el = document.getElementById("next-broadcast");
  if (!el) return;
  if (onAir) { el.innerHTML = '<a href="/broadcasts/" class="live">On air now</a>'; return; }
  const t = Date.now(), s = schedule.find((s) => !s.aired && Date.parse(s.start) + 3600e3 > t);
  if (!s) { el.textContent = ""; return; }
  const zone = { timeZone: "America/New_York" }, d = new Date(s.start);
  const day = d.toLocaleDateString("en-US", { ...zone, weekday: "long", month: "long", day: "numeric" });
  const hour = d.toLocaleTimeString("en-US", { ...zone, hour: "numeric", minute: "2-digit" }).replace(":00", "").replace("AM", "am").replace("PM", "pm");
  el.innerHTML = "";
  const a = document.createElement("a");
  a.href = "/broadcasts/";
  a.textContent = `Next broadcast: ${day}, ${hour}: ${s.theme}${s.guests ? ", with " + s.guests : ""}`;
  el.append(a);
}

async function nowPlaying() {
  try {
    const d = await (await fetch(NOW)).json();
    const live = d.live.is_live;
    onAir = live;
    nextBroadcast();
    if (show) { station = live ? "On air now" : "From the library"; showSwap(); return; }
    station = live ? "On air now" : "From the library";
    showSwap();
    const listening = d.listeners.current ? ", " + d.listeners.current + " listening" : "";
    status.innerHTML = live ? ICON.live + " On air" + listening : ICON.library + " From the library" + listening;
    status.className = live ? "live" : "";
    const song = d.now_playing.song;
    const playing = live ? d.live.streamer_name || song.text : song.text;
    setNow(["Now playing: " + playing, live ? "" : nextShow()].filter(Boolean).join(". "));
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: playing,
        artist: "Montez Press Radio Studio Radio",
        artwork: song.art ? [{ src: song.art }] : [],
      });
    }
  } catch {
    onAir = false;
    station = "Off air";
    showSwap();
    if (show) return;
    status.textContent = "Off air";
    status.className = "";
    setNow(nextShow());
  }
}
nowPlaying();
setInterval(nowPlaying, 10000);



// Dragging, remembered between visits.
const mobile = matchMedia("(max-width: 600px)");
function place(x, y) {
  if (mobile.matches) return;
  x = Math.min(Math.max(0, x), innerWidth - player.offsetWidth);
  y = Math.min(Math.max(0, y), innerHeight - player.offsetHeight);
  Object.assign(player.style, { left: x + "px", top: y + "px", right: "auto", bottom: "auto" });
}
const saved = JSON.parse(stored("player") || "null");
if (saved) place(saved.x * innerWidth, saved.y * innerHeight);

let drag = null;
player.addEventListener("pointerdown", (e) => {
  if (mobile.matches || e.target.closest("button, input, a") || (show && e.target === wave)) return;
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
mobile.addEventListener("change", () => {
  if (mobile.matches) Object.assign(player.style, { left: "", top: "", right: "", bottom: "" });
  else if (saved) place(saved.x * innerWidth, saved.y * innerHeight);
});

// Broadcasts: the floating player also plays recorded shows. A show's page
// is a remote for it: the big waveform, the time, play and the chapters all
// control the floating player, which keeps playing while you browse.
const clock = (t) => {
  t = Math.max(0, Math.floor(t || 0));
  const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};
const duration = (b) => (show === b && audio.duration) || b.duration;
function paintShow(canvas, b, time, color) {
  const dpr = devicePixelRatio || 1;
  const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
  if (!w || !h) return;
  if (canvas.width !== w || canvas.height !== h) Object.assign(canvas, { width: w, height: h });
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, w, h);
  const done = time / duration(b) * w, n = b.peaks.length, step = 3 * dpr;
  for (let x = 0; x < w; x += step) {
    const y = Math.max(1.5 * dpr, (n ? b.peaks[Math.floor(x / w * n)] : 0) * h);
    g.fillStyle = x < done ? color : "#bbb";
    g.fillRect(x, (h - y) / 2, 1.5 * dpr, y);
  }
}
// The player plays one source at a time: the station (live shows and the
// library) or a broadcast from the archive. A line at the bottom is always
// there and offers the other one: on the station, "↩ Broadcast 1, 23:14"
// (where you left it, or the latest broadcast); on a broadcast, "● Live: From
// the library". Clicking it switches and plays. Waveforms only move the
// position; ▶ and the chapters play. A finished broadcast hands back to live.
let last = null;  // the last broadcast played, remembered between visits
let latest = null;  // the most recent broadcast in the archive
let station = "From the library";
function showSwap() {
  swap.className = "";
  if (show) {
    swap.textContent = station === "On air now" ? "● On air now" : `● Live: ${station}`;
    if (onAir) swap.className = "live";
  } else {
    const b = last ?? latest;
    swap.textContent = b ? `↩ ${b.theme} (${b.title})${b.pos > 5 ? ", " + clock(b.pos) : ""}` : "\u00a0";
  }
  swap.disabled = !show && !(last ?? latest);
}
swap.addEventListener("click", () => switchTo(show ? null : last ?? latest, { play: true }));
function savePos(b) { store("pos " + b.title, String(Math.floor(b.pos))); }
function remember(b) {
  last = b;
  store("last", b.src);
}
function switchTo(target, { play } = {}) {
  if (target === show) return;
  const playing = play ?? !audio.paused;
  if (show) {  // leave the broadcast, keeping its place
    show.pos = pending ?? audio.currentTime;
    savePos(show);
  }
  audio.pause();
  pending = null;
  show = target;
  if (show) {
    remember(show);
    audio.src = show.src;
    if (show.pos < duration(show) - 5) seek(show.pos);
    player.classList.add("archive");
    status.className = "";
    nowText = null;
    setNow(`${show.theme} (${show.title})${show.guests ? ", with " + show.guests : ""}`);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: `${show.theme} (${show.title})`, artist: "Montez Press Radio Studio Radio" });
    }
  } else {
    audio.removeAttribute("src");
    audio.load();
    player.classList.remove("archive");
    nowText = null;
    nowPlaying();
  }
  setPlaying(false);
  showSwap();
  mediaControls();
  update();
  draw();
  if (playing) toggle();
}
let pending = null;
function seek(t) {
  if (audio.readyState >= 1) audio.currentTime = t;
  else pending = t;
  update();
}
audio.addEventListener("loadedmetadata", () => {
  if (pending !== null && show) { audio.currentTime = pending; pending = null; }
});
function playShow(b, t) {
  if (show !== b) switchTo(b, { play: false });
  if (t != null) seek(t);
  if (audio.paused) toggle();
}
audio.addEventListener("ended", () => {
  if (!show) return;
  const b = show;
  switchTo(null, { play: true });  // back to the station
  b.pos = 0;  // and the broadcast starts over next time
  savePos(b);
  showSwap();
  update();
});

// Each page's remote, and the floating player's line, follow the audio.
// Broadcasts are known by their audio URL, so the one playing survives
// moving between pages; the remotes on the current page rebind on each load.
const catalog = new Map();
function known({ src, title, theme, guests, duration, peaks }) {
  let b = catalog.get(src);
  if (!b) {
    b = { src, title, theme, guests, duration: Number(duration), peaksUrl: peaks, pos: Number(stored("pos " + title)) || 0, peaks: [] };
    catalog.set(src, b);
    fetch(peaks).then((r) => r.json()).then((p) => { b.peaks = p; update(); }).catch(() => {});
  }
  return b;
}
const broadcast = (el) => catalog.get(el.dataset.src) ?? known(el.dataset);
for (const m of JSON.parse(player.dataset.broadcasts || "[]")) latest = known(m);
last = catalog.get(stored("last")) ?? null;
let remotes = [];
let lastSave = 0;
audio.addEventListener("timeupdate", () => {
  if (!show) return;
  show.pos = audio.currentTime;
  if (Date.now() - lastSave > 5000) { lastSave = Date.now(); savePos(show); }
});
audio.addEventListener("pause", () => { if (show) savePos(show); });
addEventListener("visibilitychange", () => { if (show && document.hidden) savePos(show); });

// Lock screen and media keys: skips and seeking only for a broadcast.
function mediaControls() {
  if (!("mediaSession" in navigator)) return;
  const set = (action, fn) => { try { navigator.mediaSession.setActionHandler(action, fn); } catch {} };
  set("seekbackward", show ? (d) => seek(Math.max(0, audio.currentTime - (d.seekOffset || 15))) : null);
  set("seekforward", show ? (d) => seek(Math.min(duration(show), audio.currentTime + (d.seekOffset || 15))) : null);
  set("seekto", show ? (d) => seek(d.seekTime) : null);
}
let lastPosition = 0;
audio.addEventListener("timeupdate", () => {
  if (!show || !("mediaSession" in navigator) || Date.now() - lastPosition < 1000 || !audio.duration) return;
  lastPosition = Date.now();
  try { navigator.mediaSession.setPositionState({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration), playbackRate: 1 }); } catch {}
});
function update() {
  if (show) status.textContent = `${clock(pending ?? audio.currentTime)} / ${clock(duration(show))}`;
  for (const { el, b } of remotes) {
    const mine = show === b, t = mine ? pending ?? audio.currentTime : b.pos;
    el.querySelector(".show-time").textContent = `${clock(t)} / ${clock(duration(b))}`;
    const play = el.querySelector(".show-play"), on = mine && !audio.paused;
    play.textContent = on ? "❚❚" : "▶";
    play.setAttribute("aria-label", on ? "Pause" : "Play");
    paintShow(el.querySelector(".show-wave"), b, t, "black");
  }
  if (show) draw();
}
for (const ev of ["timeupdate", "play", "pause", "loadedmetadata", "seeked"]) audio.addEventListener(ev, update);
audio.addEventListener("play", () => setPlaying(true));
audio.addEventListener("pause", () => setPlaying(false));
addEventListener("resize", update);
wave.addEventListener("click", (e) => {
  if (show) seek(e.offsetX / wave.clientWidth * duration(show));
});

// On every page: bind the broadcast remotes and chapters, open outside
// links in a new tab, and draw the course map if there is one.
let map = null;
document.addEventListener("astro:page-load", () => {
  remotes = [...document.querySelectorAll("main .show")].map((el) => ({ el, b: broadcast(el) }));
  for (const { el, b } of remotes) {
    el.querySelector(".show-play").onclick = () => {
      if (show === b && !audio.paused) audio.pause();
      else playShow(b);
    };
    el.querySelector(".show-wave").onclick = (e) => {
      const t = e.offsetX / e.currentTarget.clientWidth * duration(b);
      if (show === b) seek(t);
      else { b.pos = t; savePos(b); update(); }
    };
    for (const c of document.querySelectorAll("main .chapters [data-t]")) {
      c.onclick = () => playShow(b, Number(c.dataset.t));
    }
  }
  for (const l of document.querySelectorAll("main [data-listen]")) {
    l.onclick = () => { const b = catalog.get(l.dataset.listen); if (b) playShow(b, Number(l.dataset.t)); };
  }
  for (const a of document.querySelectorAll("main .fuentes li")) a.id ||= "fuente-" + ([...a.parentNode.children].indexOf(a) + 1);
  for (const a of document.querySelectorAll("a[href^='http']")) {
    if (a.host !== location.host) { a.target = "_blank"; a.rel = "noopener"; }
  }
  nextBroadcast();
  showSwap();
  const el = document.getElementById("map");
  if (el && window.L) {
    map?.remove();
    const places = [
      [40.7147086, -73.9916872, "46 Canal Street"],
      [40.7194406, -73.9990778, "215 Centre Street"],
      [40.7167326, -74.0005831, "125 White Street"],
    ];
    map = L.map(el, { scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    map.fitBounds(places.map(([lat, lon]) => [lat, lon]), { padding: [60, 60] });
    for (const [lat, lon, label] of places) {
      L.circleMarker([lat, lon], { radius: 6, color: "black", weight: 1, fillOpacity: 1 })
        .bindTooltip(label, { permanent: true, direction: "right" })
        .addTo(map);
    }
  }
  update();
});
