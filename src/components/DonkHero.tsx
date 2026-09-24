export function DonkHero() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-dusk-pink/30 bg-[radial-gradient(circle_at_20%_10%,rgba(255,79,155,.18),transparent_28%),radial-gradient(circle_at_80%_80%,rgba(97,232,255,.12),transparent_30%),#101a2b] p-8 shadow-dusk">
      <div className="eyebrow">Special Projects Division</div>
      <div className="-rotate-2 text-[clamp(3.3rem,9vw,7rem)] font-black leading-[.8] tracking-[-.07em] [text-shadow:6px_6px_0_#3a1431]">
        <span className="text-dusk-pink">DONK</span><br /><span className="text-dusk-aqua">TOSS</span>
      </div>
      <p className="mt-5 font-bold text-slate-200">Competitive ass-throwing technology • Engineered by Dusk Industries™</p>
      <div className="absolute right-8 top-8 size-28 rotate-12 rounded-full border-[9px] border-dusk-gold shadow-[0_0_0_8px_rgba(255,79,155,.22),inset_0_0_0_10px_rgba(97,232,255,.15)]" />
    </div>
  );
}
