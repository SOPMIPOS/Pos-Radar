# Weather App — Supabase reporting

This branch serves the approved dark UI from `public/index.html`, with the Pos Malaysia logo, reports and Admin/Manager/User management. The original root weather files remain in the repository. Existing Netlify weather data/proxy functions and the Blobs dependency are retained.

## Netlify

Use this existing project: gorgeous-kitsune-f792c1, linked to hudahaz/Weather-App.
No build command is required. The publish directory is `public` and the functions directory is `netlify/functions`, as set in netlify.toml.

The Supabase project URL and publishable key are already in the connected page.
For username login and user management, set `SUPABASE_SECRET_KEY` as a Netlify environment variable available to Functions. Copy the secret directly from Supabase into Netlify; never commit it or send it in chat. A legacy key can alternatively be set as `SUPABASE_SERVICE_ROLE_KEY`. Redeploy after setting it.

Before enabling user management, run `setup/02-Admin-Protection.sql` once in the existing Supabase project's SQL Editor. To enable Manager accounts, also run `setup/03-Manager-Access.sql`. Do not rerun the original database setup.

## Test

Email/password login and operational reports use the real Supabase project. Reports are public to read; only active authorised Users, Managers and Admins may edit them. The database captures the last editor's username and timestamp.

Test with a report clearly labelled TEST, then reload to verify it remains. Confirm branch restrictions, photos, resolved-only history, Admin/User roles and deletion on the test site.

## Live weather

`/api/forecast` serves MET Norway Locationforecast data via a cached Netlify function; no API key is required. The upstream Expires and Last-Modified headers control shared caching. Requests identify this repository in User-Agent. The page credits MET Norway under CC BY 4.0.

Seven daily cards summarise available forecast points. The time view preserves the source's actual one-hour/six-hour intervals, and precipitation is shown in mm for the stated period; it does not invent hourly values or rainfall probabilities. All displayed times use Malaysia time. Location search accepts the existing branch/city names and covered postcodes.

MET and IPU map layers read the shared `/api/data` snapshot. JPS reads and parses the current Public Infobanjir homepage notifications table. Unmatched stations are not assigned to an arbitrary branch. The weather map shows forecast points/branches and monitoring stations, not flood boundaries or radar. The historical flood prediction model is not implemented.

Source failures show an error; a usable cached forecast is explicitly marked when stale. Forecasts refresh when returning to the page after ten minutes or when pressing Muat semula, while respecting upstream server cache expiry.

27 automated local checks pass, including forecast conversion, Malaysian dates, interval preservation, cache/304/stale handling, missing data, UI rendering, login/roles, report edits and user management. A live MET Norway response for Kuala Lumpur and the live JPS notifications HTML were parsed successfully. Authenticated real account writes/uploads and the private Netlify runtime require verification in the owner's signed-in browser.

The database admin-protection SQL above remains a required setup step. The Supabase secret has been configured for Deploy Previews; configure the Production context before publishing production. This branch does not modify the boss's repository or website.

## Manager access

Admin manages accounts and has all-branch reporting access. User (`staff`) keeps one assigned branch. Manager (`manager`) can be assigned multiple whole states and/or named branches; state assignments and branch assignments are combined. Managers cannot manage user accounts. Public report reading remains unchanged.

The migration adds `access_states` and `access_branches` arrays to `report_profiles`, expands the role constraint, validates the assignments and updates the existing `reporting_can_edit` function. Report and photo RLS policies and the report validation trigger already use this function, so database permission checks cover Managers too. State access is checked against the branch table, not a report's submitted state. Revoked or inactive access is enforced on subsequent writes.

Deploying the new UI before running the migration preserves existing Admin/User access. Manager creation is explicitly refused before creating an Auth account if the database columns are absent. Run the migration, refresh the site, then add/edit an account with role Manager and select its scope. Test both an assigned and an unassigned branch using that Manager account.
