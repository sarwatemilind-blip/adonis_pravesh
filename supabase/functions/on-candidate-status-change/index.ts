/**
 * Edge Function: on-candidate-status-change
 * Triggered by a Postgres webhook when candidates.status is updated.
 * Depends on environment variables: HR_EMAIL, APP_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Invokes the send-email edge function.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Verify it's an UPDATE operation
    if (payload.type !== "UPDATE" || payload.table !== "candidates") {
      return new Response("Ignored", { status: 200 });
    }

    const newRecord = payload.record;
    const oldRecord = payload.old_record;

    // Proceed only if status changed
    if (newRecord.status === oldRecord.status) {
      return new Response("Status unchanged", { status: 200 });
    }

    const candidateName = newRecord.name || "Candidate";
    const position = newRecord.position || "a position";
    const accessCode = newRecord.id;
    const candidateEmail = newRecord.email;
    const status = newRecord.status;
    const APP_URL = Deno.env.get("APP_URL") || "https://pravesh.adonislabs.com";
    const HR_EMAIL = Deno.env.get("HR_EMAIL") || "hr@adonislabs.com";
    const timestamp = new Date().toLocaleString();

    // Initialize Supabase Client to fetch manager details and invoke function
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let managerName = "Hiring Manager";
    let managerEmail = "";

    if (newRecord.manager_id) {
      const { data: manager } = await supabase
        .from("managers")
        .select("name, email")
        .eq("id", newRecord.manager_id)
        .single();
      
      if (manager) {
        managerName = manager.name;
        managerEmail = manager.email;
      }
    }

    let to = "";
    let cc = "";
    let subject = "";
    let body = "";

    switch (status) {
      case "invited":
        to = candidateEmail;
        subject = `Your Application — ${position} at Adonis Laboratories`;
        body = `Dear ${candidateName},\n\nWe are pleased to invite you to apply for ${position} at Adonis Laboratories Pvt. Ltd.\n\nClick the link below to fill your application form:\n${APP_URL}?code=${accessCode}\n\nYour access code: ${accessCode}\n\nIf the link does not open, go to the Candidate tab and enter code: ${accessCode}\n\nWarm regards,\n${managerName}\nAdonis Laboratories Pvt. Ltd.`;
        break;

      case "submitted":
        to = managerEmail;
        if (!to) return new Response("Manager email not found", { status: 400 });
        subject = `New application submitted — ${candidateName} for ${position}`;
        body = `Dear ${managerName},\n\n${candidateName} has completed and submitted their application for the position of ${position}.\n\nPlease log in to Pravesh to review the application and uploaded documents.\n\nSubmitted at: ${timestamp}\n\nRegards,\nPravesh — Adonis Laboratories`;
        break;

      case "interview_rated":
        to = HR_EMAIL;
        subject = `Interview rating ready for review — ${candidateName} (${position})`;
        body = `The hiring manager has completed the interview rating sheet for ${candidateName} applying for ${position}.\n\nPlease log in to Pravesh to review and take a final decision.\n\nRated by: ${managerName}\nDate: ${timestamp}\n\nRegards,\nPravesh — Adonis Laboratories`;
        break;

      case "approved":
        to = candidateEmail;
        subject = `Congratulations — Update on your application for ${position} at Adonis Laboratories`;
        body = `Dear ${candidateName},\n\nWe are pleased to inform you that your application for the position of ${position} at Adonis Laboratories Pvt. Ltd. has been approved.\n\nOur HR team will reach out to you shortly with the offer details and next steps.\n\nWarm regards,\nHR Team\nAdonis Laboratories Pvt. Ltd.`;
        break;

      case "rejected":
        to = candidateEmail;
        subject = `Update on your application — Adonis Laboratories`;
        body = `Dear ${candidateName},\n\nThank you for your interest in Adonis Laboratories Pvt. Ltd. and for taking the time to go through our application process.\n\nAfter careful consideration, we regret to inform you that we will not be moving forward with your application at this time.\n\nWe appreciate your effort and wish you all the best in your future endeavours.\n\nWarm regards,\nHR Team\nAdonis Laboratories Pvt. Ltd.`;
        break;

      case "offer_sent":
        to = managerEmail;
        cc = candidateEmail;
        subject = `Offer Letter — ${candidateName} | ${position} | Adonis Laboratories`;
        body = newRecord.offer_letter ? (newRecord.offer_letter.text || JSON.stringify(newRecord.offer_letter)) : "Offer letter attached.";
        break;

      default:
        return new Response("No email configured for this status", { status: 200 });
    }

    if (!to) {
      return new Response("Recipient email missing", { status: 400 });
    }

    // Call the send-email edge function
    // For CC, we can either append to `to` or send twice. SmtpClient `to` accepts comma separated strings.
    let finalTo = to;
    if (cc) {
      finalTo = `${to}, ${cc}`;
    }

    const { error: invokeError } = await supabase.functions.invoke('send-email', {
      body: {
        to: finalTo,
        subject: subject,
        body: body,
        candidateId: accessCode
      }
    });

    if (invokeError) {
      throw invokeError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
