"use client";

export default function NameForm({
  action,
  currentName,
}: {
  action: (formData: FormData) => Promise<void>;
  currentName: string;
}) {
  return (
    <form action={action} className="flex gap-3 items-end">
      <div className="flex-1">
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Display name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={currentName}
          placeholder="Your name"
          autoComplete="name"
          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
      </div>
      <button
        type="submit"
        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
      >
        Save
      </button>
    </form>
  );
}
