import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <p className="font-display text-[32px] text-bone-100">Nothing here.</p>
      <p className="text-[14px] text-bone-400">This page doesn't exist.</p>
      <Link to="/" className="text-[14px] text-brass-300 hover:text-brass-200">
        Back to the overview
      </Link>
    </div>
  );
}
