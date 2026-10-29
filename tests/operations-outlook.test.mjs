import test from 'node:test';
import assert from 'node:assert/strict';
import {currentOperations,operationsForDay} from '../public/history-core.mjs';
const reports=[
 {id:'current',report_date:'2026-10-29',state:'Kelantan',status:'active'},
 {id:'resolved',report_date:'2026-10-29',state:'Selangor',status:'resolved'},
 {id:'old-active',report_date:'2026-10-28',state:'Kelantan',status:'active'},
 {id:'future',report_date:'2026-11-01',state:'Kelantan',status:'active'},
 {id:'invalid',report_date:'2026-02-30',state:'Kelantan',status:'active'}
];
test('current operations show active reports to date, filtered by state, without treating future reports as current',()=>{
 assert.deepEqual(currentOperations(reports,'2026-10-29').map(r=>r.id),['current','old-active']);
 assert.equal(currentOperations(reports,'2026-10-29','Selangor').length,0);
});
test('2026 reports automatically become 2027 history, including resolved records',()=>{
 assert.deepEqual(operationsForDay(reports,'2027-10-29').map(r=>r.id),['current','resolved']);
 assert.deepEqual(operationsForDay(reports,'2027-10-29','Selangor').map(r=>r.id),['resolved']);
 assert.equal(operationsForDay(reports,'2026-10-29').length,0);
 assert.equal(operationsForDay(reports,'2028-10-29').length,0);
});
test('historical operations use only the report date and do not infer an incident duration',()=>{
 assert.equal(operationsForDay(reports,'2027-10-30').length,0);
 assert.equal(operationsForDay(reports,'2028-02-29').length,0);
 assert.equal(operationsForDay([], '2027-10-29').length,0);
});
