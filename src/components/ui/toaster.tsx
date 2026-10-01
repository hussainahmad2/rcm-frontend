import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

function ToastIcon({ variant }: { variant?: string | null }) {
  const className = 'mt-0.5 h-4 w-4 shrink-0';
  switch (variant) {
    case 'success':
      return <CheckCircle2 className={`${className} text-emerald-600`} aria-hidden />;
    case 'info':
      return <Info className={`${className} text-sky-600`} aria-hidden />;
    case 'warning':
      return <AlertTriangle className={`${className} text-amber-600`} aria-hidden />;
    case 'destructive':
      return <XCircle className={`${className} text-red-600`} aria-hidden />;
    default:
      return <Info className={`${className} text-slate-500`} aria-hidden />;
  }
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider swipeDirection="right" duration={5200}>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <ToastIcon variant={variant} />
            <div className="grid min-w-0 flex-1 gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
