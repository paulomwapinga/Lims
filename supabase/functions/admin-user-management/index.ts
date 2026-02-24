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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header found");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("Token received (first 20 chars):", token.substring(0, 20));

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError) {
      console.error("Auth verification error:", authError);
      return new Response(
        JSON.stringify({
          error: "Invalid or expired token",
          details: authError.message
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!user) {
      console.error("No user found for token");
      return new Response(
        JSON.stringify({ error: "User not found" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("User authenticated:", user.id, user.email);

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

      console.log("Update user request:", { userId, name, email, role });

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
        console.log("Updating email in auth.users...");
        const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { email }
        );

        if (authUpdateError) {
          console.error("Auth update error:", authUpdateError);
          return new Response(
            JSON.stringify({ error: `Failed to update email: ${authUpdateError.message}` }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        console.log("Email updated successfully in auth.users");
      }

      console.log("Updating user in database:", updates);
      const { data: updateData, error: updateError } = await supabaseAdmin
        .from("users")
        .update(updates)
        .eq("id", userId)
        .select();

      if (updateError) {
        console.error("Database update error:", updateError);
        console.error("Error code:", updateError.code);
        console.error("Error details:", updateError.details);
        console.error("Error hint:", updateError.hint);
        return new Response(
          JSON.stringify({
            error: `Failed to update user: ${updateError.message}`,
            code: updateError.code,
            details: updateError.details,
            hint: updateError.hint
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      console.log("User updated successfully, data:", updateData);

      console.log("User updated successfully");
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
