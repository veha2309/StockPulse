export default function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold tracking-widest text-gray-500 uppercase">{label}</label>
      <input
        {...props}
        className="input-field w-full px-4 py-3 rounded-xl text-white text-sm placeholder-gray-700"
      />
    </div>
  );
}
