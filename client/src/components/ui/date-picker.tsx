import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { formatDate, parseDDMMYYYY } from "@/lib/dateUtils";
import "react-day-picker/dist/style.css";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  "data-testid"?: string;
}

export function DatePicker({ value, onChange, placeholder = "DD/MM/YYYY", id, "data-testid": dataTestId }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  
  // Parse the current value to a Date object (convert null to undefined)
  const selectedDate = value ? parseDDMMYYYY(value) || undefined : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(formatDate(date));
      setOpen(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          className="w-full pl-10"
          data-testid={dataTestId}
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute left-0 top-0 h-full w-10 cursor-pointer"
            style={{ background: 'transparent', border: 'none' }}
            aria-label="Open calendar"
          />
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
          className="p-3"
        />
      </PopoverContent>
    </Popover>
  );
}
