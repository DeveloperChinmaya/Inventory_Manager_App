import { Stack } from "expo-router";
import { UserProvider } from "./User.context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return <GestureHandlerRootView style={{ flex: 1 }}>
  <UserProvider><Stack screenOptions={{headerShown:false}} /></UserProvider>
  </GestureHandlerRootView>;
}
