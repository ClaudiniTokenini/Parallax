export function SunMoon({ className = "" }: { className?: string }) {
  return (
    <img
      src="/assets/sun_and_moon.svg"
      alt=""
      className={`pointer-events-none select-none ${className}`}
    />
  );
}
