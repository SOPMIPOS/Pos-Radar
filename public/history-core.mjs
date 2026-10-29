// Shared calendar rules. Dates are calendar dates, never browser-local instants.
export const HEADERS = ['source_agency','source_document','source_url','source_page','observation_date','event_start_date','event_end_date','disaster_type','state','district','location','date_basis','notes','review_required'];
export const STATES = ['Johor','Kedah','Kelantan','Kuala Lumpur','Labuan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis','Pulau Pinang','Putrajaya','Sabah','Sarawak','Selangor','Terengganu'];
export function validDate(value) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
 const date = new Date(value + 'T00:00:00Z');
 return Number.isFinite(+date) && date.toISOString().slice(0,10) === value && value >= '1900-01-01' && value <= '2100-12-31';
}
export function malaysiaToday(now = new Date()) { return new Date(+now + 8*3600000).toISOString().slice(0,10); }
export function rollingDates(today = malaysiaToday()) {
 if (!validDate(today)) throw Error('Tarikh tidak sah.');
 return Array.from({length:30}, (_,i) => new Date(Date.parse(today+'T00:00:00Z')+i*86400000).toISOString().slice(0,10));
}
export function previousYear(date) {
 if (!validDate(date)) return null;
 const result = String(Number(date.slice(0,4))-1) + date.slice(4);
 return validDate(result) ? result : null; // 29 February has no matching date in a non-leap year.
}
export function recordsForDay(records, date, state='', type='') {
 const target = previousYear(date); if (!target) return [];
 return records.filter(r => (!state || r.state===state) && (!type || r.disaster_type===type) &&
  (r.date_basis==='observation_date' ? r.observation_date===target : r.event_start_date<=target && (r.event_end_date||r.event_start_date)>=target));
}
export const typeLabel = value => ({flood:'Banjir',earthquake:'Gempa bumi',storm:'Ribut',landslide:'Tanah runtuh',haze:'Jerebu',drought:'Kemarau',other:'Lain-lain'})[value] || value;
// Staff reports are observations, not weather predictions or incident intervals.
export function currentOperations(reports, today=malaysiaToday(), state='') {
 return reports.filter(r=>r.status==='active'&&validDate(r.report_date)&&r.report_date<=today&&(!state||r.state===state));
}
export function operationsForDay(reports, date, state='') {
 const target=previousYear(date);if(!target)return [];
 return reports.filter(r=>['active','resolved'].includes(r.status)&&r.report_date===target&&(!state||r.state===state));
}
