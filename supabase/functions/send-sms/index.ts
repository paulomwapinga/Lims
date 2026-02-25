import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SmsRequest {
  phone: string;
  message: string;
  api_key?: string;
  secret_key?: string;
  source_addr?: string;
  apiUrl?: string;
  apiKey?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body: SmsRequest = await req.json();
    console.log('Received request body:', JSON.stringify(body));

    const { phone, message } = body;

    const api_key = body.api_key || body.apiKey || '';
    const secret_key = body.secret_key || '';
    const source_addr = body.source_addr || '';

    console.log('Parsed credentials:', {
      hasPhone: !!phone,
      hasMessage: !!message,
      hasApiKey: !!api_key,
      hasSecretKey: !!secret_key,
      hasSourceAddr: !!source_addr
    });

    if (!phone || !message) {
      console.error('Missing phone or message');
      return new Response(
        JSON.stringify({ error: "Phone number and message are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!api_key || !secret_key || !source_addr) {
      console.error('Missing SMS credentials', { api_key: !!api_key, secret_key: !!secret_key, source_addr: !!source_addr });
      return new Response(
        JSON.stringify({
          error: "SMS credentials not configured",
          missing: {
            api_key: !api_key,
            secret_key: !secret_key,
            source_addr: !source_addr
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let cleanPhone = phone.replace(/[^0-9]/g, "");
    cleanPhone = cleanPhone.replace(/^\+/, "");

    if (/^0[67]\d{8}$/.test(cleanPhone)) {
      cleanPhone = "255" + cleanPhone.substring(1);
    }

    if (!/^255[67]\d{8}$/.test(cleanPhone)) {
      return new Response(
        JSON.stringify({
          error: "Invalid phone format. Use 07XXXXXXXX or 2557XXXXXXXX format.",
          received: phone,
          cleaned: cleanPhone
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const trimmedApiKey = api_key.trim();
    const trimmedSecret = secret_key.trim();

    const credentials = btoa(`${trimmedApiKey}:${trimmedSecret}`);

    console.log('Sending SMS to:', cleanPhone);
    console.log('Source:', source_addr);
    console.log('API Key length:', trimmedApiKey.length);
    console.log('Secret Key length:', trimmedSecret.length);

    const response = await fetch("https://apisms.beem.africa/public/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${credentials}`,
      },
      body: JSON.stringify({
        source_addr: source_addr,
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

    const result = await response.json();

    if (!response.ok) {
      console.error("Beem Africa API error:", result);
      return new Response(
        JSON.stringify({
          error: "Failed to send SMS",
          details: result
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "SMS sent successfully",
        response: result
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending SMS:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
