import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: "admin" | "doctor" | "lab_tech";
}

interface UpdatePasswordRequest {
  userId: string;
  newPassword: string;
}

interface UpdateUserRequest {
  userId: string;
  name?: string;
  email?: string;
  role?: "admin" | "doctor" | "lab_tech";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: currentUser, error: userError } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (userError) {
      console.error("Error fetching current user:", userError);
      return new Response(
        JSON.stringify({ error: `Database error: ${userError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!currentUser || currentUser.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can manage users" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const url = new URL(req.url);
    const path = url.pathname;

    if (path.endsWith("/create") && req.method === "POST") {
      const { name, email, password, role }: CreateUserRequest = await req.json();

      console.log("Creating user:", { email, role, name });

      const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
        },
      });

      if (createAuthError) {
        console.error("Auth error:", createAuthError);
        return new Response(
          JSON.stringify({ error: createAuthError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (authData.user) {
        const { error: profileError } = await supabaseAdmin.from("users").insert({
          id: authData.user.id,
          name,
          email,
          role,
        });

        if (profileError) {
          await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
          return new Response(
            JSON.stringify({ error: profileError.message }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "User created successfully",
          user: authData.user
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else if (path.endsWith("/update-password") && req.method === "POST") {
      const { userId, newPassword }: UpdatePasswordRequest = await req.json();

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: newPassword }
      );

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Password updated successfully"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else if (path.endsWith("/update") && req.method === "POST") {
      const { userId, name, email, role }: UpdateUserRequest = await req.json();

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (role !== undefined) updates.role = role;

      if (Object.keys(updates).length === 0) {
        return new Response(
          JSON.stringify({ error: "No fields to update" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      if (email !== undefined) {
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { email }
        );

        if (authUpdateError) {
          return new Response(
            JSON.stringify({ error: authUpdateError.message }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update(updates)
        .eq("id", userId);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "User updated successfully"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else if (path.endsWith("/delete") && req.method === "POST") {
      const { userId } = await req.json();

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteError) {
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "User deleted successfully"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid endpoint" }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
