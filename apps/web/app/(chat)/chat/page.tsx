export default function ChatPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <h1 className="text-xl font-bold mb-4">Welcome to MicroChat</h1>
      <p className="text-gray-600 dark:text-gray-400 text-center">
        Select a group from the sidebar to start chatting,
        <br />
        or create a new group to get started.
      </p>
    </div>
  );
}
