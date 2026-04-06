"use client";

import { useState } from "react";
import type { Role, UserStatus } from "@prisma/client";
import { TIMEZONE_GROUPS } from "@/src/lib/timezones";

export type MemberRow = {
  id: string;
  email: string | null;
  name: string | null;
  dateOfBirth: string | null;
  timezone: string;
  role: Role;
  status: UserStatus;
  hasPassword: boolean;
  pendingInvite: { id: string; expiresAt: string } | null;
};

const STATUS_BADGE: Record<UserStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  DISABLED: "bg-gray-100 text-gray-500",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Convert an ISO string to the YYYY-MM-DD value a <input type="date"> expects */
function toDateInputValue(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function InviteCell({
  member,
  inviteAction,
}: {
  member: MemberRow;
  inviteAction: (formData: FormData) => Promise<void>;
}) {
  if (member.hasPassword) {
    return <span className="text-xs text-gray-400">Account active</span>;
  }
  if (!member.email) {
    return <span className="text-xs text-gray-400">No email</span>;
  }
  if (member.pendingInvite) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
          Invited
        </span>
        <form action={inviteAction}>
          <input type="hidden" name="userId" value={member.id} />
          <button
            type="submit"
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Resend
          </button>
        </form>
      </div>
    );
  }
  return (
    <form action={inviteAction}>
      <input type="hidden" name="userId" value={member.id} />
      <button
        type="submit"
        className="text-xs text-blue-600 hover:text-blue-700 underline"
      >
        Invite
      </button>
    </form>
  );
}

function EditModal({
  member,
  updateAction,
  onClose,
}: {
  member: MemberRow;
  updateAction: (formData: FormData) => Promise<void>;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-sm mx-4 p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-5">
          Edit member
        </h3>
        <form action={updateAction} className="space-y-4">
          <input type="hidden" name="userId" value={member.id} />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              defaultValue={member.name ?? ""}
              required
              className="block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date of birth <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="dateOfBirth"
              defaultValue={toDateInputValue(member.dateOfBirth)}
              required
              className="block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email address{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="email"
              name="email"
              defaultValue={member.email ?? ""}
              className="block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <select
              name="timezone"
              defaultValue={member.timezone}
              className="block w-full rounded-lg border-gray-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {TIMEZONE_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.zones.map((z) => (
                    <option key={z.value} value={z.value}>
                      {z.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UserTable({
  members,
  currentUserId,
  inviteAction,
  updateAction,
  disableAction,
  enableAction,
  deleteAction,
}: {
  members: MemberRow[];
  currentUserId: string;
  inviteAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  disableAction: (formData: FormData) => Promise<void>;
  enableAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState<MemberRow | null>(null);

  if (members.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No family members yet.
      </p>
    );
  }

  return (
    <>
      {editing && (
        <EditModal
          member={editing}
          updateAction={updateAction}
          onClose={() => setEditing(null)}
        />
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date of birth
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Access
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((member) => {
              const isSelf = member.id === currentUserId;
              return (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800">
                      {member.name ?? "—"}
                      {member.role === "ADMINISTRATOR" && (
                        <span className="ml-2 text-xs text-gray-400">
                          (admin)
                        </span>
                      )}
                    </p>
                    {member.email && (
                      <p className="text-xs text-gray-400">{member.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(member.dateOfBirth)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[member.status]}`}
                    >
                      {member.status === "ACTIVE" ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <InviteCell member={member} inviteAction={inviteAction} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditing(member)}
                        className="text-xs text-blue-600 hover:text-blue-700 underline"
                      >
                        Edit
                      </button>
                      {!isSelf && (
                        <>
                          {member.status === "ACTIVE" ? (
                            <form action={disableAction}>
                              <input
                                type="hidden"
                                name="userId"
                                value={member.id}
                              />
                              <button
                                type="submit"
                                className="text-xs text-gray-500 hover:text-gray-700 underline"
                              >
                                Disable
                              </button>
                            </form>
                          ) : (
                            <form action={enableAction}>
                              <input
                                type="hidden"
                                name="userId"
                                value={member.id}
                              />
                              <button
                                type="submit"
                                className="text-xs text-blue-600 hover:text-blue-700 underline"
                              >
                                Enable
                              </button>
                            </form>
                          )}
                          <form
                            action={deleteAction}
                            onSubmit={(e) => {
                              if (
                                !confirm(
                                  `Delete ${member.name ?? "this member"}? This cannot be undone.`,
                                )
                              ) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <input
                              type="hidden"
                              name="userId"
                              value={member.id}
                            />
                            <button
                              type="submit"
                              className="text-xs text-red-500 hover:text-red-700 underline"
                            >
                              Delete
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
