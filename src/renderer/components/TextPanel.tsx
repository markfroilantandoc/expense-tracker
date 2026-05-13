export function TextPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="text-panel">
      <h3>{title}</h3>
      <pre>{text}</pre>
    </div>
  );
}
