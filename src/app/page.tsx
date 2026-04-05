import { redirect } from "next/navigation";
import { auth } from "@/src/auth";

export default async function RootPage() {
  const session = await auth();
  if (session) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
