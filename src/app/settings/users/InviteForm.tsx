"use client";

export default function InviteForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="flex gap-3">
      <input
        name="email"
        type="email"
        required
        placeholder="Email address"
        autoComplete="off"
        className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
      />
      <button
        type="submit"
        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shrink-0"
      >
        Send invite
      </button>
    </form>
  );
}
