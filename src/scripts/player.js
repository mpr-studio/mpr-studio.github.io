// Player: always on screen, draggable, with what's playing now.
const STREAM = "https://167-235-224-167.sslip.io/listen/mpr-studio/radio.mp3";
const NOW = "https://167-235-224-167.sslip.io/api/nowplaying/mpr-studio";
const player = document.getElementById("player");
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
    if (show) { showBack(live); return; }
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
    if (show) { showBack(false); return; }
    status.textContent = "Off air";
    status.className = "";
    setNow("");
    document.getElementById("next").textContent = nextShow();
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
const next = document.getElementById("next");
function showBack(live) {
  next.innerHTML = live ? '<a href="#" class="back live">On air now: back to live</a>' : '<a href="#" class="back">← Back to live</a>';
}
next.addEventListener("click", (e) => {
  if (!e.target.closest(".back")) return;
  e.preventDefault();
  leaveShow();
  toggle();  // play live
});
let last = null;  // the broadcast you left for live, to go back to
const resume = document.getElementById("resume");
function showResume() {
  resume.innerHTML = "";
  if (show || !last) return;
  const a = document.createElement("a");
  a.href = "#";
  a.textContent = `→ ${last.title}, ${clock(last.pos)}`;
  resume.append(a);
}
resume.addEventListener("click", (e) => {
  if (!e.target.closest("a")) return;
  e.preventDefault();
  if (!audio.paused) toggle();  // stop the live stream
  playShow(last);
});
function savePos(b) { store("pos " + b.title, String(Math.floor(b.pos))); }
function leaveShow(finished) {
  if (!show) return;
  audio.pause();
  show.pos = finished ? 0 : (pending ?? audio.currentTime);
  savePos(show);
  last = finished ? null : show;
  show = null;
  audio.removeAttribute("src");
  audio.load();
  player.classList.remove("archive");
  nowText = null;
  setPlaying(false);
  showResume();
  update();
  nowPlaying();
  draw();
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
  if (t == null && show !== b && b.pos < duration(b) - 5) t = b.pos;  // resume where you left it
  if (show !== b) {
    audio.pause();
    show = b;
    pending = null;
    audio.src = b.src;
    player.classList.add("archive");
    resume.innerHTML = "";
    status.className = "";
    setNow(null);
    now.textContent = b.theme;
    showBack(false);
    nowPlaying();
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: b.title + ": " + b.theme, artist: "Montez Press Radio Studio Radio" });
    }
  }
  if (t != null) seek(t);
  connect();
  gain?.context.resume();
  audio.play().catch(() => setPlaying(false));
}
audio.addEventListener("ended", () => { if (show) leaveShow(true); });

// Each page's remote, and the floating player's line, follow the audio.
// Broadcasts are known by their audio URL, so the one playing survives
// moving between pages; the remotes on the current page rebind on each load.
const catalog = new Map();
function broadcast(el) {
  let b = catalog.get(el.dataset.src);
  if (!b) {
    b = {
      src: el.dataset.src,
      title: el.dataset.title,
      theme: el.dataset.theme,
      duration: Number(el.dataset.duration),
      pos: Number(stored("pos " + el.dataset.title)) || 0,
      peaks: [],
    };
    catalog.set(b.src, b);
    fetch(el.dataset.peaks).then((r) => r.json()).then((p) => { b.peaks = p; update(); }).catch(() => {});
  }
  return b;
}
let remotes = [];
let lastSave = 0;
audio.addEventListener("timeupdate", () => {
  if (!show) return;
  show.pos = audio.currentTime;
  if (Date.now() - lastSave > 5000) { lastSave = Date.now(); savePos(show); }
});
audio.addEventListener("pause", () => { if (show) savePos(show); });
function update() {
  if (show) status.textContent = `${show.title} · ${clock(pending ?? audio.currentTime)} / ${clock(duration(show))}`;
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
    el.querySelector(".show-wave").onclick = (e) =>
      playShow(b, e.offsetX / e.currentTarget.clientWidth * duration(b));
    for (const c of document.querySelectorAll("main .chapters [data-t]")) {
      c.onclick = () => playShow(b, Number(c.dataset.t));
    }
  }
  for (const a of document.querySelectorAll("a[href^='http']")) {
    if (a.host !== location.host) { a.target = "_blank"; a.rel = "noopener"; }
  }
  nextBroadcast();
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
