import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, differenceInMinutes, parse, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const REMINDER_MINUTES_BEFORE = 15;
const CHECK_INTERVAL_MS = 60000; // Check every minute

interface TaskAppointment {
  id: string;
  title: string | null;
  customer_name: string | null;
  appointment_type: string;
  scheduled_date: string;
  scheduled_time_start: string | null;
  status: string;
}

export function useTaskReminders() {
  const { currentCompany } = useAuth();
  const notifiedTasksRef = useRef<Set<string>>(new Set());

  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: appointments = [] } = useQuery({
    queryKey: ['task-reminders', currentCompany?.id, today],
    queryFn: async () => {
      if (!currentCompany?.id) return [];

      const { data, error } = await supabase
        .from('service_appointments')
        .select('id, title, customer_name, appointment_type, scheduled_date, scheduled_time_start, status')
        .eq('company_id', currentCompany.id)
        .eq('scheduled_date', today)
        .neq('status', 'cancelled')
        .neq('status', 'completed')
        .not('scheduled_time_start', 'is', null)
        .order('scheduled_time_start', { ascending: true });

      if (error) throw error;
      return (data || []) as TaskAppointment[];
    },
    enabled: !!currentCompany?.id,
    staleTime: 30000,
    refetchInterval: CHECK_INTERVAL_MS,
  });

  useEffect(() => {
    if (appointments.length === 0) return;

    const checkReminders = () => {
      const now = new Date();

      appointments.forEach((apt) => {
        if (!apt.scheduled_time_start || notifiedTasksRef.current.has(apt.id)) {
          return;
        }

        try {
          // Parse the scheduled time for today
          const scheduledTime = parse(
            apt.scheduled_time_start,
            'HH:mm:ss',
            new Date()
          );

          const minutesUntil = differenceInMinutes(scheduledTime, now);

          // Notify if task is between 0 and 15 minutes away
          if (minutesUntil > 0 && minutesUntil <= REMINDER_MINUTES_BEFORE) {
            notifiedTasksRef.current.add(apt.id);

            const typeLabel = getTypeLabel(apt.appointment_type);
            const title = apt.title || apt.customer_name || 'Agendamento';
            const timeStr = format(scheduledTime, 'HH:mm');

            toast.info(`${typeLabel} em ${minutesUntil} minutos`, {
              description: `${title} às ${timeStr}`,
              duration: 10000,
              action: {
                label: 'Ver',
                onClick: () => {
                  window.location.href = '/agenda';
                },
              },
            });
          }
        } catch (error) {
          console.error('Error parsing appointment time:', error);
        }
      });
    };

    // Check immediately
    checkReminders();

    // Set up interval to check periodically
    const interval = setInterval(checkReminders, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [appointments]);

  // Reset notified tasks at midnight
  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        notifiedTasksRef.current.clear();
      }
    };

    const interval = setInterval(checkMidnight, 60000);
    return () => clearInterval(interval);
  }, []);
}

function getTypeLabel(appointmentType: string): string {
  switch (appointmentType) {
    case 'delivery':
      return '🚚 Entrega';
    case 'measurement':
      return '📐 Medição';
    case 'installation':
      return '🔧 Instalação';
    case 'visit':
      return '👤 Visita';
    default:
      return '📅 Agendamento';
  }
}
