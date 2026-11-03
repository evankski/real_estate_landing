// Called only by the private appointment outbox. Both addresses belong to Evan.
export async function sendMicrosoftAppointment(mail, env) {
  const tenant = env.C02_MS_TENANT_ID?.trim();
  const client = env.C02_MS_CLIENT_ID?.trim();
  const guid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  if (!guid.test(tenant) || !guid.test(client) || !env.C02_MS_CLIENT_SECRET) {
    throw Object.assign(new Error('Microsoft sender not configured'), {code:'MS_CONFIG'});
  }
  const send = env.fetch || globalThis.fetch;
  const options = {method:'POST', redirect:'error', signal:AbortSignal.timeout(10000)};
  const auth = await send('https://login.microsoftonline.com/' + tenant + '/oauth2/v2.0/token', {
    ...options, body:new URLSearchParams({client_id:client, client_secret:env.C02_MS_CLIENT_SECRET,
      grant_type:'client_credentials', scope:'https://graph.microsoft.com/.default'})
  });
  if (!auth.ok) {
    await auth.body?.cancel();
    throw Object.assign(new Error('Microsoft authorization failed'), {code:'MS_TOKEN_' + auth.status});
  }
  const token = (await auth.json()).access_token;
  if (typeof token !== 'string' || !token) throw new Error('Microsoft returned no access token');
  const response = await send('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(mail.to) + '/sendMail', {
    ...options, headers:{Authorization:'Bearer ' + token, 'Content-Type':'application/json'},
    body:JSON.stringify({message:{subject:mail.subject, body:{contentType:'Text',content:mail.text},
      toRecipients:[{emailAddress:{address:mail.to}}], replyTo:[{emailAddress:{address:mail.replyTo}}]}})
  });
  await response.body?.cancel();
  if (response.status !== 202) {
    throw Object.assign(new Error('Microsoft did not accept the message'), {code:'MS_SEND_' + response.status});
  }
  // Graph accepts the message with an empty 202. Delivery is verified separately in Outlook.
  return {accepted:true};
}
