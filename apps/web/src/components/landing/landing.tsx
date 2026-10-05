import { LandingCta } from "./landing-cta";
import { LandingFeatures } from "./landing-features";
import { LandingFooter } from "./landing-footer";
import { LandingHero } from "./landing-hero";
import { LandingHow } from "./landing-how";
import { LandingNav } from "./landing-nav";
import { LandingSelfHost } from "./landing-self-host";

/** What Uniloom is. The proxy shows it at `/` to signed-out visitors. */
export const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingFeatures />
        <LandingHow />
        <LandingSelfHost />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
};
