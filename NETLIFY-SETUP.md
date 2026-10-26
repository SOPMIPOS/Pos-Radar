# Weather App — Supabase reporting

This branch serves the approved dark UI from `public/index.html`, with the Pos Malaysia logo, reports and Admin/User management. The original root weather files remain in the repository. Existing Netlify weather data/proxy functions and the Blobs dependency are retained.

## Netlify

Use this existing project: gorgeous-kitsune-f792c1, linked to hudahaz/Weather-App.
No build command is required. The publish directory is `public` and the functions directory is `netlify/functions`, as set in netlify.toml.

The Supabase project URL and publishable key are already in the connected page.
For username login and user management, set `SUPABASE_SECRET_KEY` as a Netlify environment variable available to Functions. Copy the secret directly from Supabase into Netlify; never commit it or send it in chat. A legacy key can alternatively be set as `SUPABASE_SERVICE_ROLE_KEY`. Redeploy after setting it.

Before enabling user management, run `setup/02-Admin-Protection.sql` once in the existing Supabase project's SQL Editor. Do not rerun the original database setup.

## Test

Email/password login and operational reports use the real Supabase project. Reports are public to read; only active authorised branch users and admins may edit them. The database captures the last editor's username and timestamp.

Test with a report clearly labelled TEST, then reload to verify it remains. Confirm branch restrictions, photos, resolved-only history, Admin/User roles and deletion on the test site.

Weather forecasts and MET/IPU/JPS warnings remain clearly labelled sample data. This is the reporting connection stage. Do not treat weather examples as current observations.

12 automated local checks passed using mocked Auth/database requests. Real public reads returned 96 branches. Authenticated real account writes/uploads and the Netlify runtime still require testing.

The approved working sources, tests and standalone file are also available in Weather-App-Connected-Package.zip supplied separately.
