import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { patientForRequest } from "@/lib/auth";

const idSchema = z.uuid();

/** Loads a document the logged-in patient owns (RLS enforces ownership), or null. */
export async function ownedDocument(rawId: string) {
  const session = await patientForRequest();
  if (!session) return { session: null, doc: null } as const;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return { session, doc: null } as const;
  const { data: doc } = await session.supabase.from("documents").select("*").eq("id", id.data).maybeSingle();
  return { session, doc } as const;
}

export const sha256Hex = (data: Buffer) => createHash("sha256").update(data).digest("hex");
