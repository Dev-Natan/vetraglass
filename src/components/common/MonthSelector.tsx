import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MonthSelectorProps {
  selectedDate: Date;
  onMonthChange: (date: Date) => void;
  minDate?: Date;
  className?: string;
}

export function MonthSelector({ selectedDate, onMonthChange, minDate, className }: MonthSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());

  const now = new Date();
  const isCurrentMonth = isSameMonth(selectedDate, now);

  const handlePreviousMonth = () => {
    const newDate = subMonths(selectedDate, 1);
    if (!minDate || newDate >= startOfMonth(minDate)) {
      onMonthChange(newDate);
    }
  };

  const handleNextMonth = () => {
    const newDate = addMonths(selectedDate, 1);
    if (newDate <= endOfMonth(now)) {
      onMonthChange(newDate);
    }
  };

  const handleMonthSelect = (month: number) => {
    const newDate = new Date(viewYear, month, 1);
    if (newDate <= endOfMonth(now) && (!minDate || newDate >= startOfMonth(minDate))) {
      onMonthChange(newDate);
      setIsOpen(false);
    }
  };

  const handleGoToCurrentMonth = () => {
    onMonthChange(now);
    setViewYear(now.getFullYear());
  };

  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];

  const canGoNext = addMonths(selectedDate, 1) <= endOfMonth(now);
  const canGoPrev = !minDate || subMonths(selectedDate, 1) >= startOfMonth(minDate);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={handlePreviousMonth}
        disabled={!canGoPrev}
        className="h-9 w-9"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="min-w-[160px] justify-center gap-2 font-medium"
          >
            <Calendar className="h-4 w-4" />
            {format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-4" align="center">
          <div className="space-y-4">
            {/* Year selector */}
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setViewYear(viewYear - 1)}
                disabled={minDate && viewYear <= minDate.getFullYear()}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-semibold text-lg">{viewYear}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setViewYear(viewYear + 1)}
                disabled={viewYear >= now.getFullYear()}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Month grid */}
            <div className="grid grid-cols-3 gap-2">
              {months.map((monthName, index) => {
                const monthDate = new Date(viewYear, index, 1);
                const isSelected = isSameMonth(monthDate, selectedDate);
                const isFuture = monthDate > endOfMonth(now);
                const isBeforeMin = minDate && monthDate < startOfMonth(minDate);
                const isDisabled = isFuture || isBeforeMin;

                return (
                  <Button
                    key={monthName}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-9",
                      isDisabled && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() => !isDisabled && handleMonthSelect(index)}
                    disabled={isDisabled}
                  >
                    {monthName}
                  </Button>
                );
              })}
            </div>

            {/* Go to current month button */}
            {!isCurrentMonth && (
              <Button 
                variant="secondary" 
                className="w-full" 
                onClick={handleGoToCurrentMonth}
              >
                Ir para mês atual
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="icon"
        onClick={handleNextMonth}
        disabled={!canGoNext}
        className="h-9 w-9"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isCurrentMonth && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGoToCurrentMonth}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Mês atual
        </Button>
      )}
    </div>
  );
}

// Helper function to get month date range
export function getMonthDateRange(date: Date): { start: Date; end: Date } {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date)
  };
}
