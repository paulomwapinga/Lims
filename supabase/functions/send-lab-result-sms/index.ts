import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError) {
      console.error("Auth error:", authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    if (!user) {
      throw new Error("No user found");
    }

    const { data: userProfile, error: profileError } = await supabaseClient
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile error:", profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    if (userProfile.role !== "admin" && userProfile.role !== "doctor") {
      throw new Error(`Unauthorized: Only admins and doctors can send SMS (current role: ${userProfile.role})`);
    }

    const { visit_test_id } = await req.json();

    if (!visit_test_id) {
      throw new Error("Missing visit_test_id");
    }

    const { data: visitTest, error: visitTestError } = await supabaseClient
      .from("visit_tests")
      .select(`
        id,
        visit:visits (
          patient:patients (
            id,
            name,
            phone
          )
        )
      `)
      .eq("id", visit_test_id)
      .maybeSingle();

    if (visitTestError || !visitTest) {
      throw new Error("Visit test not found");
    }

    const patient = visitTest.visit.patient;

    if (!patient.phone) {
      throw new Error("Patient has no phone number");
    }

    const { data: settings } = await supabaseClient
      .from("settings")
      .select("key, value");

    const settingsMap: Record<string, string> = {};
    if (settings) {
      settings.forEach((s: any) => {
        settingsMap[s.key] = s.value;
      });
    }

    const smsEnabled = settingsMap.sms_enabled === "true";
    if (!smsEnabled) {
      throw new Error("SMS is not enabled in settings");
    }

    const apiKey = settingsMap.sms_api_key;
    const secretKey = settingsMap.sms_secret_key;
    const sourceAddr = settingsMap.sms_source_addr;

    if (!apiKey || !secretKey || !sourceAddr) {
      throw new Error("SMS credentials are not configured");
    }

    const message = `Hello ${patient.name}, your test results are ready. Please visit the clinic.`;

    const beemResponse = await fetch("https://apisms.beem.africa/public/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${apiKey}:${secretKey}`)}`,
      },
      body: JSON.stringify({
        source_addr: sourceAddr,
        schedule_time: "",
        encoding: 0,
        message: message,
        recipients: [
          {
            recipient_id: 1,
            dest_addr: patient.phone,
          },
        ],
      }),
    });

    const beemResult = await beemResponse.json();
    const now = new Date().toISOString();

    const smsSuccess = beemResponse.ok;

    await supabaseClient
      .from("sms_logs")
      .insert({
        recipient_type: "patient",
        recipient_id: patient.id,
        phone_number: patient.phone,
        message: message,
        status: smsSuccess ? "sent" : "failed",
        error_message: smsSuccess ? null : (beemResult.error || "Unknown error"),
        sent_by: user.id,
        sent_at: smsSuccess ? now : null,
      });

    if (smsSuccess) {
      await supabaseClient
        .from("visit_tests")
        .update({ sms_sent_at: now })
        .eq("id", visit_test_id);
    }

    return new Response(
      JSON.stringify({
        success: smsSuccess,
        message: smsSuccess ? "SMS sent successfully" : "Failed to send SMS",
        error: smsSuccess ? null : beemResult.error,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: smsSuccess ? 200 : 500,
      }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 400,
      }
    );
  }
});
