import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readFile } from 'node:fs/promises';
import { firstHomeAppointment } from './first-home-appointment.mjs';

const code = await readFile(new URL('../scripts/first-home-booking.js', import.meta.url), 'utf8');
function node() {
  const listeners = new Map();
  return {dataset:{}, hidden:false, disabled:false, value:'', textContent:'',
    addEventListener(key, cb) { listeners.set(key, cb); },
    emit(key) { return listeners.get(key)?.({preventDefault(){}}); },
    setAttribute(){}, removeAttribute(key){delete this[key];}, setCustomValidity(){}, reportValidity(){}, focus(){}, querySelectorAll(){return [];}, querySelector(){return node();}};
}
function calendarHarness({withUrl=true, widgetError=false}={}) {
  const ids = Object.fromEntries(['c02-preparation','c02-questions','c02-contact','c02-continue','c02-edit','c02-status',
    'c02-manual-fields','c02-switch','c02-calendar','c02-widget','c02-options','c02-local-zone','c02-preview-draft','c02-saved-title'].map(id=>[id,node()]));
  const form=ids['c02-preparation'], widget=ids['c02-widget'], events=[], calls=[], timers=new Map();
  const answers={name:'Test Buyer',email:'buyer@example.invalid',phone:'(925) 555-0146',buying_area:'Still exploring',move_timing:'A year or more',
    lender_status:'Not yet',representation_status:'Working with an agent',message:'',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
    appointment_date:'2099-07-06',appointment_time:'10:00'};
  const elements=Object.fromEntries(Object.entries(answers).map(([key,value])=>[key,Object.assign(node(),{value})]));
  form.elements={...elements,namedItem:key=>elements[key]};
  ids.contactForm = {elements:form.elements, closest:()=>node()};
  form.reportValidity=()=>true;
  form.dataset={calendar:withUrl ? 'https://calendly.com/test-only/free-session' : '',requestType:'First Home Game Plan time request',version:'public-vsl-v2'};
  const frame={contentWindow:{}};
  let activeFrame=null, onMessage, onOnline;
  widget.querySelector=()=>activeFrame;
  widget.replaceChildren=()=>{activeFrame=null;};
  ids['c02-calendar'].hidden=true;
  form.requestSubmit=()=>form.emit('submit');
  const window={navigator:{onLine:true},addEventListener:(name,cb)=>{if(name==='message')onMessage=cb; if(name==='online')onOnline=cb;},Calendly:{
    initInlineWidget(options) {calls.push(options); if(widgetError)throw Error('unavailable'); activeFrame=frame;}
  }};
  let n=0;
  runInNewContext(code,{window,document:{getElementById:id=>ids[id]},Intl,AbortController,firstHomeAppointment,
    setTimeout:fn=>{const token=++n;timers.set(token,fn);return token;},clearTimeout:token=>timers.delete(token),
    FormData:class { *[Symbol.iterator]() {yield* Object.entries(answers); yield ['contact_consent','on'];} }});
  const sent=[];
  let sendResult='accepted';
  window.initFirstHomeBooking({context:()=>({}),measure:name=>events.push(name),sendInquiry:async payload=>{
    sent.push(payload); if(sendResult==='error'||sendResult==='temporary')throw Object.assign(Error(),{retryable:sendResult==='temporary'});return sendResult;
  }});
  return {ids,form,events,calls,frame,sent, connection:state=>{window.navigator.onLine=state;if(state)onOnline();},chooseResult:value=>{sendResult=value;},
    submit:()=>form.emit('submit'), deliver:(origin,source,data)=>onMessage({origin,source,data}), timeout:()=>[...timers.values()].forEach(fn=>fn())};
}
const tick = () => new Promise(resolve=>setImmediate(resolve));
const scheduled={event:'calendly.event_scheduled',payload:{event:{uri:'https://api.calendly.com/scheduled_events/test-event'}}};

