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
  source: 'seed' | 'user';
  added_by: string | null;
  created_at: string;
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

export interface LogEntry { id: string; user_id: string; item_id: string; rating: number | null; liked: boolean; listened_at: string }

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
