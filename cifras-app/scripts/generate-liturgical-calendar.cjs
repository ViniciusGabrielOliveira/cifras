// Regenerate with: node scripts/generate-liturgical-calendar.cjs [firstYear] [lastYear]
// Source: romcal / Brazil_PtBr (MIT). Brazilian transfers corrected before calculation.
const { Romcal } = require('romcal');
const { Brazil_PtBr } = require('@romcal/calendar.brazil');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const out = join(__dirname, '../public/liturgia');
const first = Number(process.argv[2] || 2025), last = Number(process.argv[3] || 2035);
const seasons = { ADVENT: 'advento', CHRISTMAS_TIME: 'natal', LENT: 'quaresma', EASTER_TIME: 'pascoa', ORDINARY_TIME: 'tempo-comum', PASCHAL_TRIDUUM: 'triduo-pascal' };
const labels = { advento: 'Advento', natal: 'Natal', quaresma: 'Quaresma', pascoa: 'Páscoa', 'tempo-comum': 'Tempo Comum', 'triduo-pascal': 'Tríduo Pascal' };
const own = new Set(['ash_wednesday','palm_sunday_of_the_passion_of_the_lord','holy_thursday','thursday_of_the_lords_supper','friday_of_the_passion_of_the_lord','holy_saturday','easter_vigil','easter_sunday','nativity_of_the_lord','pentecost_sunday','commemoration_of_all_the_faithful_departed']);
function sundayFrom(year, month, day) { const d = new Date(Date.UTC(year, month - 1, day)); return day + (7 - d.getUTCDay()) % 7; }
async function main() {
  mkdirSync(out, { recursive: true });
  const catalog = new Map(Object.entries(labels).map(([id, nome]) => [id, { id, nome, grupo: 'Tempos litúrgicos' }]));
  for (let year = first; year <= last; year++) {
    const bundle = structuredClone(Brazil_PtBr);
    const fixed = {
      peter_and_paul_apostles: [6, sundayFrom(year, 6, 28)],
      assumption_of_the_blessed_virgin_mary: [8, sundayFrom(year, 8, 15)],
      all_saints: [11, new Date(Date.UTC(year, 10, 2)).getUTCDay() === 0 ? 1 : sundayFrom(year, 11, 1)],
    };
    for (const [id, [month, date]] of Object.entries(fixed)) {
      const inputs = bundle.inputs[id];
      inputs[inputs.length - 1] = { ...inputs[inputs.length - 1], dateDef: { month, date }, dateExceptions: [] };
    }
    const engine = new Romcal({ localizedCalendar: bundle, epiphanyOnSunday: true, ascensionOnSunday: true, corpusChristiOnSunday: false, outputOptions: { calculateProperties: true } });
    const raw = await engine.generateCalendar(year);
    const days = {};
    for (const [date, events] of Object.entries(raw)) {
      days[date] = events.map(event => {
        const id = event.id;
        const nome = id === 'thursday_of_the_lords_supper' ? 'Quinta-feira Santa — Missa da Ceia do Senhor' : event.name || id;
        const grupo = event.rank === 'SUNDAY' ? 'Domingos' : event.rank === 'WEEKDAY' && !own.has(id) ? 'Dias da semana' : 'Celebrações';
        catalog.set(id, { id, nome, grupo });
        return { id, nome, tempo: seasons[event.seasons.at(-1)] || 'tempo-comum', cor: event.colorNames?.join(' / ') || '', ciclo: event.cycles.sundayCycle.slice(-1), propria: own.has(id), grau: event.rankName || '', opcional: event.isOptional };
      });
      if (events[0].id === 'holy_thursday') {
        days[date].sort((a, b) => Number(b.id === 'thursday_of_the_lords_supper') - Number(a.id === 'thursday_of_the_lords_supper'));
      }
      if (events[0].id === 'holy_saturday') {
        const vigil = { ...days[date][0], id: 'easter_vigil', nome: 'Vigília Pascal', cor: 'branco', tempo: 'pascoa', propria: true, grau: 'solenidade', opcional: false };
        days[date].unshift(vigil); // Repertório da celebração noturna; Sábado Santo permanece consultável.
        catalog.set(vigil.id, { id: vigil.id, nome: vigil.nome, grupo: 'Celebrações' });
      }
    }
    writeFileSync(join(out, `${year}.json`), JSON.stringify({ ano: year, fonte: 'romcal/Brazil_PtBr; adaptações brasileiras documentadas no gerador', dias: days }));
  }
  writeFileSync(join(out, 'catalogo.json'), JSON.stringify({ primeiroAno: first, ultimoAno: last, liturgias: [...catalog.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }));
  console.log(`Calendário brasileiro: ${first}–${last}; ${catalog.size} liturgias.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
