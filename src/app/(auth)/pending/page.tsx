import { Metadata } from "next";
import PendingApproval from "@/components/auth/pending-approval";

export const metadata: Metadata = {
  title: "Awaiting Approval — Inklabs Shop Dashboard",
};

export default function PendingPage() {
  return <PendingApproval />;
}
