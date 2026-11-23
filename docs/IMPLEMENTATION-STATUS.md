# Implementation status (MVP)

Implemented: React Studio, synthetic WAV demo, WAV import and root mapping, pure TypeScript sample selector, per-note cents, velocity, basic sample playback, note editor, song playback, offline stereo WAV rendering, JSON exports, basic SFZ generator, Docker and unit tests.

Pending: IndexedDB persistence, ZIP sample pack import/export, MIDI file import/export, advanced articulations, proper round robin metadata, configurable instrument tuning libraries and Scala importer, multilingual translations beyond navigation, drag-drop sample editor, recording capture, native sfizz bridge, browser E2E tests and CI. This is not yet production complete.

Tests: run `npm test` and `npm run build`. Browser interaction is not automatically verified.

## User & role management

Implemented: permission-based roles (3 built-in + custom), enforced on workspace, catalogue publishing, synthesis, neural training, recording analysis and admin endpoints; Administration UI for users (create, edit, role, disable/enable, password reset, revoke sessions, delete with data purge), roles (editor + permission matrix) and an audit log; immediate session revocation via per-user token version; automatic migration of pre-existing auth databases. Backend tests: `services/ai/tests/test_admin.py` (run `scripts/dev.py test`).

Pending: self-service password change and "forgot password" email flow, two-factor authentication, sign-in rate limiting/lockout, audit-log retention and export, browser E2E tests for the admin UI.
