import { useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/supabase';
import { useLoad } from '../../lib/hooks';
import { Screen } from '../../components/screen';
import { usePostState } from '../../components/post';
import { Comments } from '../../components/social';
import { Empty, Sheet } from '../../components/ui';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const post = useLoad(() => api.post(id), [id]);
  const list = useMemo(() => (post.data ? [post.data] : null), [post.data]);
  const { list: rendered, render } = usePostState(list);
  return <Screen top={false} keyboard onRefresh={post.reload}>
    <Sheet style={{ marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
      {post.data === null && !post.loading ? <Empty text="This post was deleted or never existed." /> : rendered.map(p => render(p, { full: true }))}
      {post.data && <Comments on={{ post: id }} />}
    </Sheet>
  </Screen>;
}
