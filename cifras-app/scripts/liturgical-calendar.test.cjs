const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const calendar = year => JSON.parse(readFileSync(join(__dirname, `../public/liturgia/${year}.json`), 'utf8')).dias;
const id = (data, date) => data[date][0].id;

test('Brazilian transfers and principal celebrations in 2026', () => {
  const cal = calendar(2026);
  for (const [date, expected] of Object.entries({
    '2026-01-04': 'epiphany_of_the_lord',
    '2026-02-18': 'ash_wednesday',
    '2026-03-29': 'palm_sunday_of_the_passion_of_the_lord',
    '2026-04-02': 'thursday_of_the_lords_supper',
    '2026-04-03': 'friday_of_the_passion_of_the_lord',
    '2026-04-04': 'easter_vigil',
    '2026-04-05': 'easter_sunday',
    '2026-05-17': 'ascension_of_the_lord',
    '2026-06-04': 'most_holy_body_and_blood_of_christ',
    '2026-06-28': 'peter_and_paul_apostles',
    '2026-08-16': 'assumption_of_the_blessed_virgin_mary',
    '2026-10-12': 'our_lady_of_aparecida',
    '2026-11-01': 'all_saints',
    '2026-11-02': 'commemoration_of_all_the_faithful_departed',
    '2026-11-29': 'advent_1_sunday',
    '2026-12-25': 'nativity_of_the_lord',
  })) assert.equal(id(cal, date), expected, date);
  assert.equal(cal['2026-03-29'][0].propria, true);
  assert.equal(cal['2026-04-03'][0].propria, true);
});
test('All Saints stays on November 1 when November 2 is Sunday', () => {
  const cal = calendar(2025);
  assert.equal(id(cal, '2025-11-01'), 'all_saints');
  assert.equal(id(cal, '2025-11-02'), 'commemoration_of_all_the_faithful_departed');
});
test('Every supported civil date has a named celebration, valid cycle and catalog ID', () => {
  const catalog = JSON.parse(readFileSync(join(__dirname, '../public/liturgia/catalogo.json'), 'utf8'));
  const ids = new Set(catalog.liturgias.map(l => l.id));
  for (let year = catalog.primeiroAno; year <= catalog.ultimoAno; year++) {
    const cal = calendar(year);
    const expectedDays = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
    assert.equal(Object.keys(cal).length, expectedDays);
    for (const [date, events] of Object.entries(cal)) for (const event of events) {
      assert.ok(event.nome && !event.nome.includes('$(') && !event.nome.includes('{{'), date);
      assert.ok(['A', 'B', 'C'].includes(event.ciclo), date);
      assert.ok(ids.has(event.id) && ids.has(event.tempo), date);
    }
  }
});
