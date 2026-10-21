// Full-screen image viewer, as on the Parques site: a native modal <dialog>
// (focus stays inside, Escape closes), plain white. Arrows, keys or a swipe
// step through a gallery; × or a click outside the image closes it.
const visor = document.getElementById("visor");
const img = visor.querySelector("img"), pie = visor.querySelector("figcaption");
const prev = visor.querySelector(".visor-anterior"), next = visor.querySelector(".visor-siguiente");
let set = [], i = 0;
function show() {
  const b = set[i];
  img.src = b.dataset.zoom;
  img.alt = b.querySelector("img")?.alt || "";
  pie.textContent = b.dataset.pie || "";
  prev.hidden = next.hidden = set.length < 2;
}
const step = (d) => { i = (i + d + set.length) % set.length; show(); };
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-zoom]");
  if (!b) return;
  const group = b.closest(".galeria");
  set = group ? [...group.querySelectorAll("[data-zoom]")] : [b];
  i = set.indexOf(b);
  show();
  visor.showModal();
});
prev.onclick = () => step(-1);
next.onclick = () => step(1);
visor.querySelector(".visor-cerrar").onclick = () => visor.close();
visor.addEventListener("click", (e) => { if (e.target === visor) visor.close(); });
visor.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") step(-1);
  if (e.key === "ArrowRight") step(1);
});
let x0 = null;
visor.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
visor.addEventListener("pointerup", (e) => {
  if (x0 !== null && set.length > 1 && Math.abs(e.clientX - x0) > 50) step(e.clientX < x0 ? 1 : -1);
  x0 = null;
});
