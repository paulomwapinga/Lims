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
    console.log("Auth header received:", authHeader ? "Yes" : "No");

    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "").trim();
    console.log("Token length:", token.length);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false
        }
      }
    );

    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError) {
      console.error("Auth error details:", JSON.stringify(authError, null, 2));
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    if (!user) {
      throw new Error("No user found from token");
    }

    console.log("User authenticated:", user.id);

    const { data: userProfile, error: profileError } = await adminClient
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

    const { visit_test_id, recipient_type } = await req.json();

    if (!visit_test_id) {
      throw new Error("Missing visit_test_id");
    }

    if (!recipient_type || !["patient", "lab_tech", "doctor"].includes(recipient_type)) {
      throw new Error("Invalid recipient_type. Must be 'patient', 'lab_tech', or 'doctor'");
    }

    const { data: visitTest, error: visitTestError } = await adminClient
      .from("visit_tests")
      .select(`
        id,
        lab_tech_id,
        visit:visits (
          id,
          doctor_id,
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

    let recipientPhone: string;
    let recipientName: string;
    let message: string;
    let smsType: string;

    if (recipient_type === "lab_tech") {
      if (!visitTest.lab_tech_id) {
        throw new Error("No lab technician assigned to this test");
      }

      const { data: labTech, error: labTechError } = await adminClient
        .from("users")
        .select("name, phone")
        .eq("id", visitTest.lab_tech_id)
        .maybeSingle();

      if (labTechError || !labTech) {
        throw new Error("Lab technician not found");
      }

      if (!labTech.phone) {
        throw new Error("Lab technician has no phone number");
      }

      recipientPhone = labTech.phone;
      recipientName = labTech.name;
      smsType = "lab_tech_notification";

      const messageTemplate = settingsMap.sms_lab_tech_message || "Hello {lab_tech_name}, test results for {patient_name} are ready for review.";
      message = messageTemplate
        .replace(/{lab_tech_name}/g, labTech.name)
        .replace(/{patient_name}/g, patient.name);
    } else if (recipient_type === "doctor") {
      if (!visit.doctor_id) {
        throw new Error("No doctor assigned to this visit");
      }

      const { data: doctor, error: doctorError } = await adminClient
        .from("users")
        .select("name, phone")
        .eq("id", visit.doctor_id)
        .maybeSingle();

      if (doctorError || !doctor) {
        throw new Error("Doctor not found");
      }

      if (!doctor.phone) {
        throw new Error("Doctor has no phone number");
      }

      recipientPhone = doctor.phone;
      recipientName = doctor.name;
      smsType = "doctor_notification";

      const messageTemplate = settingsMap.sms_doctor_message || "Hello Dr. {doctor_name}, test results for {patient_name} are ready for review.";
      message = messageTemplate
        .replace(/{doctor_name}/g, doctor.name)
        .replace(/{patient_name}/g, patient.name);
    } else {
      if (!patient.phone) {
        throw new Error("Patient has no phone number");
      }

      recipientPhone = patient.phone;
      recipientName = patient.name;
      smsType = "test_results";

      const messageTemplate = settingsMap.sms_completion_message || "Hello {patient_name}, your test results are ready. Please visit the clinic.";
      message = messageTemplate.replace(/{patient_name}/g, patient.name);
    }

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
        recipient_type: recipient_type,
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
