import { redirect } from "next/navigation";

/** There is no dashboard yet, so the product opens on the only vertical there is. */
export default function HomePage(): never {
  redirect("/alunos");
}
