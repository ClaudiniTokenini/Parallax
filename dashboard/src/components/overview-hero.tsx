import { SunMoon } from "./sun-moon";

type Metric = {
  label: string;
  value: string;
  detail: string;
};

export function OverviewHero({
  blocked,
  revealed,
  recovery,
  activity
}: {
  blocked: Metric;
  revealed: Metric;
  recovery: Metric;
  activity: Metric;
}) {
  return (
    <div className="relative mx-auto mt-2 w-full max-w-6xl">
      <div className="relative z-10 grid items-center gap-6 py-6 md:grid-cols-[minmax(160px,1fr)_minmax(280px,1.6fr)_minmax(160px,1fr)] md:gap-0 md:py-8">
        <div className="flex h-full min-h-[280px] flex-col justify-between py-6 md:min-h-[420px] md:py-10">
          <MetricCard metric={blocked} />
          <MetricCard metric={revealed} />
        </div>
        <SunMoon className="relative z-0 mx-auto w-[min(640px,100%)]" />
        <div className="flex h-full min-h-[280px] flex-col justify-between py-6 md:min-h-[420px] md:py-10 md:text-right">
          <MetricCard metric={recovery} align="right" />
          <MetricCard metric={activity} align="right" />
        </div>
      </div>

      <svg
        className="pointer-events-none absolute inset-0 z-20 hidden h-full w-full overflow-visible md:block"
        viewBox="0 0 1200 560"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M268 118 H 455" stroke="#A171BB" strokeWidth="1.75" />
        <path d="M268 118 V 168" stroke="#A171BB" strokeWidth="1.75" />
        <path d="M268 400 H 430" stroke="#A171BB" strokeWidth="1.75" />
        <path d="M268 400 V 450" stroke="#A171BB" strokeWidth="1.75" />
        <path d="M932 118 H 760" stroke="#F3E074" strokeWidth="1.75" />
        <path d="M932 118 V 168" stroke="#F3E074" strokeWidth="1.75" />
        <path d="M932 400 H 790" stroke="#F3E074" strokeWidth="1.75" />
        <path d="M932 400 V 450" stroke="#F3E074" strokeWidth="1.75" />
      </svg>
    </div>
  );
}

function MetricCard({
  metric,
  align = "left"
}: {
  metric: Metric;
  align?: "left" | "right";
}) {
  return (
    <div className={`relative z-30 ${align === "right" ? "md:ml-auto md:text-right" : ""}`}>
      <p className="text-[11px] tracking-[0.18em] text-[#7a746b]">{metric.label}</p>
      <p className="serif mt-2 text-4xl leading-none md:text-5xl">{metric.value}</p>
      <p className="mt-2 max-w-[230px] text-sm text-[#7a746b] md:inline-block">{metric.detail}</p>
    </div>
  );
}
