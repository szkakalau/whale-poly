export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#02000d] py-16 relative z-10">
      <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-cyan-400 opacity-80"></div>
          <span className="font-semibold text-gray-300 text-lg">Whale Intelligence</span>
        </div>
        <div className="text-gray-500 text-sm">
          © {new Date().getFullYear()} Sight Whale. All rights reserved.
        </div>
        <div className="flex gap-6">
           {/* Social placeholders or links could go here */}
        </div>
      </div>
    </footer>
  );
}
