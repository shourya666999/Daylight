# Security

## Local data

Daylight stores records, settings, and SQLite snapshots on the machine running the app. It does not need account credentials or third-party API keys, and the application makes no external service calls. The local database is not encrypted by Daylight; restrict access to your operating-system account and protect the device itself.

The server binds only to `127.0.0.1`, validates local Host and Origin headers, rejects cross-site mutations, and requires JSON for write requests. Do not expose the server through a reverse proxy or bind it to a public or shared network.

## Publishing safely

The repository ignore rules exclude SQLite databases, backup files, logs, local runtime paths, environment files, and common private-key formats. Before committing, inspect `git status` and review staged files. Never add personal records, screenshots containing real personal data, database files, backups, credentials, or private keys.

## Reporting a vulnerability

Please do not post exploitable security details in a public issue. Contact the repository owner privately with a concise description and reproduction steps.
