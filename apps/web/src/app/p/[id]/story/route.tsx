import { postStory } from '../card';
/** 1080×1920 PNG made for Instagram, TikTok and Snapchat stories. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) { return postStory((await params).id); }
