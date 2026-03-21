import { Metadata } from "next";
import ShopSelector from "@/components/auth/shop-selector";

export const metadata: Metadata = {
  title: "Select Shop — Inklabs Shop Dashboard",
};

export default function SelectShopPage() {
  return <ShopSelector />;
}
