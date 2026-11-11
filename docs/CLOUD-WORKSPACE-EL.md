# OpenTimbre Cloud Workspace v0.7

## Λειτουργίες
- Ιδιωτικές συνθέσεις: αποθήκευση, λίστα, φόρτωση, διαγραφή.
- Ιδιωτικές ηχογραφήσεις WAV: μεταφόρτωση, λίστα, λήψη, διαγραφή.
- Αποθήκευση metadata οργάνων και αναφορών μοντέλων μέσω REST API.
- Έλεγχος ιδιοκτησίας ανά αίτημα με βάση το authentication cookie.

## REST API
`GET /api/v1/workspace/items`, `POST /api/v1/workspace/items`, `PUT /api/v1/workspace/items/{id}`, `DELETE /api/v1/workspace/items/{id}`, `POST /api/v1/workspace/recordings`, `GET /api/v1/workspace/recordings/{id}/audio`.

## Αρχιτεκτονική
SQLite για metadata, ιδιωτικοί φάκελοι ανά user ID για WAV. Χρήση του υπάρχοντος login και του Docker volume `output`. Δεν απαιτείται cloud provider για τοπική λειτουργία.

## Περιορισμοί πριν από production
Τα προηγούμενα neural training/synthesis endpoints χρησιμοποιούν κοινή μνήμη και κοινό κατάλογο μοντέλων και **δεν είναι ακόμη απομονωμένα ανά χρήστη**. Η παρούσα έκδοση απομονώνει μόνο τα νέα Workspace endpoints. Απαιτούνται επίσης CSRF προστασία, quotas, malware scanning, object storage, backups, migrations, pagination και end-to-end tests. Μην εκθέσετε το backend δημόσια χωρίς αυτά.
