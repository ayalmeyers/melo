import { albumPreview } from './card';
export const alt = 'An album on Melo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;
export default async function Image({ params }: { params: Promise<{ id: string }> }) { return albumPreview((await params).id); }