test('provider-confirmed appointment is separate from choosing a time, spoofed messages or repeat clicks',async()=>{
  const h=calendarHarness();
  h.submit(); h.submit(); h.submit(); await tick();
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].prefill.email,'buyer@example.invalid');
  assert.deepEqual(Object.values(h.calls[0].prefill.customAnswers),['Still exploring','A year or more','Not yet','Working with an agent','','(925) 555-0146']);
  h.deliver('https://evil.example',h.frame.contentWindow,scheduled);
  h.deliver('https://calendly.com',{},scheduled);
  h.deliver('https://calendly.com',h.frame.contentWindow,{event:'calendly.date_and_time_selected'});
  h.deliver('https://calendly.com',h.frame.contentWindow,{event:'calendly.event_scheduled',payload:{}});
  assert.deepEqual(h.events,['C02BookingStarted']);
  assert.doesNotMatch(h.ids['c02-status'].textContent,/Appointment confirmed/);
  h.deliver('https://calendly.com',h.frame.contentWindow,scheduled);
  h.deliver('https://calendly.com',h.frame.contentWindow,scheduled);
  assert.match(h.ids['c02-status'].textContent,/Appointment confirmed/);
  assert.deepEqual(h.events,['C02BookingStarted','Schedule']);
  assert.equal(h.sent.length,0);
});
test('provider startup failures and a silent embed leave a retry and the email option',async()=>{
  for(const widgetError of [true,false]) {
    const h=calendarHarness({widgetError});
    h.submit(); h.submit(); await tick(); h.timeout();
    assert.match(h.ids['c02-status'].textContent,/didn’t load/);
    assert.equal(h.ids['c02-continue'].disabled,false);
    assert.equal(h.ids['c02-switch'].hidden,false);
    h.ids['c02-switch'].emit('click');
    assert.match(h.ids['c02-continue'].textContent,/Request my 20-minute call/);
    assert.deepEqual(h.events,['C02BookingStarted']);
  }
});
test('manual email failures keep answers, duplicate submissions send once, and acceptance never confirms an appointment',async()=>{
  const h=calendarHarness({withUrl:false});
  h.submit(); h.chooseResult('error'); h.submit(); h.submit(); await tick();
  assert.equal(h.sent.length,1);
  assert.match(h.ids['c02-status'].textContent,/hasn’t been acknowledged/);
  assert.deepEqual(h.events,['C02BookingStarted']);
  h.chooseResult('accepted'); h.submit(); await tick(); h.submit();
  assert.equal(h.sent.length,2);
  assert.equal(h.sent[1].lender_status,'Not yet');
  assert.equal(h.sent[1].phone,'(925) 555-0146');
  assert.equal(h.sent[1].meeting_format,'Phone');
  assert.equal(h.sent[1].contact_method,'call');
  assert.match(h.ids['c02-status'].textContent,/is saved.*email you to confirm/);
  assert.match(h.ids['c02-status'].textContent,/call you from 925-492-7023/);
  assert.deepEqual(h.events,['C02BookingStarted','C02ManualTimeRequested']);
});

test('a local preview offers an unsent 20-minute Outlook draft; edits, errors and real receipts remove it',async()=>{
  const h=calendarHarness({withUrl:false});
  const link=h.ids['c02-preview-draft'];
  h.submit(); h.chooseResult('preview'); h.submit(); await tick();
  const url=new URL(link.href);
  assert.equal(url.origin,'https://outlook.office.com');
  assert.equal(url.searchParams.get('to'),'buyer@example.invalid');
  assert.equal(Date.parse(url.searchParams.get('enddt'))-Date.parse(url.searchParams.get('startdt')),20*60*1000);
  assert.equal(link.hidden,false);
  assert.match(h.ids['c02-status'].textContent,/No email was sent or time reserved/);
  h.form.emit('input');
  assert.equal(link.href,undefined);
  assert.equal(link.hidden,true);
  h.chooseResult('error'); h.submit(); await tick();
  assert.equal(link.hidden,true);
  assert.deepEqual(h.events,['C02BookingStarted']);
  h.chooseResult('accepted'); h.submit(); await tick();
  assert.equal(link.href,undefined);
  assert.equal(link.hidden,true);
});

test('an offline buyer reconnects and finishes without retyping or submitting a second time',async()=>{
  const h=calendarHarness({withUrl:false});
  h.submit(); h.connection(false); h.chooseResult('temporary'); h.submit(); await tick();
  assert.match(h.ids['c02-status'].textContent,/offline.*retry/);
  assert.deepEqual(h.events,['C02BookingStarted']);
  h.chooseResult('accepted'); h.connection(true); await tick();
  assert.match(h.ids['c02-status'].textContent,/is saved/);
  assert.equal(h.sent[0].appointment_start,h.sent[1].appointment_start);
  assert.deepEqual(h.events,['C02BookingStarted','C02ManualTimeRequested']);
});

test('both the demo and the final C02 recording render before the forms with immediate booking access',async()=>{
  const {videos} = await import('../scripts/campaign-config.mjs');
  const {firstHomePages} = await import('../scripts/generate-first-home.mjs');
  const key='first-home-plan';
  const saved=videos[key];
  const input=()=>'', ui={page:({content})=>content,esc:String,formStart:input,formEnd:input,hidden:input,field:input,input,options:input,
    videoPlayer:async id=>`<video controls data-key="${id}"></video>`};
  try {
    for (const recording of [videos.compare, {title:'Test recording'}]) {
      videos[key]=recording;
      const pages=await firstHomePages(ui);
      const html=pages.find(([path])=>path==='first-purchase/index.html')[1];
      assert.ok(html.includes('<video controls data-key="first-home-plan">'));
      assert.ok(html.indexOf('<video') < html.indexOf('Email me the sheet'));
      assert.ok(html.indexOf('<video') < html.indexOf('id="c02-preparation"'));
      assert.ok(html.includes('href="#booking">Book My First Home Game Plan</a>'));
    }
  } finally { videos[key]=saved; }
});
