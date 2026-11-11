# Web Studio UX

## Navigation
Dashboard / Instrument Packs / Sample Import / Sample Mapper / Keyboard & Player / Song Timeline / Tuning Lab / Export / Settings.

## Main screens
### Instrument Packs
Create, duplicate, open, archive, import/export pack. Display license, author, sample count and warnings.
### Import Wizard
Drag/drop multiple WAVs, progress, duplicates, file validation, metadata inference suggestions, preview before commit.
### Sample Mapper
Table with editable root MIDI, key range, velocity bands, articulation, string/course and RR. Keyboard heatmap visualizes coverage/gaps. Waveform preview and audition.
### Player
On-screen keyboard, note velocity, cents slider (-200..200 default), articulation selector, instrument dropdown, panic/stop-all, polyphony indicator.
### Song Timeline
Track list, tempo, transport, JSON editor and validation, demo composition, WAV render/download. MIDI import is P1.
### Tuning Lab
Reference A4, cent offsets per pitch, named tuning presets, .scl import in P1, clearly distinguish 12-TET from historically contextual makam interpretations.
### Export
Manifest JSON, SFZ + WAV pack ZIP, offline WAV song; report unsupported SFZ capabilities and missing assets.

## UX/accessibility
Greek/English localization with translation keys. WCAG 2.2 AA target, focus visibility, labelled controls, keyboard alternatives for drag/drop, accessible error messages and reduced motion. Responsive desktop-first design. Never auto-start audio before user gesture.
