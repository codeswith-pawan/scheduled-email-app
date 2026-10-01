// Schedules a burst of emails for the same moment and prints when each was sent,
// to show the worker's throughput limit and concurrency in action.
// Usage: npm run demo:load -- [count] [secondsFromNow]
const API_URL = process.env.API_URL ?? 'http://localhost:4000/api';
const EMAIL = process.env.DEMO_EMAIL ?? 'demo@example.com';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo@12345';

interface Envelope<T> {
  success: boolean;
  data: T;
  error?: { message: string };
}
interface SentEmail {
  id: string;
  toEmail: string;
  status: string;
  sentAt: string | null;
}

async function call<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
  const json = (await response.json()) as Envelope<T>;
  if (!json.success) throw new Error(json.error?.message ?? `Request failed: ${response.status}`);
  return json.data;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const count = Number(process.argv[2] ?? 20);
  const delaySeconds = Number(process.argv[3] ?? 45);
  const runId = Date.now();

  const { token } = await call<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  const scheduledAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
  const ids = new Set<string>();
  for (let i = 1; i <= count; i += 1) {
    const email = await call<{ id: string }>(
      '/emails/schedule',
      {
        method: 'POST',
        body: JSON.stringify({
          toEmail: `load-test-${i}@example.com`,
          subject: `Load test ${runId} #${i}`,
          body: `Message ${i} of ${count}`,
          scheduledAt,
        }),
      },
      token,
    );
    ids.add(email.id);
  }
  console.log(`Scheduled ${count} emails for ${scheduledAt}. Waiting for them to be sent...`);

  const deadline = Date.now() + (delaySeconds + count * 5 + 120) * 1000;
  let finished: SentEmail[] = [];
  while (Date.now() < deadline) {
    await sleep(3000);
    const sent = await call<SentEmail[]>('/emails/sent', {}, token);
    finished = sent.filter((email) => ids.has(email.id));
    console.log(`  ${finished.length}/${count} finished`);
    if (finished.length === count) break;
  }

  const times = finished
    .map((email) => (email.sentAt ? new Date(email.sentAt).getTime() : 0))
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (times.length === 0) {
    console.log('No emails were sent. Is the worker running (npm run worker)?');
    return;
  }

  const first = times[0] as number;
  console.log('\nSeconds after the first send, per email:');
  console.log(times.map((time) => ((time - first) / 1000).toFixed(1)).join('  '));
  console.log(`\nAll ${times.length} scheduled for the same instant, sent over ${((times.at(-1)! - first) / 1000).toFixed(1)}s.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
