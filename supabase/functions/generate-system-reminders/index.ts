import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Quote {
  id: string;
  quote_number: number;
  customer_name: string;
  total: number;
  company_id: string;
  valid_until: string;
}

interface AccountsReceivable {
  id: string;
  customer_name: string;
  total_amount: number;
  due_date: string;
  company_id: string;
  installment_number: number | null;
  total_installments: number | null;
}

interface NotificationSettings {
  company_id: string;
  notify_quote_expiring: boolean;
  notify_overdue_receivables: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Datas de referência
    const today = new Date();
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString().split('T')[0];

    const fifteenDaysAgo = new Date(today);
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    const fifteenDaysAgoStr = fifteenDaysAgo.toISOString().split('T')[0];

    // Buscar configurações de todas as empresas
    const { data: settings, error: settingsError } = await supabase
      .from('company_notification_settings')
      .select('company_id, notify_quote_expiring, notify_overdue_receivables');

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw settingsError;
    }

    // Criar map de configurações por empresa
    const settingsMap = new Map<string, NotificationSettings>();
    (settings || []).forEach((s: NotificationSettings) => {
      settingsMap.set(s.company_id, s);
    });

    let quoteRemindersCreated = 0;
    let overdueRemindersCreated = 0;

    // ============================================
    // PARTE 1: Orçamentos expirando em 3 dias
    // ============================================
    const { data: expiringQuotes, error: quotesError } = await supabase
      .from('quotes')
      .select('id, quote_number, customer_name, total, company_id, valid_until')
      .eq('status', 'pending')
      .eq('valid_until', threeDaysStr);

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
    } else if (expiringQuotes && expiringQuotes.length > 0) {
      for (const quote of expiringQuotes as Quote[]) {
        // Verificar se a empresa tem essa notificação ativada
        const companySettings = settingsMap.get(quote.company_id);
        if (companySettings && companySettings.notify_quote_expiring === false) {
          continue;
        }

        // Verificar se já existe lembrete para este orçamento
        const { data: existingReminder } = await supabase
          .from('system_reminders')
          .select('id')
          .eq('reference_id', quote.id)
          .eq('reminder_type', 'quote_expiring')
          .single();

        if (existingReminder) {
          continue; // Já existe lembrete
        }

        // Criar lembrete no system_reminders
        await supabase.from('system_reminders').insert({
          company_id: quote.company_id,
          reminder_type: 'quote_expiring',
          reference_id: quote.id,
          reference_table: 'quotes',
        });

        // Criar notificação interna
        const formattedTotal = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(quote.total || 0);

        await supabase.from('company_notifications').insert({
          company_id: quote.company_id,
          from_user_id: '00000000-0000-0000-0000-000000000000', // Sistema
          to_role: 'admin,gerente,vendedor',
          type: 'quote_expiring',
          title: `Orçamento #${quote.quote_number} expira em 3 dias`,
          message: `Cliente: ${quote.customer_name} - ${formattedTotal}`,
          metadata: {
            quote_id: quote.id,
            quote_number: quote.quote_number,
            customer_name: quote.customer_name,
            total: quote.total,
            valid_until: quote.valid_until,
          },
        });

        quoteRemindersCreated++;
      }
    }

    // ============================================
    // PARTE 2: Cobranças com mais de 15 dias de atraso
    // ============================================
    const { data: overdueReceivables, error: receivablesError } = await supabase
      .from('accounts_receivable')
      .select('id, customer_name, total_amount, due_date, company_id, installment_number, total_installments')
      .in('status', ['pending', 'overdue', 'partial'])
      .lte('due_date', fifteenDaysAgoStr);

    if (receivablesError) {
      console.error('Error fetching receivables:', receivablesError);
    } else if (overdueReceivables && overdueReceivables.length > 0) {
      for (const receivable of overdueReceivables as AccountsReceivable[]) {
        // Verificar se a empresa tem essa notificação ativada
        const companySettings = settingsMap.get(receivable.company_id);
        if (companySettings && companySettings.notify_overdue_receivables === false) {
          continue;
        }

        // Verificar se já existe lembrete para esta cobrança
        const { data: existingReminder } = await supabase
          .from('system_reminders')
          .select('id')
          .eq('reference_id', receivable.id)
          .eq('reminder_type', 'overdue_receivable')
          .single();

        if (existingReminder) {
          continue; // Já existe lembrete
        }

        // Calcular dias de atraso
        const dueDate = new Date(receivable.due_date);
        const diffTime = today.getTime() - dueDate.getTime();
        const daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        // Criar lembrete no system_reminders
        await supabase.from('system_reminders').insert({
          company_id: receivable.company_id,
          reminder_type: 'overdue_receivable',
          reference_id: receivable.id,
          reference_table: 'accounts_receivable',
        });

        // Criar notificação interna
        const formattedAmount = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(receivable.total_amount || 0);

        const installmentInfo = receivable.installment_number && receivable.total_installments
          ? ` - Parcela ${receivable.installment_number}/${receivable.total_installments}`
          : '';

        await supabase.from('company_notifications').insert({
          company_id: receivable.company_id,
          from_user_id: '00000000-0000-0000-0000-000000000000', // Sistema
          to_role: 'admin,gerente,vendedor',
          type: 'overdue_receivable',
          title: `Cobrança atrasada há ${daysOverdue} dias`,
          message: `${receivable.customer_name}${installmentInfo} - ${formattedAmount}`,
          metadata: {
            receivable_id: receivable.id,
            customer_name: receivable.customer_name,
            total_amount: receivable.total_amount,
            due_date: receivable.due_date,
            days_overdue: daysOverdue,
            installment_number: receivable.installment_number,
            total_installments: receivable.total_installments,
          },
        });

        overdueRemindersCreated++;
      }
    }

    console.log(`Reminders created - Quotes: ${quoteRemindersCreated}, Overdue: ${overdueRemindersCreated}`);

    return new Response(
      JSON.stringify({
        success: true,
        quote_reminders_created: quoteRemindersCreated,
        overdue_reminders_created: overdueRemindersCreated,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in generate-system-reminders:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
