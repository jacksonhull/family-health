import { redirect } from "next/navigation";
import { auth, unstable_update } from "@/src/auth";
import { db } from "@/src/lib/db";
import { verifyPassword, hashPassword } from "@/src/lib/password";
import NameForm from "./NameForm";
import PasswordForm from "./PasswordForm";

const PASSWORD_ERRORS: Record<string, string> = {
  invalid: "Current password is incorrect.",
  mismatch: "New passwords do not match.",
  tooshort: "New password must be at least 8 characters.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { error, success } = await searchParams;

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  async function changeName(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const name = (formData.get("name") as string).trim() || null;

    await db.user.update({
      where: { id: session.user.id },
      data: { name },
    });

    // Update the JWT immediately so the header reflects the change
    await unstable_update({ user: { name: name ?? session.user.name } });

    redirect("/settings/account?success=name");
  }

  async function changePassword(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (newPassword !== confirmPassword)
      redirect("/settings/account?error=mismatch");
    if (newPassword.length < 8) redirect("/settings/account?error=tooshort");

    const user = await db.user.findUnique({ where: { id: session.user.id } });
    if (!user) redirect("/login");

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) redirect("/settings/account?error=invalid");

    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    redirect("/settings/account?success=password");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Account</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage your profile and password.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {success === "name" && (
          <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Name updated.
          </p>
        )}
        <NameForm action={changeName} currentName={user.name ?? ""} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {PASSWORD_ERRORS[error] ?? "Something went wrong."}
          </p>
        )}
        {success === "password" && (
          <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Password updated successfully.
          </p>
        )}
        <PasswordForm action={changePassword} />
      </div>
    </div>
  );
}
