interface MeteorSpec {
  id: number;
  top: string;
  left: string;
  delay: string;
  duration: string;
  lengthPx: number;
}

const METEORS: MeteorSpec[] = [
  { id: 1, top: '-8%', left: '16%', delay: '0.4s', duration: '4.6s', lengthPx: 110 },
  { id: 2, top: '4%', left: '42%', delay: '2.1s', duration: '5.4s', lengthPx: 135 },
  { id: 3, top: '-6%', left: '68%', delay: '1.2s', duration: '4.9s', lengthPx: 120 },
  { id: 4, top: '12%', left: '86%', delay: '3.6s', duration: '5.8s', lengthPx: 105 },
  { id: 5, top: '22%', left: '28%', delay: '5.1s', duration: '6.2s', lengthPx: 125 },
  { id: 6, top: '18%', left: '62%', delay: '6.8s', duration: '5.2s', lengthPx: 140 },
  { id: 7, top: '-4%', left: '94%', delay: '8.3s', duration: '4.8s', lengthPx: 115 },
];

export function MeteorShower() {
  return (
    <div
      aria-hidden="true"
      className="meteor-layer pointer-events-none fixed inset-0 overflow-hidden"
    >
      {METEORS.map((m) => (
        <span
          key={m.id}
          className="cosmic-meteor"
          style={{
            top: m.top,
            left: m.left,
            width: `${m.lengthPx}px`,
            animationDelay: m.delay,
            animationDuration: m.duration,
          }}
        />
      ))}
    </div>
  );
}
