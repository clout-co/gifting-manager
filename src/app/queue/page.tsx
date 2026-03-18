import { redirect } from 'next/navigation';

export default function QueuePage() {
  redirect('/campaigns?ops=needsInput');
}
