// Used by both the static form and the lead API. Validate the buyer's local
// clock reading against the UTC instant before making a calendar draft.
export function firstHomeAppointment({ appointment_date, appointment_time, appointment_start, timezone, name, email, phone }, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment_date) || !/^\d{2}:\d{2}$/.test(appointment_time)
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/.test(appointment_start)
      || typeof timezone !== 'string' || !timezone || timezone.length > 100) return null;
  const start = new Date(appointment_start);
  if (!Number.isFinite(start.getTime()) || start.getTime() <= now || start.toISOString() !== appointment_start) return null;
  let label;
  try {
    const format = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const parts = Object.fromEntries(format.formatToParts(start).map(({ type, value }) => [type, value]));
    if (appointment_date !== [parts.year, parts.month, parts.day].join('-') ||
        appointment_time !== [parts.hour, parts.minute].join(':')) return null;
    label = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric',
      year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(start);
  } catch { return null; }
  const end = new Date(start.getTime() + 20 * 60 * 1000);
  const draft = new URL('https://outlook.office.com/calendar/0/deeplink/compose');
  draft.search = new URLSearchParams({
    path: '/calendar/action/compose', rru: 'addevent', allday: 'false',
    subject: 'First Home Game Plan with ' + name, startdt: start.toISOString(), enddt: end.toISOString(),
    to: email, body: '20-minute First Home Game Plan. Requested for ' + label + '. Buyer: ' + email
      + (phone ? '\nEvan will call ' + phone + ' from 925-492-7023 at the confirmed time.' : '')
  }).toString();
  return { label, outlookUrl: draft.href };
}
