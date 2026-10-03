export function SunMoon() {
  return (
    <div className="relative mx-auto h-[340px] w-full max-w-[520px]">
      <div className="absolute left-[18%] top-[42%] h-40 w-40 rounded-full bg-[#b79aeb]" />
      <div className="absolute left-[31%] top-[42%] h-40 w-40 rounded-full bg-[#fbf7f1]" />
      <div className="absolute left-[46%] top-[18%] h-48 w-48 rounded-full bg-[#f6d35c]" />
      <span className="absolute right-[8%] top-[8%] h-3 w-3 rotate-45 bg-[#f6d35c]" />
      <span className="absolute right-[18%] top-[2%] h-2 w-2 rotate-45 bg-[#f6d35c]" />
      <span className="absolute right-[2%] top-[22%] h-2 w-2 rotate-45 bg-[#f6d35c]" />
    </div>
  );
}
