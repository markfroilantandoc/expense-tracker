export function StatusBanner({ tone, title, message }: { tone: 'info' | 'error'; title: string; message: string }) {
  return (
    <section className={`status-banner status-banner-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      <span>{message}</span>
    </section>
  );
}
