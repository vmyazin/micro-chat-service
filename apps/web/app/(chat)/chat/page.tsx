export default function ChatPage() {
  return (
    <div className="flex h-screen">
      <aside className="w-72 border-r p-4">
        <h2 className="font-semibold mb-4">Groups</h2>
        <p className="text-sm text-gray-500">Group list coming soon</p>
      </aside>
      <main className="flex-1 p-4">
        <h1 className="text-xl font-bold mb-4">Chat</h1>
        <p className="text-gray-600">
          Select a group to start chatting
        </p>
      </main>
    </div>
  );
}
