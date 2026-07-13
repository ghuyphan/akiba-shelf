type PlatformMarkProps = { className?: string };

export function PlatformMark({ className }: PlatformMarkProps) {
  return <img src={`${import.meta.env.BASE_URL}brand/matsuri-mark.svg`} alt="" className={className} />;
}
