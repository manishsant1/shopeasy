export default function Rating({ value }) {
  const full = Math.round(value);
  return (
    <span className="rating" title={`${value} out of 5`}>
      {'★'.repeat(full)}{'☆'.repeat(5 - full)} <span className="muted small">{value.toFixed(1)}</span>
    </span>
  );
}
