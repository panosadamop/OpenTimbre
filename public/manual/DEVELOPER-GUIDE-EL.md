# OpenTimbre — Οδηγός προγραμματιστή

## Δομή
- `packages/core`: τύποι οργάνων/συνθέσεων, επιλογή sample και pitch conversion.
- `packages/core/src/midi.ts`: βασική εισαγωγή/εξαγωγή MIDI, χωρίς pitch bend ή πλήρη tempo map.
- `packages/core/src/tunings.ts`: ενδεικτικά presets αποκλίσεων cents.
- `packages/sfz`: βασική παραγωγή περιοχών SFZ.
- `apps/studio`: React UI, Web Audio, IndexedDB.
- `tools/generate-fixtures.mjs`: συνθετικά δείγματα για δοκιμές.

## Εκτέλεση
Node.js 22+, `npm install && npm run fixtures && npm run dev`. `npm test` για διαθέσιμα tests και `npm run build` για TypeScript και παραγωγικό bundle. Εναλλακτικά Docker.

## Μοντέλα
Το instrument JSON περιλαμβάνει `schemaVersion:1`, `id`, `name`, `description`, `license`, `samples[]` με `path`, `root`, `rootCents`, `lo`, `hi`, `velocityMin`, `velocityMax`, `roundRobin`, `articulation`. Το song JSON περιλαμβάνει `title`, `bpm`, `notes[]` με `midi`, `start`, `duration`, `velocity`, `cents`. Οι χρόνοι είναι σε δευτερόλεπτα.

## Εκκρεμότητες για production
Ισχυρό schema validation, storage migrations, έλεγχος quota, πακετάρισμα samples, πλήρες MIDI, articulations, SFZ συμβατότητα, end-to-end tests, accessibility και security review. Μη χαρακτηρίζετε τους demo ήχους ως φυσικές ηχογραφήσεις.
