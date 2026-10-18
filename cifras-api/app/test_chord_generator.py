import unittest
from app.chord_generator import TUNINGS, analyze, enrich, generate, signature


class ChordGenerationTests(unittest.TestCase):
    def test_notes_fingers_and_bass(self):
        for name in ['C', 'Am', 'Gm7', 'F7M', 'GM7', 'C7(9-)', 'Gb7(5-)', 'C6/9', 'C7+', 'F#m7(b5)', 'C7(9/#11)', 'C/E', 'G/B', 'D/F#']:
            for instrument, tuning in TUNINGS.items():
                with self.subTest(name=name, instrument=instrument):
                    parsed = analyze(name, instrument)
                    ds = generate(name, instrument)
                    if parsed is None:
                        self.assertEqual(ds, [])
                        continue
                    self.assertTrue(ds)
                    required, bass = parsed
                    for d in ds:
                        frets = {f['corda']: f['casa'] for f in d['dedos']}
                        sounds = [pitch + frets.get(len(tuning) - i, 0) for i, pitch in enumerate(tuning) if len(tuning) - i not in d['cordasMutadas']]
                        self.assertEqual({s % 12 for s in sounds}, required)
                        if bass is not None:
                            self.assertEqual(min(sounds) % 12, bass)
                        self.assertTrue(all(d['casaBase'] <= f['casa'] < d['casaBase'] + 5 for f in d['dedos']))
                        if 'pestana' not in d:
                            self.assertLessEqual(len(d['dedos']), 4)
                        else:
                            self.assertLessEqual(1 + sum(f['casa'] > d['pestana'] for f in d['dedos']), 4)

    def test_variations_and_preservation(self):
        original = generate('C', 'violao')[0]
        data = {'variacoes': [dict(original, variacao='Minha posição')], 'notaManual': 'preservar'}
        first = enrich(data, 'C')
        self.assertGreater(len(first['variacoes']), 1)
        self.assertGreater(len(first['variacoesCavaco']), 1)
        self.assertEqual(first['variacoes'][0]['variacao'], 'Minha posição')
        self.assertEqual(first['notaManual'], 'preservar')
        self.assertEqual(enrich(first, 'C'), first)
        self.assertEqual(len(first['variacoes']), len({signature(d) for d in first['variacoes']}))

    def test_symbols(self):
        for a, b in [('F♯m7', 'F#m7'), ('B♭7', 'Bb7'), ('C7(9−)', 'C7(b9)'), ('Cº7', 'Cdim7'), ('Am7M', 'Ammaj7'), ('C7/9', 'C7(9)')]:
            self.assertEqual(analyze(a), analyze(b))

    def test_unknown_marked_for_review_without_fake_diagram(self):
        for name in ['Alegria', 'Cfoo', 'H7', 'C7(']:
            result = enrich({}, name)
            self.assertEqual(result['variacoes'], [])
            self.assertEqual(result['variacoesCavaco'], [])
            self.assertEqual(result['geracao']['status'], 'revisao')

    def test_registered_names_all_supported(self):
        from app.chords_db import CHORDS_DB
        for name in CHORDS_DB:
            for instrument in TUNINGS:
                with self.subTest(name=name, instrument=instrument):
                    self.assertGreaterEqual(len(generate(name, instrument)), 1)


if __name__ == '__main__':
    unittest.main()
