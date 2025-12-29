type AnnouncementBarProps = {
  accent?: boolean;
};

export function AnnouncementBar({ accent = true }: AnnouncementBarProps) {
  return (
    <div
      data-testid="announcement-bar"
      className={`border-b border-neutral-200 bg-neutral-50 ${accent ? "border-t-2 border-t-red-700" : ""}`}
    >
      <div className="mx-auto w-full max-w-7xl 2xl:max-w-[1440px] px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-center py-2 text-sm text-neutral-800">
          <span className="font-semibold text-neutral-900">Opening Spring 2026</span>
          <span className="mx-2 text-neutral-400">-</span>
          <span>Full catalogue launching soon.</span>
        </div>
      </div>
    </div>
  );
}

