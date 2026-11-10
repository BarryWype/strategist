import { Alegreya_500Medium, Alegreya_500Medium_Italic, Alegreya_700Bold } from '@expo-google-fonts/alegreya';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

import { fonts, map } from '@/theme';

// Every screen draws its own wood header (MapScreen).
const screenOptions = { headerShown: false, contentStyle: { backgroundColor: map.wood } };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [fonts.body]: require('../../assets/fonts/FantaisieArtistique.ttf'),
    [fonts.serif]: Alegreya_500Medium,
    [fonts.serifBold]: Alegreya_700Bold,
    [fonts.serifItalic]: Alegreya_500Medium_Italic,
  });

  // On a load error, fall back to the system font rather than a blank screen.
  if (!fontsLoaded && !fontError) return null;

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="run" />
      <Stack.Screen name="brief" />
      <Stack.Screen name="room" />
      <Stack.Screen name="report" />
    </Stack>
  );
}
