# Pantau Cawangan

A Pos Malaysia dashboard for weather monitoring and branch delivery-disruption reporting.

**Status:** the first production version has been published and is ready for a small staff pilot. Netlify visitor access is configured separately from deployment; a published project can still be private.

Repository documentation is written in English. Website labels and operational wording remain in Malay.

## What the application does

- Shows daily and hourly weather forecasts, including temperature and precipitation for the source's stated time intervals.
- Displays MET weather warnings, APIMS air-quality readings and JPS flood/water-level warnings with distinct category colours.
- Highlights potentially affected branches and their postcode coverage.
- Collects operational reports with branch, postcode, multiple locations, BIT route code, pending-item counts, remarks and optional photos.
- Records the last editor's username and update time.
- Shows active operational disruptions in summary and branch views; resolved reports remain in operations history.
- Supports report search, filters, CSV export, active/resolved totals and confirmed permanent deletion.
- Provides Admin, Manager and User accounts.

Weather warnings and branch matching support operational review; they are not proof that every postcode or parcel in a flagged branch is affected.

## Pages

| Website page | Purpose |
| --- | --- |
| Laporan kaji cuaca | Daily and hourly forecasts, location/postcode search and weather monitoring maps |
| Ringkasan | Summary of affected branches and active operational disruptions |
| Pecahan negeri & cawangan | State and branch breakdown, reasons and postcode coverage by SLA |
| Laporan operasi | Create and maintain delivery-disruption reports; view active and resolved records |
| Urus pengguna | Admin-only account and access management |

## Accounts and access

| Role | Reporting access | Account administration |
| --- | --- | --- |
| Admin | All branches | Yes |
| Manager | Assigned whole states and/or individual branches, combined | No |
| User (stored as staff) | One assigned branch | No |

Report reading is public at the application/database level. Adding, editing and deleting reports require an active authorised account. Netlify project visibility can additionally restrict access to the entire website.

Deletion is permanent and requires confirmation. Use the resolved status (Selesai) when the record should remain in history.

## Repository files

| Path | Purpose |
| --- | --- |
| public/index.html | Current deployed application, including its bundled UI and embedded summary/branch views |
| public/assets/pos-malaysia.svg | Supplied Pos Malaysia logo |
| netlify/functions/ | Server endpoints for shared warnings, forecasts, login, account administration and report deletion |
| netlify/functions/lib/ | Forecast conversion/cache support and JPS parsing |
| setup/02-Admin-Protection.sql | Database protection for active Admin accounts |
| setup/03-Manager-Access.sql | Manager state/branch access migration |
| netlify.toml | Netlify publish directory, functions directory and response headers |
| package.json | Server dependency declaration |
| NETLIFY-SETUP.md | Deployment, environment variables, database prerequisites and verification |
| Root index.html, cawangan.html, core.js, style.css, pos-data.js and proxy.mjs | Original weather application/reference files retained from the earlier version |

**Netlify publishes public, not the repository root.** Editing only the old root HTML or JavaScript files does not update the deployed bundled application. The current public/index.html is a prebuilt artifact; its separate authoring/build sources and automated test suite are not currently committed in this repository. Add those sources before establishing a repeatable local build workflow.

## Branches, commits and pull requests

- **main** holds the approved production version. Updates to it trigger the linked Netlify production deployment.
- **codex/supabase-reporting-ui** was the development branch used for the reporting and forecast upgrade. Its changes were merged into main through [pull request #1](https://github.com/hudahaz/Weather-App/pull/1). It remains as the old development branch; it is not a second live application.
- A **commit** is a saved set of changes with a description and history.
- A **pull request** groups proposed changes for review and testing before merging them into main.
- A **Deploy Preview** is a Netlify test URL for proposed changes. Production is the main website address.

For future features, create a new branch from the latest main, test its Deploy Preview, then merge the approved pull request. Updating documentation does not require changing the website UI.

## Hosting and database

Netlify hosts the application and server functions. Supabase stores operational reports, account profiles, access assignments and photos; Supabase Auth manages login sessions.

The publish directory is public. No build command is currently required. Follow [NETLIFY-SETUP.md](NETLIFY-SETUP.md) for environment variables and database prerequisites.

The supplied project URL and publishable key are intended for browser use. Keep the Supabase secret/service-role key exclusively in server environment variables; never commit it.

The website address is managed in Netlify and may change when the project is renamed. A custom domain is optional.

## Data sources and limitations

- **Forecasts:** MET Norway Locationforecast, credited under CC BY 4.0. Forecasts preserve the provider's actual one-hour/six-hour intervals; rainfall is shown in mm for the specified period. Daily cards summarise available forecast points.
- **MET warnings:** official warning data obtained through the shared data endpoint.
- **IPU:** APIMS station readings, with accumulated shared history.
- **JPS:** current Public Infobanjir homepage notifications; historical readings are accumulated in the browser.
- **Time:** displayed operational and forecast times use Malaysia time.
- **Branch/postcode master:** the inherited snapshot contains 96 branches and 357 postcode ranges. Coverage, state assignments and SLA values need confirmation against the current operational master.

Sekarang, Hari ini and 7 hari can show the same affected branches when current warnings overlap or older records have not been collected. These controls do not provide a complete historical archive.

Maps show forecast locations, branches and monitoring stations, not flood boundaries or radar. A branch can cover several areas; an alert matched to one area may flag the whole branch.

**Historical flood prediction using previous years' records is not implemented.** Matching a past flood date to the same date this year would only be a historical reminder, not a reliable flood forecast.

Shared warning refresh is limited to once per 30 minutes. Open summary/branch pages poll the shared snapshot every two minutes. Provider failures may leave explicitly stale cached data or an error; check source timestamps.

## Verification and next steps

At the initial production release, 33 automated checks passed in the authoring workspace. They covered login and access, Manager scope, report editing/deletion, forecasts, JPS parsing and warning refresh. The owner also confirmed report persistence and Manager access in the deployed preview. These tests are not currently included in the repository.

Before wider rollout:
1. Confirm branch/postcode/SLA master data.
2. Remove or resolve clearly labelled test reports.
3. Test production login, permissions, report creation/editing, photos, resolution and deletion with test data.
4. Choose the website name and Netlify visitor access appropriate for the intended audience.
5. Gather feedback from a small group of staff.

Future work includes collecting suitable historical flood records and linking event locations to delivery areas.
