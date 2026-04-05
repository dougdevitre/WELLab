import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Page Not Found
      </h2>
      <p className="text-gray-600 mb-6 max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="px-6 py-2 bg-wellab-600 text-white rounded-lg font-medium hover:bg-wellab-700 focus:outline-none focus:ring-2 focus:ring-wellab-500 focus:ring-offset-2 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
