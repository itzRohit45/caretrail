import type { Metadata } from "next";
import { DoctorView } from "@/components/doctor/doctor-view";

export const metadata: Metadata = { title: "Shared records", referrer: "no-referrer" };

export default function SharedRecordsPage() {
  return <DoctorView />;
}
