interface AuthAlertProps {
  type: 'error' | 'success' | 'info';
  message: string;
}

const styles = {
  error: 'border-danger/20 bg-danger/10 text-danger',
  success: 'border-success/20 bg-success/10 text-success',
  info: 'border-primary/20 bg-primary/10 text-primary',
};

export function AuthAlert({ type, message }: AuthAlertProps) {
  return <div className={`rounded-lg border p-3 text-sm ${styles[type]}`}>{message}</div>;
}
