# Netlify and Supabase setup

This guide describes the current production application in hudahaz/Weather-App. Repository documentation is in English; website labels remain in Malay.

## Current deployment

The approved dashboard was merged into main through pull request #1 and published to Netlify. The linked project is now named posweather (previously gorgeous-kitsune-f792c1). Its production URL is https://posweather.netlify.app/. The owner screenshot confirms it is Published and still Private.

- Production branch: main
- Publish directory: public
- Functions directory: netlify/functions
- Build command: none
- Function bundler: esbuild
- Dependency: @netlify/blobs, declared in package.json

Use the existing linked Netlify project. Do not create another project for a routine update. The root HTML files are retained references; the deployed entry point is public/index.html.

## Environment variables

Set SUPABASE_SECRET_KEY in Netlify environment variables with access for Functions. A legacy SUPABASE_SERVICE_ROLE_KEY is also accepted by the server code.

On 27 October 2026, an incorrect Production secret caused username login and user management to fail while direct email login still worked. The owner corrected the Production secret, redeployed and confirmed both services work. Check the actual value and Functions scope in the relevant context when troubleshooting; a populated field alone does not prove the key is valid. Environment-variable changes require a new deployment to take effect.

Copy secret values directly from Supabase to Netlify. Never put them in GitHub, browser code, screenshots or chat. The Supabase project URL and publishable key are already included in the application and are intended for browser use.

## Existing database prerequisites

The original Supabase database, tables, storage bucket, initial Admin profile and row-level security were set up separately. The two SQL files in this repository are incremental migrations, not a complete database bootstrap.

For this existing project, the owner has already run:
- setup/02-Admin-Protection.sql
- setup/03-Manager-Access.sql

Do not rerun the original database setup as part of a website redeploy. A new Supabase project needs the original schema and initial account setup before these migrations; that full bootstrap is not currently included here.

The Admin migration protects the last active Admin. The Manager migration adds state/branch assignments and updates reporting_can_edit. Existing report and photo permission checks use that function.

## Accounts

Account management accepts new passwords of 8–128 characters. Supabase may enforce additional password policy requirements. Existing passwords are unchanged.

Admin has all-branch reporting and account management. User (staff) has one branch. Manager has the union of selected whole states and named branches, without account administration.

Supabase Auth verifies sessions. Server account-management endpoints require an active Admin profile. Report and photo writes are scoped by database permission checks; report editor attribution and update times are assigned by the database.

Report reading is public at the application/database level. Netlify Private visibility restricts the entire deployed website independently of the application's login.

## Netlify visitor access and naming

A successful production deployment does not automatically make a Private project public. In Netlify, configure production and preview visibility separately under Project configuration > General > Visitor access > Project visibility.

Public production access lets anyone with the URL read the website's public content; adding/editing/deleting reports still requires application login and the correct access scope. Keep the site's intended audience in mind when choosing visibility.

Change the project/site name in Netlify to change the default netlify.app address. Update any shared bookmarks after renaming. Preview addresses also depend on the project name.

## Password recovery — unfinished

The current app has no recovery/change-password screen or recovery-token handling. A reset email alone will not complete a password change. Supabase Authentication > URL Configuration should use https://posweather.netlify.app as the Site URL instead of localhost; add the exact recovery redirect URL when that screen is implemented. Recovery must then be tested with a fresh email link. Do not treat the Site URL change as a complete recovery fix.

## Troubleshooting login and user management

If email login works but username login and Urus pengguna fail, inspect the server connection first:
1. In Supabase Settings > API Keys, copy the project's secret key using its copy control.
2. Set SUPABASE_SECRET_KEY in Netlify for Production with Functions scope. Keep it server-only and avoid extra whitespace or line breaks.
3. Save and trigger a new production deploy, then retest after Published.
4. If the problem persists, inspect the report-login/report-users function logs without exposing keys or session tokens.

A blank user list after a service error does not mean accounts were deleted. Renaming the same Netlify project does not require recreating Supabase accounts. Avoid creating duplicate accounts to repair a loading error.

## Server endpoints

| Endpoint | Purpose |
| --- | --- |
| /api/data | Shared MET, APIMS and JPS warnings, stored with Netlify Blobs and a shared 30-minute manual-refresh limit |
| /api/forecast | Cached MET Norway forecasts; no provider API key required |
| /api/report-login | Username login through Supabase Auth |
| /api/report-users | Authenticated Admin account management |
| /api/report-delete | Authenticated, authorised permanent report deletion |

Forecast requests identify this repository to MET Norway and respect upstream Expires/Last-Modified caching. The UI preserves actual forecast intervals and shows Malaysia times. It credits MET Norway under CC BY 4.0.

JPS parsing uses the current Public Infobanjir homepage notifications table. Source HTML can change, so parser failures need investigation rather than interpreting them as no warnings.

## Report deletion

Sunting includes Padam laporan for an existing report and a separate confirmation naming its branch, postcode, BIT and date. Selesai preserves history instead.

DELETE /api/report-delete validates the caller, reads the actual report branch and asks reporting_can_edit using the caller's JWT. Only then does it delete with the server secret, checking the expected version. The attached photo is cleaned up after the row is removed. Cleanup failure returns a warning even though the report deletion succeeded.

Direct browser DELETE privileges are not enabled. No additional deletion SQL migration is required.

## Verify a deployment

1. Confirm the latest production deploy is Published in Netlify.
2. Open the main website URL; if it is Private, use an authorised Netlify session.
3. Check daily/hourly forecasts and MET/IPU/JPS source timestamps.
4. Sign in to the application. Create a clearly labelled TEST report, reload and confirm persistence.
5. Check editing, photos, resolved history and KPI totals.
6. Check an assigned and an unassigned branch using a Manager/User account.
7. Test permanent deletion only on disposable test data.
8. Resolve or delete test reports before wider rollout.

After the password-minimum update, 34 automated checks passed in the authoring workspace, including the eight-character password boundary. The test suite and separate build sources are not currently committed in this repository. The owner confirmed report persistence and Manager access in the deployed preview. The owner subsequently confirmed production email/username login and user management after correcting the Production secret; other operations should still be tested with disposable data during the staff pilot.

## Future changes

Create a new branch from current main, make the change, test the Netlify Deploy Preview, then merge the approved pull request to main. Netlify deploys the new production version automatically. Retain the existing SQL data and server secrets during UI updates.

The current application is prebuilt in public/index.html. Editing the original root index.html/core.js alone will not update it. Commit the separate authoring sources/build workflow before relying on repeatable source builds.

Historical flood prediction is not implemented. Branch/postcode/SLA coverage still requires confirmation against the operational master.
