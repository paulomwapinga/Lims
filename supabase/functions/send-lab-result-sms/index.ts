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
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "").trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
      auth: {
        persistSession: false,
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Auth error:", userError);
      throw new Error("Invalid JWT");
    }

    console.log("User authenticated:", user.id);

    const { data: userProfile, error: profileError } = await supabase
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

    const adminClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    );

    const { data: visitTest, error: visitTestError } = await adminClient
      .from("visit_tests")
      .select(`
        id,
        visit:visits (
          id,
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
      console.error("Visit test error:", visitTestError);
      throw new Error("Visit test not found");
    }

    console.log("Visit test data:", JSON.stringify(visitTest, null, 2));

    if (!visitTest.visit) {
      throw new Error("Visit data not found");
    }

    const visit = Array.isArray(visitTest.visit) ? visitTest.visit[0] : visitTest.visit;

    if (!visit) {
      throw new Error("Visit is null");
    }

    const patient = Array.isArray(visit.patient) ? visit.patient[0] : visit.patient;

    if (!patient) {
      throw new Error("Patient data not found");
    }

    const { data: settings } = await adminClient
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

    if (!patient.phone) {
      throw new Error("Patient has no phone number");
    }

    const recipientPhone = patient.phone;
    const recipientName = patient.name;
    const smsType = "test_results";

    const messageTemplate = settingsMap.sms_completion_message || "Hello {patient_name}, your test results are ready. Please visit the clinic.";
    const message = messageTemplate.replace(/{patient_name}/g, patient.name);

    let cleanPhone = recipientPhone.replace(/[^0-9]/g, "");
    cleanPhone = cleanPhone.replace(/^\+/, "");

    if (/^0[67]\d{8}$/.test(cleanPhone)) {
      cleanPhone = "255" + cleanPhone.substring(1);
    }

    if (!/^255[67]\d{8}$/.test(cleanPhone)) {
      throw new Error(`Invalid phone format: ${recipientPhone}`);
    }

    const trimmedApiKey = apiKey.trim();
    const trimmedSecret = secretKey.trim();

    console.log('Sending SMS to:', cleanPhone);
    console.log('Message:', message);
    console.log('Source:', sourceAddr);

    const beemResponse = await fetch("https://apisms.beem.africa/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${trimmedApiKey}:${trimmedSecret}`)}`,
      },
      body: JSON.stringify({
        source_addr: sourceAddr,
        schedule_time: "",
        encoding: 1,
        message: message,
        recipients: [
          {
            recipient_id: 1,
            dest_addr: cleanPhone,
          },
        ],
      }),
    });

    const beemResult = await beemResponse.json();
    const now = new Date().toISOString();

    const smsSuccess = beemResponse.ok;

    let errorDetails = null;
    if (!smsSuccess) {
      errorDetails = beemResult.message || beemResult.error || JSON.stringify(beemResult) || `HTTP ${beemResponse.status}`;
      console.error("Beem API error:", errorDetails);
      console.error("Full response:", beemResult);
    }

    await adminClient
      .from("sms_log")
      .insert({
        visit_id: visit.id,
        phone_number: recipientPhone,
        message: message,
        sms_type: smsType,
      });

    if (smsSuccess) {
      await adminClient
        .from("visit_tests")
        .update({ sms_sent_at: now })
        .eq("id", visit_test_id);
    }

    if (!smsSuccess) {
      throw new Error(`Beem API error: ${errorDetails}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "SMS sent successfully",
        recipient_name: recipientName,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
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
