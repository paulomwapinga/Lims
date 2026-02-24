import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SmsRequest {
  phone: string;
  message: string;
  api_key: string;
  secret_key: string;
  source_addr: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { phone, message, api_key, secret_key, source_addr }: SmsRequest = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "Phone number and message are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!api_key || !secret_key || !source_addr) {
      return new Response(
        JSON.stringify({ error: "SMS credentials not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let cleanPhone = phone.replace(/[^0-9]/g, "");

    if (cleanPhone.startsWith("0")) {
      cleanPhone = "255" + cleanPhone.substring(1);
    }

    if (!cleanPhone.startsWith("255")) {
      return new Response(
        JSON.stringify({ error: "Phone number must be a valid Tanzania number" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let actualSecret = secret_key;

    if (secret_key.endsWith('==') || secret_key.endsWith('=')) {
      try {
        actualSecret = atob(secret_key);
        console.log('Decoded secret key (base64 -> plain)');
      } catch (e) {
        console.error('Failed to decode secret key:', e);
      }
    }

    const credentials = btoa(`${api_key}:${actualSecret}`);

    console.log('API Key (first 10):', api_key.substring(0, 10));
    console.log('Secret decoded:', actualSecret !== secret_key);
    console.log('Credentials length:', credentials.length);

    const response = await fetch("https://apisms.beem.africa/v1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${credentials}`,
      },
      body: JSON.stringify({
        source_addr: source_addr,
        schedule_time: "",
        encoding: 0,
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
