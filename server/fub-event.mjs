const FUB_ENDPOINT = 'https://api.followupboss.com/v1/events';

export async function submitFubEvent(payload, { apiKey, system, systemKey, fetchImpl, signal }) {
  const headers = {
    'Authorization': `Basic ${btoa(`${apiKey}:`)}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-System': system
  };
  if (typeof systemKey === 'string' && systemKey.trim()) {
    headers['X-System-Key'] = systemKey.trim();
  }
  const response = await fetchImpl(FUB_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
    redirect: 'error'
  });
  // A 204 indicates an archived FUB source. Upstream content is never exposed.
  await response.body?.cancel();
  return response.status === 200 || response.status === 201;
}
