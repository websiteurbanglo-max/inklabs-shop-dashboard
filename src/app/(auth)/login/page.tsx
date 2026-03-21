import { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign In — Inklabs Shop Dashboard",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
