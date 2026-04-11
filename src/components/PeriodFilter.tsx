import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  from: Date | undefined;
  to: Date | undefined;
  onFromChange: (d: Date | undefined) => void;
  onToChange: (d: Date | undefined) => void;
  onReset: () => void;
}

const PeriodFilter: React.FC<Props> = ({ from, to, onFromChange, onToChange, onReset }) => {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      <span className="text-sm text-muted-foreground font-medium">Período:</span>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">De:</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("w-[140px] justify-start text-left text-xs font-normal", !from && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {from ? format(from, "MMM/yyyy", { locale: ptBR }) : "Início"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={from}
              onSelect={onFromChange}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Até:</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("w-[140px] justify-start text-left text-xs font-normal", !to && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              {to ? format(to, "MMM/yyyy", { locale: ptBR }) : "Fim"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={to}
              onSelect={onToChange}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Button variant="ghost" size="sm" onClick={onReset} className="text-xs">
        <RotateCcw className="mr-1 h-3.5 w-3.5" /> Resetar
      </Button>
    </div>
  );
};

export default PeriodFilter;
