import { albumStory } from '../card';
/** 1080×1920 "now listening" story card. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) { return albumStory((await params).id); }
