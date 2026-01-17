import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  email: string;
  token: string;
  companyName: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, token, companyName }: InviteEmailRequest = await req.json();

    if (!email || !token || !companyName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get the origin from request headers or use a default
    const origin = req.headers.get("origin") || "https://vetraglass.lovable.app";
    const inviteUrl = `${origin}/aceitar-convite?token=${token}`;

    console.log(`Sending invite email to ${email} for company ${companyName}`);
    console.log(`Invite URL: ${inviteUrl}`);

    // For now, we'll just log the invite since RESEND_API_KEY is not configured
    // When the key is added, uncomment the email sending code below
    
    /*
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey) {
      const { Resend } = await import("npm:resend@2.0.0");
      const resend = new Resend(resendApiKey);
      
      const emailResponse = await resend.emails.send({
        from: `${companyName} <onboarding@resend.dev>`,
        to: [email],
        subject: `Você foi convidado para o sistema ${companyName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Você foi convidado!</h1>
              </div>
              <div class="content">
                <p>Olá!</p>
                <p>Você foi convidado para fazer parte do sistema da empresa <strong>${companyName}</strong>.</p>
                <p>Clique no botão abaixo para criar sua conta e começar a usar o sistema:</p>
                <p style="text-align: center;">
                  <a href="${inviteUrl}" class="button">Aceitar Convite</a>
                </p>
                <p><strong>Este convite expira em 7 dias.</strong></p>
                <p>Se você não esperava receber este convite, pode ignorar este email.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} ${companyName}. Todos os direitos reservados.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      console.log("Email sent successfully:", emailResponse);
      
      return new Response(JSON.stringify({ success: true, emailResponse }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    */

    // Return success with invite URL for manual sharing
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Convite criado. Email não enviado (API key não configurada).",
        inviteUrl 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in send-employee-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
