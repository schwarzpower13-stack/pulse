# Pulse Life

The AI version of Pulse, published as a claude.ai Artifact:
https://claude.ai/artifact/DiQPZLAjYd5vsEY7HPejNc

- Claude runs through the viewer's own claude.ai account (the Artifact `sample` capability), so there is no API key and no extra bill.
- Data is kept in the artifact's private per-user database (`db` + `user` capabilities), with a localStorage cache.
- `index.html` is the page body (the Artifact publisher wraps it in the document skeleton); `app.js`, `i18n.js` (Georgian + English) and `planner.js` (the offline fallback planner, shared with the PWA) are published alongside it.
