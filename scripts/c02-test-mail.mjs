// Owner-run inbox test. Read the Microsoft credential from a hidden prompt via stdin.
// No lead is saved, no invitation is sent, and the recipient is fixed to the booking inbox.
import { readFile } from 'node:fs/promises';
import { text } from 'node:stream/consumers';
import { bookingEmail, bookingInbox } from '../server/c02-outbox.mjs';
import { firstHomeAppointment } from '../server/first-home-appointment.mjs';
import { sendMicrosoftAppointment } from '../server/c02-microsoft-mail.mjs';

const start = new Date();
start.setUTCDate(start.getUTCDate() + 1);
start.setUTCHours(18, 0, 0, 0);
const timezone = 'America/Los_Angeles';
const local = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:timezone,
  year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
}).formatToParts(start).map(({type,value}) => [type,value]));
const appointment = firstHomeAppointment({appointment_start:start.toISOString(),
  appointment_date:[local.year,local.month,local.day].join('-'), appointment_time:local.hour + ':' + local.minute,
  timezone, name:'TEST ONLY', email:bookingInbox, phone:'925-555-0146'});
const mail = bookingEmail({key:'setup-test-' + Date.now(), time:appointment.label, name:'TEST ONLY',
  email:bookingInbox, payload:{person:{phones:[{value:'925-555-0146'}]},
    message:'Setup test only. No appointment was booked.\n\nOpen test draft in Outlook:\n' + appointment.outlookUrl}});
mail.subject = '[C02 TEST] ' + mail.subject;

if (process.argv[2] === '--preview') {
  console.log(mail.subject + '\n' + mail.text);
} else {
  try {
    if (process.stdin.isTTY) throw new Error('Use the hidden PowerShell prompt in the C02 instructions.');
    const secret = (await text(process.stdin)).trim();
    const {vars} = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
    await sendMicrosoftAppointment(mail, {...vars, C02_MS_CLIENT_SECRET:secret});
    console.log('Microsoft accepted the test. Check Outlook for ' + mail.subject);
  } catch (error) {
    console.error('Test failed: ' + (error.code || error.message));
    process.exitCode = 1;
  }
}
