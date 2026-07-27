// Edge Function: generate-salary-expenses
// Executa diariamente. Para cada funcionário ativo com salário e dia de pagamento,
// garante idempotentemente uma despesa em `expenses` referente ao mês corrente.
// Nunca é chamada pelo frontend (verify_jwt = false, disparada por cron pg_net).

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function computeDueDate(year: number, monthIndex0: number, paymentDay: number): Date {
  const day = Math.max(1, Math.min(31, Math.floor(paymentDay || 5)));
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  return new Date(year, monthIndex0, Math.min(day, lastDay));
}

function toISODate(d: Date) {
  return d.toISOString().split('T')[0];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Require service-role bearer token (cron-only endpoint, not public)
  const authHeader = req.headers.get('Authorization') ?? '';
  const expected = `Bearer ${serviceRoleKey}`;
  if (!serviceRoleKey || authHeader !== expected) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey,
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();
    const month = today.getMonth();

    const { data: employees, error: empErr } = await supabase
      .from('employees')
      .select('id, company_id, name, hourly_rate, salary_payment_day, admission_date, is_active')
      .eq('is_active', true)
      .gt('hourly_rate', 0)
      .not('salary_payment_day', 'is', null);

    if (empErr) throw empErr;

    let created = 0;
    let skipped = 0;

    for (const emp of employees ?? []) {
      // Se admissão for futura, pula
      if (emp.admission_date) {
        const adm = new Date(emp.admission_date);
        adm.setHours(0, 0, 0, 0);
        if (adm > today) {
          skipped++;
          continue;
        }
      }

      const dueDate = computeDueDate(year, month, emp.salary_payment_day);
      const monthStart = toISODate(new Date(year, month, 1));
      const monthEnd = toISODate(new Date(year, month + 1, 0));

      const { data: existing } = await supabase
        .from('expenses')
        .select('id')
        .eq('company_id', emp.company_id)
        .eq('employee_id', emp.id)
        .eq('category', 'funcionarios')
        .gte('due_date', monthStart)
        .lte('due_date', monthEnd)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error: insErr } = await supabase.from('expenses').insert({
        company_id: emp.company_id,
        category: 'funcionarios',
        description: `Salário - ${emp.name}`,
        amount: emp.hourly_rate,
        due_date: toISODate(dueDate),
        status: 'pending',
        recurrence: 'monthly',
        recurrence_day: emp.salary_payment_day,
        is_auto_generated: true,
        employee_id: emp.id,
        notes: 'Despesa gerada automaticamente pelo agendador diário de salários',
      });

      if (insErr) {
        console.error('Falha ao gerar despesa para funcionário', emp.id, insErr);
        continue;
      }
      created++;
    }

    return new Response(
      JSON.stringify({ ok: true, processed: employees?.length ?? 0, created, skipped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('generate-salary-expenses error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
