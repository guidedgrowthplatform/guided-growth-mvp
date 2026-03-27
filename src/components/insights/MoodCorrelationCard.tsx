const legendItems = [
  { label: 'Sleep', color: 'bg-primary' },
  { label: 'Energy', color: 'bg-[#f38601]' },
  { label: 'Stress', color: 'bg-[#8a38f5]' },
  { label: 'Mood', color: 'bg-[#94a3b8]' },
];

export function MoodCorrelationCard() {
  return (
    <div className="rounded-lg bg-surface p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex items-start justify-between">
        <h3 className="text-[16px] font-bold leading-6 text-content">Mood Correlation</h3>
        <span className="rounded-[6px] bg-primary/5 px-2 py-1 text-[12px] font-bold leading-4 text-primary">
          High Correlation
        </span>
      </div>
      <div className="flex flex-col gap-6 rounded-lg border border-border-light bg-surface p-[25px] shadow-sm">
        <div className="flex gap-4">
          {legendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${item.color}`} />
              <span className="text-[12px] font-semibold leading-4 text-content-secondary">
                {item.label}
              </span>
            </div>
          ))}
        </div>
        <div className="h-[128px]">
          <svg width="100%" height="100%" viewBox="0 0 300 128" preserveAspectRatio="none">
            <path
              d="M0,90 C50,70 100,40 150,55 C200,70 250,30 300,20"
              fill="none"
              stroke="#135bec"
              strokeWidth="2"
            />
            <path
              d="M0,60 C50,80 100,60 150,45 C200,30 250,50 300,35"
              fill="none"
              stroke="#f38601"
              strokeWidth="2"
              strokeDasharray="6 4"
            />
            <path
              d="M0,40 C50,55 100,80 150,70 C200,60 250,85 300,75"
              fill="none"
              stroke="#8a38f5"
              strokeWidth="1.5"
              strokeDasharray="2 3"
            />
            <path
              d="M0,70 C50,50 100,55 150,35 C200,45 250,40 300,50"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.5"
              strokeDasharray="2 3"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
