import Health from '@/components/Health';

export default function HealthPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">API Health Check</h1>
        <p className="text-gray-600">Monitor the status of your backend API</p>
      </div>
      
      <Health />
    </div>
  );
} 