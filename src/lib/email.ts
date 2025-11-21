export async function sendEmailJS(templateId: string, vars: Record<string, any>) {
  const serviceId = process.env.EMAILJS_SERVICE_ID as string;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY as string;
  
  if (!serviceId || !publicKey || !templateId) {
    const missing = [];
    if (!serviceId) missing.push('EMAILJS_SERVICE_ID');
    if (!publicKey) missing.push('EMAILJS_PUBLIC_KEY');
    if (!templateId) missing.push('templateId');
    return { ok: false, skipped: true, error: `Missing required variables: ${missing.join(', ')}` };
  }
  
  try {
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
      const error = `EmailJS failed: ${res.status} ${txt}`;
      console.error(error);
      throw new Error(error);
    }
    
    return { ok: true };
  } catch (error: any) {
    console.error('EmailJS send error:', error);
    throw error;
  }
}


