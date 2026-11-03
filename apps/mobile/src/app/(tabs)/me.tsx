import { View } from 'react-native';
import { useSession } from '../../lib/session';
import { go } from '../../lib/hooks';
import { ProfileView } from '../../components/profile';
import { Screen } from '../../components/screen';
import { Band, Button, Sheet, T } from '../../components/ui';
import { C } from '../../components/theme';

export default function Me() {
  const { user, profile } = useSession();
  if (user && profile) return <ProfileView profile={profile} />;
  return <Screen>
    <Band>
      <T.Display>Your ears,{'\n'}on the record.</T.Display>
      <T.Body style={{ color: C.onInkDim }}>Log albums and episodes, write reviews, call what happens next in music, and find people who hear it the way you do.</T.Body>
    </Band>
    <Sheet>
      <View style={{ gap: 12 }}>
        <Button title="Sign in or create an account" onPress={() => go('/login')} />
        <Button kind="ghost" title="Settings and support" onPress={() => go('/settings')} />
      </View>
    </Sheet>
  </Screen>;
}
