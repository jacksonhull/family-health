"use client";

const SAMPLE_CHATS = [
  { id: "1", title: "Blood test results review", group: "Today" },
  { id: "2", title: "Migraine symptom analysis", group: "Today" },
  { id: "3", title: "Medication dosage check", group: "Yesterday" },
  { id: "4", title: "Annual checkup preparation", group: "Yesterday" },
  { id: "5", title: "Vitamin D supplement advice", group: "Last week" },
  { id: "6", title: "Allergic reaction follow-up", group: "Last week" },
];

const GROUPS = ["Today", "Yesterday", "Last week"];

export default function ConsultationsSidebar({
  onCollapse,
}: {
  onCollapse: () => void;
}) {
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-800">Consultations</span>
        <button
          onClick={onCollapse}
          title="Collapse"
          className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          {/* Left-pointing panel icon */}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7M21 12H4" />
          </svg>
        </button>
      </div>

      {/* Actions */}
      <div className="px-3 py-3 space-y-0.5">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
          <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>New chat</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors">
          <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Search</span>
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Chats
        </p>
        {GROUPS.map((group) => {
          const chats = SAMPLE_CHATS.filter((c) => c.group === group);
          return (
            <div key={group} className="mb-3">
              <p className="px-3 py-1 text-xs text-gray-400">{group}</p>
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  className="w-full flex items-center px-3 py-2 rounded-lg text-sm text-left text-gray-600 hover:bg-gray-100 transition-colors group"
                >
                  <span className="truncate flex-1">{chat.title}</span>
                  <span className="w-5 h-5 rounded opacity-0 group-hover:opacity-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-opacity shrink-0">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16">
                      <circle cx="8" cy="3" r="1.5" />
                      <circle cx="8" cy="8" r="1.5" />
                      <circle cx="8" cy="13" r="1.5" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
