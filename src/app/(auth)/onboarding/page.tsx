import { Metadata } from "next";
import OnboardingForm from "@/components/auth/onboarding-form";

export const metadata: Metadata = {
  title: "Get Started — Inklabs Shop Dashboard",
};

export default function OnboardingPage() {
  return <OnboardingForm />;
}
