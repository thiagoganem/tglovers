import { redirect } from "next/navigation";
import { DEFAULT_MODULE } from "@/lib/modules";

/** A raiz sempre abre a primeira aba do dashboard. */
export default function Root() {
  redirect(DEFAULT_MODULE.href);
}
