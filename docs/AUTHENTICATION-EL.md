# OpenTimbre — Σύνδεση και εγγραφή

## Ενεργοποίηση
1. Αντιγράψτε το `.env.example` σε `.env`.
2. Ορίστε ισχυρό τυχαίο `AUTH_SECRET` (τουλάχιστον 32 χαρακτήρες). Μην το αποθηκεύσετε στο Git.
3. Εκκινήστε `docker compose -f docker-compose.neural.yml up --build`.
4. Ανοίξτε `http://localhost:8080` και επιλέξτε «Δημιουργία λογαριασμού».

## Πεδία
- **Name / Όνομα:** εμφανιζόμενο όνομα κατά την εγγραφή.
- **Email:** μοναδική διεύθυνση λογαριασμού.
- **Password / Κωδικός:** τουλάχιστον 12 χαρακτήρες κατά την εγγραφή.
- **Sign in / Σύνδεση:** σύνδεση με email και κωδικό.
- **Register / Εγγραφή:** δημιουργία νέου λογαριασμού.
- **Continue with GitHub:** εξωτερική σύνδεση OAuth.
- **Google:** επίσημο κουμπί Google Identity Services, εφόσον έχει ρυθμιστεί.
- **Sign out / Αποσύνδεση:** διαγραφή session cookie.

## Google
Δημιουργήστε OAuth Web Client στο Google Cloud. Προσθέστε το domain σας στα Authorized JavaScript origins. Ορίστε το ίδιο client ID στις `GOOGLE_CLIENT_ID` και `VITE_GOOGLE_CLIENT_ID` (η δεύτερη μεταβλητή ενσωματώνεται κατά το frontend build). Το backend επαληθεύει τα Google ID tokens.

## GitHub
Δημιουργήστε OAuth App και ορίστε callback URL `https://YOUR_DOMAIN/api/auth/github/callback` (για localhost: `http://localhost:8080/api/auth/github/callback`). Συμπληρώστε `GITHUB_CLIENT_ID` και `GITHUB_CLIENT_SECRET`.

## Ασφάλεια και περιορισμοί
Για HTTPS ορίστε `AUTH_COOKIE_SECURE=true`. Η βάση SQLite αποθηκεύεται στον persistent Docker volume. Οι κωδικοί αποθηκεύονται με Argon2. Τα sessions είναι HttpOnly cookies. Οι υπάρχουσες αποθηκεύσεις του Studio παραμένουν **στον browser και δεν απομονώνονται ανά λογαριασμό**: μην χρησιμοποιείτε κοινό browser μεταξύ χρηστών για ευαίσθητα projects. Πριν από δημόσια παραγωγική λειτουργία απαιτούνται rate limiting, password reset, email verification, CSRF protection για state-changing routes και per-user authorization για datasets/models/jobs. Μην εκθέτετε το API port 8000 δημόσια.
