import type { Metadata, Viewport } from "next";
import { EmergencyView } from "@/components/emergency/emergency-view";

export const metadata: Metadata = { title: "Emergency medical information", referrer: "no-referrer" };
export const viewport: Viewport = { themeColor: "#0b0c0e" };

export default function EmergencyPage() {
  return <EmergencyView />;
}
