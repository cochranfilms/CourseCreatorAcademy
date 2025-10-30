const courses = [
  { title: 'Technical 101', lessons: 30 },
  { title: 'Equipment 101', lessons: 20 },
  { title: 'Cinematography 101', lessons: 27 },
  { title: 'Lighting Mastery', lessons: 32 },
  { title: 'Pocket Filmmaker', lessons: 16 },
  { title: 'Coloring Crash Course', lessons: 22 },
  { title: 'FPV Crash Course', lessons: 10 },
  { title: 'Podcast Pro', lessons: 38 }
];

export default function LearnPage() {
  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      <h1 className="text-3xl md:text-4xl font-bold">All Courses</h1>
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((c) => (
          <div key={c.title} className="rounded-2xl overflow-hidden border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950">
            <div className="h-40 bg-neutral-800" />
            <div className="p-4">
              <div className="text-lg font-semibold">{c.title}</div>
              <div className="text-sm text-neutral-400">{c.lessons} lessons</div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}


