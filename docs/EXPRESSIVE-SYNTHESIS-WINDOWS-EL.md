# OpenTimbre v1.3 — Expressive Synthesis & Windows Local Development

## Τι υλοποιήθηκε
Το Instrument Generator υποστηρίζει pitch automation (glissando up/down, vibrato), καμπύλες δυναμικής (swell, fade), microtonal cents, velocity και articulation. Τα preset controls δημιουργούν σημεία automation με `time` (0..1, σχετική θέση στη διάρκεια) και `value` (cents για pitch, πολλαπλασιαστής 0..2 για dynamics). Το backend αποδέχεται έως 32 σημεία ανά καμπύλη. Η σύνθεση ολοκληρώνει τη στιγμιαία συχνότητα σε φάση ώστε να αποφεύγονται ασυνέχειες στα bends. Η νευρωνική έκδοση εξακολουθεί να είναι ένα *harmonic MLP baseline*, όχι μοντέλο που έμαθε πραγματικές τροχιές εκφραστικότητας από performances. Οι καμπύλες είναι ελεγχόμενη σύνθεση κατά το inference, όχι learned expressive performance modeling.

## Προαπαιτούμενα Windows
- Windows 10/11, PowerShell, Node.js 20+ (με npm), Python 3.11 ή 3.12 προτεινόμενη για PyTorch.
- Εγκατέστησε Node.js και Python και **κλείσε/άνοιξε νέο PowerShell**.
- Έλεγξε: `node --version`, `npm.cmd --version`, `py -0p`.
- Εάν χρησιμοποιείς Python 3.13, έλεγξε πρώτα αν υπάρχει συμβατή έκδοση PyTorch για το περιβάλλον σου. Η 3.11/3.12 είναι πιο προβλέψιμη επιλογή.

## 1. Πρώτη εγκατάσταση
Αποσυμπίεσε το ZIP σε φάκελο π.χ. `C:\Dev\OpenTimbre` (συνιστάται εκτός OneDrive, ώστε να αποφευχθούν locks/sync σε SQLite, venv και node_modules).

```powershell
cd C:\Dev\OpenTimbre
.\scripts\dev.ps1 setup
```

Το setup εγκαθιστά τα Python dependencies του βασικού backend και τα npm packages, δημιουργεί `.venv` και `.env`, και παράγει demo WAV. Εάν έχεις ήδη `.env`/`local-data`, κράτησε αντίγραφα και μην τα διαγράψεις.

### PyTorch για local neural training
Η βασική εγκατάσταση **δεν εγκαθιστά PyTorch**. Για CPU training:

```powershell
.\.venv\Scripts\python.exe -m pip install -r services\ai\requirements-neural.txt
```

Για GPU εγκατάσταση ακολούθησε τις οδηγίες της έκδοσης PyTorch που ταιριάζει σε GPU/driver/CUDA.

## 2. Δημιουργία Superadmin
Δεν υπάρχει ενσωματωμένος λογαριασμός ή προκαθορισμένος κωδικός. Ορίζεις εσύ email/password. Στο **ίδιο PowerShell**:

```powershell
$env:ADMIN_EMAIL = 'admin@opentimbre.local'
.\scripts\dev.ps1 admin
```

Το script θα ζητήσει νέο password (τουλάχιστον 12 χαρακτήρες), **εφόσον το email δεν υπάρχει ήδη**. Εάν ο χρήστης υπάρχει, αναβαθμίζεται σε superadmin και διατηρεί τον υπάρχοντα κωδικό. Μη χρησιμοποιείς `$env:ADMIN_PASSWORD` εκτός αν το χρειάζεσαι για μη διαδραστική αρχικοποίηση: το prompt είναι ασφαλέστερο.

Εάν το `admin` επιστρέψει `CalledProcessError`, διάβασε την **πρώτη** γραμμή του σφάλματος που εμφανίζεται πριν από το wrapper. Συνήθης αιτία: λείπει το `ADMIN_EMAIL`.

## 3. Εκκίνηση
PowerShell 1:

```powershell
cd C:\Dev\OpenTimbre
.\scripts\dev.ps1 backend
```

PowerShell 2:

```powershell
cd C:\Dev\OpenTimbre
.\scripts\dev.ps1 frontend
```

Άνοιξε `http://localhost:5173`. Σύνδεση με το email που έβαλες στο `ADMIN_EMAIL` και τον κωδικό που όρισες. Εναλλακτικά, από το UI κάνε **Register** για απλό χρήστη (ρόλος `user`). Η εγγραφή δεν δημιουργεί superadmin.

## 4. Ροή χρήσης
1. Login → Cloud Workspace → δημιούργησε προσωπική instrument library.
2. AI Recording Assistant → ανέβασε WAV, διόρθωσε MIDI/cents/articulation, σύνδεσέ το με τη βιβλιοθήκη.
3. Neural Instruments → επέλεξε βιβλιοθήκη → Train (χρειάζεται PyTorch και κατάλληλες ηχογραφήσεις).
4. Instrument Generator → επέλεξε `Local Neural`, μοντέλο, νότα, cents, articulation, Pitch Expression και Dynamics Envelope → Generate WAV.
5. Άκου, κατέβασε ή εισήγαγε το WAV στη sample library.

## 5. Αντιμετώπιση προβλημάτων
- `npm` WinError 2: χρησιμοποίησε τη νεότερη έκδοση `scripts/dev.py` (επιλύει `npm.cmd`), έλεγξε `npm.cmd --version`.
- `Set ADMIN_EMAIL to a valid address`: εκτέλεσε `$env:ADMIN_EMAIL = '...'` στο ίδιο terminal πριν το `admin`.
- `AUTH_SECRET` error: εκτέλεσε `setup` για παραγωγή `.env`, ή έλεγξε ότι το `.env` περιέχει τυχαίο μυστικό 32+ χαρακτήρων.
- `No module named torch`: εγκατέστησε `requirements-neural.txt` στο `.venv`.
- `401 Authentication required`: κάνε login στον browser. Τα APIs χρησιμοποιούν cookie session.
- `Select a trained local model`: κάνε train μοντέλο από προσωπική βιβλιοθήκη και επίλεξέ το στο Generator.
- OneDrive / SQLite file locks: μετέφερε το project σε μη συγχρονιζόμενο φάκελο, **αφού κρατήσεις backup**.

## Περιορισμοί
Το v1.3 δεν υλοποιεί real-time MIDI pitch bend streaming ή learned expressive sequence generation. Το vibrato είναι automation preset, ενώ τα glissandi/dynamics είναι interpolation curves κατά τη σύνθεση. Δεν έγινε end-to-end δοκιμή Windows στο περιβάλλον του χρήστη.
