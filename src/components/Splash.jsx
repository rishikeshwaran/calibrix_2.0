export default function Splash({ message = 'Loading…' }) {
  return (
    <div className="splash">
      <div className="spinner-border" role="status" />
      <div>{message}</div>
    </div>
  );
}
