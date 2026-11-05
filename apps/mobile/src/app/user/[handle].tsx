import { useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/supabase';
import { useLoad } from '../../lib/hooks';
import { ProfileView } from '../../components/profile';
import { Screen } from '../../components/screen';
import { View } from 'react-native';
import { Band, Sheet, T } from '../../components/ui';
import { ErrorView, Loading, Shimmer } from '../../components/skeleton';

export default function UserScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const p = useLoad(() => api.profileByHandle(handle), [handle]);
  if (p.data) return <ProfileView profile={p.data} top={false} />;
  if (p.error) return <Screen top={false}><Sheet style={{ marginTop: 0 }}><ErrorView message={p.error} onRetry={p.reload} /></Sheet></Screen>;
  return <Screen top={false}><Band>{p.loading ? <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}><Shimmer w={72} h={72} r={36} dark /><View style={{ flex: 1, gap: 8 }}><Shimmer w="60%" h={22} dark /><Shimmer w="40%" h={13} dark /></View></View> : <><T.Display>No one here.</T.Display><T.Dim>@{handle} isn't on Melo.</T.Dim></>}</Band>{p.loading && <Sheet><Loading kind="post" n={2} /></Sheet>}</Screen>;
}
