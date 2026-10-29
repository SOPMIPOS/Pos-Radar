# Admin guide: update historical disaster data

**Start here if you maintain historical disaster records for Pantau Cawangan. No coding or previous ChatGPT conversation is needed.**

[Download the initial Excel workbook](https://github.com/hudahaz/Weather-App/raw/refs/heads/main/admin-data/Malaysia-Historical-Disaster-Starter.xlsx) · [Open the reusable ChatGPT prompt](admin-data/ChatGPT-Update-Prompt.txt) · [Back to project overview](README.md)

## What this data is for

Historical records help staff see what happened around the same dates in a previous year. They are historical reminders, not predictions of future floods or other disasters. Updating this Excel file does not update live weather forecasts.

## First use: get the initial file

1. Click **Download the initial Excel workbook** above.
2. Save the file on your computer. If GitHub opens a file page instead, click **Download raw file** near the top right. Do not copy the preview or save the webpage as Excel.
3. Keep the original file as a backup.

The starter contains **1,047 location/date records** for selected Malaysian locations within **January 2025–September 2026**: 981 event-date records and 66 observation-only records. Coverage is **partial**, with a strong emphasis on selected Sarawak locations. These are not 1,047 distinct disasters, and missing records do not mean no disasters occurred. Read the workbook's **Coverage** sheet and review flags before use.

## When you need an update

1. Use your **latest reviewed workbook**. Use the starter only for the first update; repeatedly starting from it would lose later additions.
2. Open a new ChatGPT conversation and attach that workbook using the attachment button.
3. Copy the complete prompt below. On GitHub, use the copy button at the top right of the text box, or open the [plain-text prompt](admin-data/ChatGPT-Update-Prompt.txt).
4. Replace **[YYYY-MM-DD]** under Start date and End date with the period you want researched. Example: Start date **2026-10-01**, End date **2026-10-31**. Choose dates that have already occurred; historical records cannot be collected for future events.
5. Send the prompt. ChatGPT needs internet browsing and Excel file creation.
6. Download the returned **.xlsx** workbook and read the accompanying summary.
7. Open **Coverage** and **Historical_Events**. Check source links, date handling, review flags and record counts. Keep uncertain records flagged; do not treat them as confirmed.
8. Keep the previous reviewed file as a backup and label the newly reviewed file clearly. Use that new file as the attachment next time.

## Uploading to the website

**Status as of 29 October 2026: the historical-data importer is pending completion and deployment.** Adding this workbook to GitHub does not load its records into the website or activate the 30-day outlook.

The agreed workflow, once released, is: log in as Admin → **Urus pengguna** → **Import data sejarah** → choose the reviewed Excel file → inspect the validation preview → **Sahkan import**.

If that option is absent, keep the reviewed workbook and contact the application maintainer. Do not change column names or paste historical rows into operational reports.

## Copy this prompt into ChatGPT

```text
I administer Pantau Cawangan, a Pos Malaysia application that displays weather forecasts, operational disruptions and historical disaster references for Malaysia.

Please update the attached historical disaster Excel workbook. You do not need any previous conversation to perform this task.

PURPOSE
The application uses historical records to show what happened around the same calendar dates in the previous year. These are historical awareness reminders, not predictions that disasters will happen again.
Historical information is displayed generally by state, district or area. Do not map records to Pos Malaysia branches, PPL, PSM, postcodes or delivery SLA.

UPDATE PERIOD
Start date: [YYYY-MM-DD]
End date: [YYYY-MM-DD]

SOURCE FILE
Use the attached workbook as the master. Preserve all existing worksheets, records, column names and established value conventions.
If no workbook is attached, ask me to attach the latest historical disaster workbook before proceeding.

RESEARCH
Browse the internet for documented Malaysian disaster events within the update period. Prioritise official sources, including NADMA, JPS, MET Malaysia, DOE/APIMS and government agencies.
Use dated historical reports or archives. Do not treat a current river reading, forecast or weather warning as proof that a disaster occurred.
Every new record must have a verifiable source URL. Identify secondary sources clearly. Never invent records or claim complete national coverage when sources are incomplete.

EXCEL FORMAT
Preserve the worksheet name Historical_Events.
Keep these exact 14 column headers in this exact order:
source_agency
source_document
source_url
source_page
observation_date
event_start_date
event_end_date
disaster_type
state
district
location
date_basis
notes
review_required

Keep the header row at row 1. Do not insert titles, merged cells or explanatory rows above it.
Follow the attached workbook's existing field-value conventions, including disaster_type, date_basis and review_required.
Use actual Excel date values displayed as YYYY-MM-DD, without time components. Leave unknown values blank rather than entering guessed dates, zeroes or placeholder dates.

DATA RULES
1. Preserve existing records and append verified new records.
2. Exclude duplicates. Compare source, location, disaster type and dates; do not merge different locations merely because they share a date.
3. Keep observation dates separate from actual event dates. A report publication date does not automatically establish when an event started.
4. Do not infer districts from division names or invent missing geographic details.
5. Preserve uncertainty in notes and flag records needing review.
6. Do not silently replace conflicting existing information; flag the conflict.
7. Preserve source links and source-page references.
8. Treat missing records as a coverage gap, not evidence that no disasters occurred.
9. Update the Coverage worksheet and relevant source/methodology notes to reflect the resulting workbook.

DELIVERABLE
Return a downloadable .xlsx file named:
Malaysia-Historical-Disaster-Updated-[YYYY-MM-DD].xlsx
Use the date you prepare the file in its filename.

Before delivering, check that:
- The workbook opens successfully.
- Historical_Events contains the exact required headers.
- Dates are valid.
- New records have source URLs.
- Duplicate checks have been performed.
- Coverage totals match the records.

Also provide a short summary of:
- New records added.
- Duplicates excluded.
- Records requiring review.
- Date and geographic coverage.
- Remaining gaps and inaccessible sources.

Do not upload anything to the application or claim it has been deployed. The admin will review and import the returned Excel file separately.
If browsing or Excel creation is unavailable, explain the limitation instead of claiming the update is complete.
```
