import { LandingNavbar } from "@/components/landing/navbar";
import {
  CtaSection,
  FeaturesSection,
  HeroSection,
  LandingFooter,
} from "@/components/landing/sections";

export default function HomePage() {
  return (
    <main>
      <LandingNavbar />
      <HeroSection />
      <FeaturesSection />
      <CtaSection />
      <LandingFooter />
    </main>
  );
}
