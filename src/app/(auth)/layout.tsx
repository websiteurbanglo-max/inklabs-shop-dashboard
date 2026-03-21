import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inklabs Shop Dashboard",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-indigo-100/60 to-purple-100/40 blur-3xl" />
        <div className="absolute -bottom-[30%] -left-[15%] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-blue-100/40 to-indigo-100/30 blur-3xl" />
        <div className="absolute top-[20%] left-[50%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-violet-100/30 to-pink-100/20 blur-3xl" />
      </div>

      {/* Branding header */}
      <div className="mb-8 text-center relative z-10 animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 mb-4 shadow-lg shadow-indigo-200/50">
          <svg
            className="w-7 h-7 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">inklabs</h1>
        <p className="text-sm text-gray-400 mt-0.5">Print Studio Platform</p>
      </div>

      {/* Main content */}
      <div className="w-full max-w-[420px] relative z-10 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        {children}
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-gray-400 relative z-10 animate-fade-in" style={{ animationDelay: "300ms" }}>
        &copy; {new Date().getFullYear()} Inklabs. All rights reserved.
      </p>
    </div>
  );
}
