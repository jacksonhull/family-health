"use client";

import type { Role, UserStatus } from "@prisma/client";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  status: UserStatus;
  createdAt: string;
};

type InviteRow = {
  id: string;
  email: string;
  expiresAt: string;
};

const STATUS_BADGE: Record<UserStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  DISABLED: "bg-gray-100 text-gray-500",
};

export default function UserTable({
  users,
  invites,
  currentUserId,
  disableAction,
  enableAction,
  deleteAction,
  revokeInviteAction,
}: {
  users: UserRow[];
  invites: InviteRow[];
  currentUserId: string;
  disableAction: (formData: FormData) => Promise<void>;
  enableAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  revokeInviteAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      {/* Active users */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800">
                      {user.name ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400">{user.email}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                    {user.role === "ADMINISTRATOR" ? "Admin" : "User"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[user.status]}`}
                    >
                      {user.status === "ACTIVE" ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!isSelf && (
                      <div className="flex justify-end gap-2">
                        {user.status === "ACTIVE" ? (
                          <form action={disableAction}>
                            <input type="hidden" name="userId" value={user.id} />
                            <button
                              type="submit"
                              className="text-xs text-gray-500 hover:text-gray-700 underline"
                            >
                              Disable
                            </button>
                          </form>
                        ) : (
                          <form action={enableAction}>
                            <input type="hidden" name="userId" value={user.id} />
                            <button
                              type="submit"
                              className="text-xs text-blue-600 hover:text-blue-700 underline"
                            >
                              Enable
                            </button>
                          </form>
                        )}
                        <form action={deleteAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button
                            type="submit"
                            className="text-xs text-red-500 hover:text-red-700 underline"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-600 mb-2">
            Pending invitations
          </h3>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {invite.email}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={revokeInviteAction}>
                        <input type="hidden" name="inviteId" value={invite.id} />
                        <button
                          type="submit"
                          className="text-xs text-red-500 hover:text-red-700 underline"
                        >
                          Revoke
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
