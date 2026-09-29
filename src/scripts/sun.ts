/** The masthead's pixel sun: where it stands on its arc for an hour of the forest's day. */
const SUNRISE = 6;
const SUNSET = 19.4;

const sun = document.querySelector<SVGRectElement>('[data-sun]');
const radius = Number(sun?.closest('svg')?.dataset.radius ?? 7);

/** Walk the sun along its arc; after sunset it has gone below the ground line. */
export function placeSun(hour: number) {
  if (!sun) return;
  const t = Math.max(0, Math.min(1, (hour - SUNRISE) / (SUNSET - SUNRISE)));
  const a = Math.PI - t * Math.PI;
  sun.setAttribute('x', String(Math.round(radius + Math.cos(a) * radius)));
  sun.setAttribute('y', String(Math.round(radius - Math.sin(a) * radius)));
  sun.setAttribute('visibility', hour > SUNSET + 0.2 ? 'hidden' : 'visible');
}
