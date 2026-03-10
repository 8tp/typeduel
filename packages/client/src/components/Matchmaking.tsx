export function Matchmaking() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-accent mb-4">Finding Opponent</h2>
        <div className="flex justify-center gap-1 mb-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block w-2 h-2 bg-accent rounded-full animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <p className="text-text/40 text-sm">Waiting for another player...</p>
      </div>
    </div>
  )
}
