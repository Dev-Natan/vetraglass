import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateEmployeeUserRequest {
  email: string;
  employeeId: string;
  employeeName: string;
  companyId: string;
  permissionProfileId?: string;
  redirectUrl: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      email, 
      employeeId, 
      employeeName,
      companyId, 
      permissionProfileId,
      redirectUrl 
    }: CreateEmployeeUserRequest = await req.json();

    if (!email || !employeeId || !companyId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Creating user for employee ${employeeName} (${email})`);

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      // User already exists - just link to employee
      userId = existingUser.id;
      console.log(`User already exists: ${userId}`);
    } else {
      // Create new user with a temporary random password
      const tempPassword = crypto.randomUUID();
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: employeeName,
        },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: createError.message }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      userId = newUser.user.id;
      console.log(`User created: ${userId}`);
    }

    // Update employee with user_id
    const { error: updateError } = await supabaseAdmin
      .from("employees")
      .update({ 
        user_id: userId,
        email: email,
        permission_profile_id: permissionProfileId || null,
      })
      .eq("id", employeeId);

    if (updateError) {
      console.error("Error updating employee:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Link user to company
    const { error: linkError } = await supabaseAdmin
      .from("user_companies")
      .upsert({
        user_id: userId,
        company_id: companyId,
        role: "employee",
      }, {
        onConflict: "user_id,company_id",
      });

    if (linkError) {
      console.error("Error linking user to company:", linkError);
    }

    // Send password reset email so user can set their own password
    const { error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      // Don't fail - user was created, they can use "forgot password" later
    }

    // Also trigger the standard password reset email
    const { error: emailError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (emailError) {
      console.error("Error sending reset email:", emailError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId,
        message: existingUser 
          ? "Usuário existente vinculado. Email de redefinição de senha enviado."
          : "Usuário criado. Email de redefinição de senha enviado."
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in create-employee-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
