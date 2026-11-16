const FLAKES = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  size: 3 + ((i * 7) % 5),
  duration: 6 + ((i * 5) % 7),
  delay: -((i * 3) % 9),
}))

/** Decorative snowfall; hidden for users who prefer reduced motion (see index.css). */
export function Snow() {
  return (
    <div className="snow" aria-hidden>
      {FLAKES.map((f, i) => (
        <i
          key={i}
          style={{
            left: f.left,
            width: f.size,
            height: f.size,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
