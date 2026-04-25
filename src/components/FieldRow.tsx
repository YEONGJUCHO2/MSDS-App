interface FieldRowProps {
  label: string;
  value: string;
  evidence?: string;
}

export function FieldRow({ label, value, evidence }: FieldRowProps) {
  return (
    <div className="field-row">
      <div>
        <strong>{label}</strong>
        {evidence ? <span>{evidence}</span> : null}
      </div>
      <code>{value || "확인필요"}</code>
    </div>
  );
}
