import Balance from '@/components/Balance';

export default function Account() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Account Dashboard</h1>
        <Balance />
      </div>
    </div>
  );
}
