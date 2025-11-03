export default function Input({ className = '', label, ...props }) {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-white rounded-lg border border-slate-200 px-3 h-10 text-sm outline-none focus:ring-2 focus:ring-brand-400 ${className}`}
        {...props}
      />
    </div>
  );
}
