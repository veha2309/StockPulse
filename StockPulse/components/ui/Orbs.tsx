export default function Orbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div className="orb w-[500px] h-[500px] bg-blue-700 top-[-150px] left-[-150px]" />
      <div className="orb w-[400px] h-[400px] bg-violet-700 bottom-[-100px] right-[-100px]" />
      <div className="orb w-[300px] h-[300px] bg-emerald-700 top-[40%] left-[50%]" />
    </div>
  );
}
