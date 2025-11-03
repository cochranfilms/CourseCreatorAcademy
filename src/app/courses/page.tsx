import { redirect } from 'next/navigation';

export default function CoursesIndex() {
  // Redirect legacy /courses to the current courses hub
  redirect('/learn');
}


