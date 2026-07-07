import { BadgeCheck, Clock, Sparkles, Star } from "lucide-react";
import type { BoothSettings } from "../../types/catalog";

type HeroProps = {
  booth: BoothSettings;
};

export function Hero({ booth }: HeroProps) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">
          <Sparkles size={20} />
          <span>Welcome</span>
        </div>
        <h2>{booth.hero_title}</h2>
        <p>{booth.hero_text}</p>
      </div>
      <div className="hero-tags" aria-label="Booth checkout steps">
        <span>
          <Star size={16} />
          Official festival drop
        </span>
        <span>
          <Clock size={16} />
          Limited stock
        </span>
        <span>
          <BadgeCheck size={16} />
          Fast & easy checkout
        </span>
      </div>
    </section>
  );
}
