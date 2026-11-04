export type ItemType = 'album' | 'episode' | 'show';
export type TargetType = 'item' | 'artist' | 'genre';
export type PostKind = 'review' | 'take' | 'thread';
export type FollowKind = 'user' | 'artist' | 'genre';
export type ShareType = 'post' | 'comment' | 'item' | 'artist' | 'genre' | 'forecast';

export interface CatalogItem {
  id: string;
  type: ItemType;
  title: string;
  artist_id: string | null;
  artist_name: string;
  show_id: string | null;
  year: number | null;
  cc: string;
  genre: string | null;
  dur_min: number | null;
  source: 'seed' | 'user' | 'apple';
  added_by: string | null;
  created_at: string;
  apple_id?: number | null;
  artwork_url?: string | null;
  apple_url?: string | null;
  release_date?: string | null;
  track_count?: number | null;
}

export interface Artist {
  id: string;
  name: string;
  cc: string;
  genres: string[];
  apple_id?: number | null;
  artwork_url?: string | null;
  source?: 'seed' | 'apple';
  image_url?: string | null;
  image_credit?: string | null;
  image_source?: string | null;
  image_checked_at?: string | null;
}

export interface Profile {
  id: string;
  handle: string;
  name: string;
  bio: string;
  city: string;
  cc: string;
  top4: string[];
  color: string;
  is_admin: boolean;
  accepted_terms_at: string | null;
  created_at: string;
}

export interface ProfileStats { id: string; followers: number; following: number; logged: number; posts: number; ear: number | null }

export interface Post {
  id: string;
  author: string;
  kind: PostKind;
  target_type: TargetType | null;
  target_id: string | null;
  rating: number | null;
  title: string | null;
  body: string;
  spoiler: boolean;
  created_at: string;
}

export interface FeedPost extends Post {
  author_handle: string;
  author_name: string;
  author_color: string;
  author_cc: string;
  likes: number;
  laughs: number;
  comment_count: number;
  agree: number;
  disagree: number;
  hot: number;
}

export interface Comment {
  id: string;
  post_id: string | null;
  forecast_id: string | null;
  author: string;
  reply_to: string | null;
  body: string;
  created_at: string;
  author_handle: string;
  author_name: string;
  author_color: string;
  likes: number;
}

export interface Forecast {
  id: string;
  question: string;
  detail: string;
  closes_on: string;
  target_type: TargetType | null;
  target_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ForecastConsensus {
  forecast_id: string;
  crowd_p: number | null;
  forecasters: number;
  distribution: number[];
  outcome: 'yes' | 'no' | null;
  resolved_at: string | null;
}

export interface ItemRating { item_id: string; avg_stars: number; n: number; histogram: number[] }

export interface LogEntry { id: string; user_id: string; item_id: string; rating: number | null; liked: boolean; listened_at: string; source?: 'melo' | 'spotify' | 'apple'; plays?: number | null }

export interface Moment { id: string; item_id: string; author: string; t_seconds: number; body: string; created_at: string }

export interface WikiPage { key: string; body: string; rev: number; updated_by: string | null; updated_at: string }

export interface Chat {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_by: string | null;
}

export interface ChatMember { chat_id: string; user_id: string; last_read_at: string }

export interface Message {
  id: string;
  chat_id: string;
  author: string;
  body: string | null;
  share_type: ShareType | null;
  share_id: string | null;
  created_at: string;
}

export interface RadarRow { subject_id: string; subject_type: 'artist' | 'item'; recent: number; baseline: number; listeners: number; score: number }

export interface Target { type: TargetType; id: string }

export type NotificationKind = 'comment' | 'reply' | 'follow' | 'like' | 'laugh' | 'resolved' | 'message';
export interface MeloNotification {
  id: string;
  user_id: string;
  actor: string | null;
  kind: NotificationKind;
  post_id: string | null;
  comment_id: string | null;
  forecast_id: string | null;
  chat_id: string | null;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export type ReportAction = 'remove' | 'ban' | 'dismiss' | 'unban';
export interface QueuedReport {
  id: string;
  target_type: 'post' | 'comment' | 'message' | 'profile' | 'moment';
  target_id: string;
  reason: string;
  status: 'open' | 'actioned' | 'dismissed';
  created_at: string;
  reporter_handle: string | null;
  author_id: string | null;
  author_handle: string | null;
  author_banned: boolean;
  content: string | null;
  link: string | null;
  reports_on_target: number;
}

export type ChartScope = 'public' | 'friends';
export type ChartKind = 'albums' | 'artists' | 'podcasts';
export interface ChartRow { subject_id: string; subject_type: 'item' | 'artist'; rank: number; prev_rank: number | null; listeners: number; logs: number; avg_rating: number | null }

export interface TasteMatch { score: number; shared_items: number; shared_artists: number; co_rated: number; agreement: number | null; top_shared: string[] | null; both_loved: string[] | null }
export interface SimilarListener { user_id: string; score: number; shared_items: number; shared_artists: number }

export interface ListCard {
  id: string; owner: string; title: string; description: string; ranked: boolean; created_at: string; updated_at: string;
  owner_handle: string; owner_name: string; owner_color: string; item_count: number;
  preview: { id: string; title: string; type: ItemType; artwork_url: string | null }[];
}
export interface ListEntry { list_id: string; item_id: string; position: number; note: string; added_at: string }
