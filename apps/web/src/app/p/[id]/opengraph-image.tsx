import { postPreview } from './card';
export const alt = 'A post on Melo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 600;
export default async function Image({ params }: { params: Promise<{ id: string }> }) { return postPreview((await params).id); }
