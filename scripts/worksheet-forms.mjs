// The worksheet generators share the same consent envelope and time-request
// workflow. Each campaign supplies its own resources and preparation questions.
export function worksheetRequest(ui, c, { key, requestType, label, submit }) {
  const { formStart, hidden, field, input, formEnd } = ui;
  return formStart({ key, requestType, interest: 'Buying a home', campaignId: c.id, thanks: c.watch, label,
    successMessage: 'Your request is received. Open the sheet and walkthrough using the link below. Evan will follow up personally by email.' }) +
    `${hidden('contact_method', 'email')}${hidden('route_version', c.version)}
    <fieldset data-form-step="1" data-step-label="Your details"><legend>Where can I follow up?</legend><div class="form-grid">
    ${field('Your name', input('name', 100, 'autocomplete="name" required'), true)}
    ${field('Email', input('email', 254, 'type="email" autocomplete="email" required'), true)}
    </div>${formEnd(submit)}`;
}

export function sessionRequest(ui, c, { key, areas, details, next, step, legend, submit }) {
  const { formStart, hidden, contactFields, field, input, options, formEnd, esc } = ui;
  return formStart({ key, requestType: c.title, interest: 'Buying a home', campaignId: c.id, thanks: c.thanks, label: `Your ${c.title}` }) +
    `${hidden('route_version', c.version)}<fieldset data-form-step="1" data-step-label="Contact details"><legend>How can I reach you?</legend><div class="form-grid">${contactFields()}
      ${areas ? field('Where are you considering homes?', `<select name="area" required>${options(areas)}</select>`, true) : ''}
      ${field('Are you currently working with another agent?', `<select name="representation_status" required>${options(['Not working with an agent', 'Working with an agent', 'Not sure'])}</select><span class="field-hint">We’ll clarify any existing agreement before personalized work. You can still use the free sheet.</span>`, true)}
    </div><button class="button primary form-continue" type="button" data-form-next>${esc(next)}</button><p class="form-step-note">Nothing is sent until you submit the completed request.</p></fieldset>
    <fieldset data-form-step="2" data-step-label="${esc(step)}"><legend>${esc(legend)}</legend><div class="form-grid">
      ${details}
      ${field('Conversation format', '<select name="meeting_format" id="meetingFormat" required><option value="Video">Video</option><option value="Phone">Phone</option></select>', true)}
      ${field('A preferred day and time window', input('preferred_time_one', 200, 'required placeholder="For example, Tuesday between 4 and 6 pm"'), true)}
      ${field('Another time that could work', input('preferred_time_two', 200, 'placeholder="A second option, if you have one"'), true, true)}
      ${field('Your time zone', input('timezone', 100, 'required value="Pacific time (Los Angeles)"'), true)}
    </div>${formEnd(submit, true)}`;
}
