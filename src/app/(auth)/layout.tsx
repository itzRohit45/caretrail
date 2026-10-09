import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <Link href="/" className="self-start rounded-control">
        <Wordmark />
      </Link>
      <main className="mt-10 flex-1">{children}</main>
    </div>
  );
}
