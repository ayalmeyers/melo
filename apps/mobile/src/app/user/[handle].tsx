import { useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/supabase';
import { useLoad } from '../../lib/hooks';
import { ProfileView } from '../../components/profile';
import { Screen } from '../../components/screen';
import { Band, T } from '../../components/ui';

export default function UserScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const p = useLoad(() => api.profileByHandle(handle), [handle]);
  if (p.data) return <ProfileView profile={p.data} top={false} />;
  return <Screen top={false}><Band><T.Display>{p.loading ? '' : 'No one here.'}</T.Display>{!p.loading && <T.Dim>@{handle} isn't on Melo.</T.Dim>}</Band></Screen>;
}
