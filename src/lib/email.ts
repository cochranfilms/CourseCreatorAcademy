export async function sendEmailJS(templateId: string, vars: Record<string, any>) {
  const serviceId = process.env.EMAILJS_SERVICE_ID as string;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY as string;
  if (!serviceId || !publicKey || !templateId) return { ok: false, skipped: true };
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: vars
    })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`EmailJS failed: ${res.status} ${txt}`);
  }
  return { ok: true };
}


