import { cn } from "./cn";

/* =============================================================
   Form primitives. <Field> = label + input wrapper, <Input>,
   <Select>, <Textarea> = styled raw elements.
   These are server-component-friendly: no useState anywhere.
   ============================================================= */

const inputBase =
  "w-full bg-white text-ink-900 placeholder:text-ink-400 " +
  "rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm " +
  "transition-shadow hover:border-ink-300 disabled:opacity-60 disabled:bg-ink-50";

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[12px] font-medium text-ink-700">
        {label}
        {required && <span className="text-brand-600 ml-0.5">*</span>}
      </span>
      {children}
      {hint && !error && (
        <span className="text-[11.5px] text-ink-500">{hint}</span>
      )}
      {error && (
        <span className="text-[11.5px] text-rose-600">{error}</span>
      )}
    </label>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
export function Input({ className, ...rest }: InputProps) {
  return <input className={cn(inputBase, className)} {...rest} />;
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;
export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <select className={cn(inputBase, "pr-8 appearance-none cursor-pointer", className)} {...rest}>
      {children}
    </select>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
export function Textarea({ className, rows = 3, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(inputBase, "resize-y min-h-[88px] leading-relaxed", className)}
      {...rest}
    />
  );
}
