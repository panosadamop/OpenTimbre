# OpenTimbre Cloud Workspace v0.7

## Features
- Private compositions: save, list, load and delete.
- Private WAV recordings: upload, list, download and delete.
- Instrument metadata and model-reference metadata via REST API.
- Owner checks on every workspace request using the existing session cookie.

## API
`GET /api/v1/workspace/items`, `POST /api/v1/workspace/items`, `PUT /api/v1/workspace/items/{id}`, `DELETE /api/v1/workspace/items/{id}`, `POST /api/v1/workspace/recordings`, `GET /api/v1/workspace/recordings/{id}/audio`.

## Storage
SQLite metadata and per-user private WAV directories, under the existing persistent output Docker volume.

## Production gaps
Existing neural training and synthesis endpoints still use shared in-memory datasets and shared model directories; **they are not user-isolated yet**. This release isolates only the new workspace endpoints. CSRF defense, quotas, malware scanning, object storage, backups, migrations, pagination and end-to-end tests are required before public deployment.
