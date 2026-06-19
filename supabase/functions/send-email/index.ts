import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!
    )

    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const { toEmail, toName, subject, message, candidateId } = await req.json()

    if (!toEmail || !subject || !message) {
      throw new Error('Missing required fields')
    }

    // Attempt to send email via Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Pravesh <noreply@adonislabs.com>',
        to: [toEmail],
        subject: subject,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <p>Dear ${toName || toEmail},</p>
            <div style="white-space: pre-wrap;">${message}</div>
            <br/>
            <p>Best regards,<br/>The Pravesh Team</p>
          </div>
        `,
      }),
    })

    const resendData = await res.json()

    if (!res.ok) {
      // Log failure
      if (candidateId) {
        await supabase.from('email_logs').insert({
          candidate_id: candidateId,
          recipient_email: toEmail,
          subject: subject,
          status: 'failed',
          error_message: JSON.stringify(resendData)
        })
      }
      throw new Error(JSON.stringify(resendData))
    }

    // Log success
    if (candidateId) {
      await supabase.from('email_logs').insert({
        candidate_id: candidateId,
        recipient_email: toEmail,
        subject: subject,
        status: 'sent',
        sent_at: new Date().toISOString()
      })
    }

    return new Response(JSON.stringify({ success: true, data: resendData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
