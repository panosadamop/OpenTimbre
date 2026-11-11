# OpenTimbre — Τοπική ανάπτυξη (Windows / macOS / Linux)

## Απαιτήσεις
Node.js 20+, npm, Python 3.10+, διαθέσιμες θύρες 5173 και 8000. Για νευρωνική εκπαίδευση απαιτείται επιπλέον PyTorch· δεν εγκαθίσταται από το βασικό setup.

## Windows (PowerShell)
```powershell
.\scripts\dev.ps1 setup
.\scripts\dev.ps1 backend
```
Ανοίξτε δεύτερο PowerShell:
```powershell
.\scripts\dev.ps1 frontend
```
Εναλλακτικά χρησιμοποιήστε `scripts\dev.cmd setup` και αντίστοιχες εντολές.

## macOS / Linux
```bash
./scripts/dev.sh setup
./scripts/dev.sh backend
```
Σε δεύτερο terminal:
```bash
./scripts/dev.sh frontend
```

## Διευθύνσεις
Studio: http://localhost:5173 · API: http://localhost:8000/docs. Το Vite προωθεί `/api` στο backend. Η πρώτη εκτέλεση `setup` δημιουργεί `.env` με τυχαίο μυστικό και απομονωμένο Python environment.

## Εντολές
`setup`: εξαρτήσεις και demo fixtures · `frontend`: React/Vite · `backend`: FastAPI · `admin`: διαδραστική δημιουργία superadmin · `test`: tests · `build`: TypeScript/Vite build.

## Neural training
Για PyTorch: εγκαταστήστε ξεχωριστά `services/ai/requirements-neural.txt` στο `.venv`, σύμφωνα με την πλατφόρμα και την CPU/GPU σας. Η βασική εκκίνηση δεν εγγυάται ότι το neural training είναι διαθέσιμο.

## Ασφάλεια
Μην ανεβάζετε `.env`, δεδομένα χρηστών ή μοντέλα στο Git. Για δημόσιο deployment απαιτούνται HTTPS, secure cookies, διαχείριση μυστικών, όρια πόρων και επιπλέον έλεγχοι ασφάλειας.
