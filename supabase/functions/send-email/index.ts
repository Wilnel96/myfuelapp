import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EmailAttachment {
  filename: string;
  content: string;
}

interface EmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'Email service not configured. RESEND_API_KEY secret is required.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { to, subject, html, text, replyTo, attachments }: EmailRequest = await req.json();

    if (!to || !subject || (!html && !text && !attachments)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, and html or text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fromAddresses = [
      'MyFuelApp <noreply@myfuelapp.net>',
      'MyFuelApp <onboarding@resend.dev>',
    ];

    let lastError = '';
    for (const fromAddr of fromAddresses) {
      const payload: Record<string, unknown> = {
        from: fromAddr,
        to: Array.isArray(to) ? to : [to],
        subject,
        ...(html && { html }),
        ...(text && { text }),
        ...(replyTo && { reply_to: replyTo }),
        ...(attachments && attachments.length > 0 && { attachments }),
      };

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        return new Response(
          JSON.stringify({ success: true, id: result.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      lastError = await response.text();
      console.error(`Failed to send from ${fromAddr}:`, lastError);
    }

    return new Response(
      JSON.stringify({ error: 'Failed to send email', details: lastError }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Email send error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
