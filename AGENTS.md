# Architecture rules

- Vehicle damage activity uses the existing report status and last-update timestamp; label that time as a report update, not a status-change audit, because note and image edits also update it.
- Invalidate vehicle activity and damage-report queries after saving a report so cached views reflect the saved processing status.