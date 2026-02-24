import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const accounts = [
      {
        email: 'admin@remtullah.com',
        password: 'admin123',
        name: 'Admin User',
        role: 'admin',
      },
      {
        email: 'doctor@remtullah.com',
        password: 'doctor123',
        name: 'Dr. Sarah Ahmed',
        role: 'doctor',
      },
      {
        email: 'labtech@remtullah.com',
        password: 'labtech123',
        name: 'Lab Technician',
        role: 'lab_tech',
      },
    ];

    const results = [];

    for (const account of accounts) {
      try {
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const userExists = existingUser?.users.some((u) => u.email === account.email);

        if (userExists) {
          results.push({
            email: account.email,
            status: 'already_exists',
            message: 'User already exists',
          });
          continue;
        }

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: account.email,
          password: account.password,
          email_confirm: true,
          user_metadata: {
            name: account.name,
          },
        });

        if (authError) {
          results.push({
            email: account.email,
            status: 'error',
            message: authError.message,
          });
          continue;
        }

        if (authData.user) {
          const { error: profileError } = await supabaseAdmin.from('users').insert({
            id: authData.user.id,
            name: account.name,
            email: account.email,
            role: account.role,
          });

          if (profileError) {
            results.push({
              email: account.email,
              status: 'partial',
              message: 'Auth user created but profile creation failed: ' + profileError.message,
            });
          } else {
            results.push({
              email: account.email,
              status: 'success',
              message: 'Account created successfully',
            });
          }
        }
      } catch (error) {
        results.push({
          email: account.email,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: 'Demo accounts setup completed. You can now login with the credentials.',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
