import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Animated,
  AppState
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold
} from '@expo-google-fonts/plus-jakarta-sans';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import YoutubePlayer from 'react-native-youtube-iframe';
import { ref, set, push, onValue, update } from 'firebase/database';
import { db } from './src/config/firebase';

import { UserProvider, UserContext } from './src/context/UserContext';
import ProfileSelect from './src/screens/ProfileSelect';
import HeaderBar from './src/components/HeaderBar';
import BizScreen from './src/screens/BizScreen';
import RadarScreen from './src/screens/RadarScreen';
import PlanScreen from './src/screens/PlanScreen';
import FunScreen from './src/screens/FunScreen';
import { registerForPushNotificationsAsync } from './src/utils/notifications';
import { theme } from './src/theme/colors';
import { Heart, Compass, CheckSquare, Sparkles, X } from 'lucide-react-native';

const { width, height: screenHeight } = Dimensions.get('window');

// 16:9 Orantılı Video Ölçüleri
const PLAYER_WIDTH = width - 40;
const PLAYER_HEIGHT = Math.round((PLAYER_WIDTH * 9) / 16);
const MINI_WIDTH = 160;
const MINI_HEIGHT = Math.round((MINI_WIDTH * 9) / 16);

// ==================== ARKA PLAN SERVİSİ TANIMI ====================
export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.log('Background task error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    const latestLocation = locations[locations.length - 1];

    if (latestLocation) {
      try {
        const currentUser = await AsyncStorage.getItem('@app_user');
        if (currentUser) {
          set(ref(db, `users/${currentUser}/location`), {
            latitude: latestLocation.coords.latitude,
            longitude: latestLocation.coords.longitude,
            accuracy: latestLocation.coords.accuracy || 10,
            updatedAt: Date.now()
          });

          const batteryLevel = await Battery.getBatteryLevelAsync();
          const batteryState = await Battery.getBatteryStateAsync();
          const isCharging = batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL;

          set(ref(db, `users/${currentUser}/battery`), {
            level: Math.round(batteryLevel * 100),
            charging: isCharging,
            updatedAt: Date.now()
          });
        }
      } catch (err) {
        console.log('Background sync error:', err);
      }
    }
  }
});

// ==================== ANA ROUTER ====================
function MainRouter() {
  const { user, loading } = React.useContext(UserContext);
  const [activeTab, setActiveTab] = useState('biz');
  const [funSubTab, setFunSubTab] = useState('xox');
  const insets = useSafeAreaInsets();

  const playerRef = useRef(null);
  const [ytData, setYtData] = useState({ videoId: 'jfKfPfyJRdk', playing: false });
  const [currentTime, setCurrentTime] = useState(0);
  const [isMiniDismissed, setIsMiniDismissed] = useState(false);

  // Uygulama Yaşam Döngüsü (Arka Plan / Ön Plan Takibi)
  const appStateRef = useRef(AppState.currentState);

  // Sürüklenebilir Mini Video Pozisyonu
  const defaultPos = { x: width - MINI_WIDTH - 16, y: screenHeight - MINI_HEIGHT - 160 };
  const pan = useRef(new Animated.ValueXY(defaultPos)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    })
  ).current;

  // Firebase YouTube Dinleyicisi
  useEffect(() => {
    const ytRef = ref(db, 'games/youtube');
    const unsubYt = onValue(ytRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const isPlaying = !!data.playing;

        setYtData(prev => {
          if (prev.videoId !== data.videoId && !data.currentTime) {
            setCurrentTime(0);
          }
          return {
            videoId: data.videoId || 'jfKfPfyJRdk',
            playing: isPlaying,
          };
        });

        if (typeof data.currentTime === 'number') {
          setCurrentTime(data.currentTime);
          if (playerRef.current) {
            playerRef.current.seekTo(data.currentTime, true);
          }
        }

        if (isPlaying) {
          setIsMiniDismissed(false);
        }
      }
    });

    return () => unsubYt();
  }, []);

  // Video çalarken anlık saniyeyi düzenli kaydet
  useEffect(() => {
    let interval = null;
    if (ytData.playing) {
      interval = setInterval(async () => {
        try {
          if (playerRef.current) {
            const sec = await playerRef.current.getCurrentTime();
            if (typeof sec === 'number' && sec >= 0) {
              setCurrentTime(sec);
            }
          }
        } catch (e) { }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [ytData.playing]);

  // Birlikte İzle sekmesine dönüldüğünde kapatılmışlık kilidini kaldır
  useEffect(() => {
    if (activeTab === 'eglence' && funSubTab === 'watch') {
      setIsMiniDismissed(false);
    }
  }, [activeTab, funSubTab]);

  // Canlı Takip, İlk Açılış ve Arka Plan / Ön Plan Günlükleri
  useEffect(() => {
    const startBackgroundTracking = async () => {
      try {
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') return;

        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') return;

        const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
        if (!hasStarted) {
          await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 30000,
            distanceInterval: 15,
            showsBackgroundLocationIndicator: false,
          });
        }
      } catch (e) {
        console.log('Arka plan başlatma hatası:', e);
      }
    };

    if (user) {
      const displayName = user === 'atakan' ? 'Atakan' : 'Cemre';

      registerForPushNotificationsAsync(user);
      startBackgroundTracking();

      // 1. İlk Açılış Kaydı
      push(ref(db, 'activity_logs'), {
        user: user,
        action: `${displayName} uygulamayı açtı.`,
        timestamp: Date.now()
      });

      // 2. Arka Plan & Ön Plan Değişim Dinleyicisi
      const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
        if (
          appStateRef.current === 'active' &&
          nextAppState.match(/inactive|background/)
        ) {
          // Kullanıcı başka uygulamaya geçti veya ekranı kapattı
          push(ref(db, 'activity_logs'), {
            user: user,
            action: `${displayName} uygulamayı arka plana aldı.`,
            timestamp: Date.now()
          });
        } else if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          // Kullanıcı arka plandan uygulamaya geri döndü
          push(ref(db, 'activity_logs'), {
            user: user,
            action: `${displayName} uygulamaya geri döndü.`,
            timestamp: Date.now()
          });
        }

        appStateRef.current = nextAppState;
      });

      return () => {
        appStateSubscription.remove();
      };
    }
  }, [user]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={theme.colors.gold} />
      </View>
    );
  }

  if (!user) {
    return <ProfileSelect />;
  }

  const bottomPadding = Math.max(insets.bottom, 12);
  const isDocked = (activeTab === 'eglence' && funSubTab === 'watch');
  const showMiniPlayer = !isDocked && ytData.playing && !isMiniDismissed;
  const isPlayerVisible = isDocked || showMiniPlayer;

  // Mini oynatıcıyı kapatma: Anlık saniyeyi al, Firebase'e yaz ve sesi hemen kes
  const handleCloseMiniPlayer = async () => {
    let finalTime = currentTime;
    try {
      if (playerRef.current) {
        const sec = await playerRef.current.getCurrentTime();
        if (typeof sec === 'number' && sec >= 0) {
          finalTime = sec;
          setCurrentTime(sec);
        }
      }
    } catch (e) { }

    setIsMiniDismissed(true);
    setYtData(prev => ({ ...prev, playing: false }));
    update(ref(db, 'games/youtube'), {
      playing: false,
      currentTime: Math.floor(finalTime),
    });
  };

  return (
    <View style={styles.container}>
      <HeaderBar />

      <View style={styles.screenContainer}>
        {activeTab === 'biz' && <BizScreen />}
        {activeTab === 'radar' && <RadarScreen />}
        {activeTab === 'planlar' && <PlanScreen />}
        {activeTab === 'eglence' && (
          <FunScreen
            subTab={funSubTab}
            setSubTab={setFunSubTab}
          />
        )}

        {isPlayerVisible && (
          <Animated.View
            {...(!isDocked ? panResponder.panHandlers : {})}
            style={[
              styles.playerBase,
              isDocked ? styles.dockedPlayer : [styles.miniPlayer, pan.getLayout()]
            ]}
          >
            <TouchableOpacity
              activeOpacity={1}
              disabled={isDocked}
              onPress={() => {
                setIsMiniDismissed(false);
                setActiveTab('eglence');
                setFunSubTab('watch');
              }}
              style={{ width: '100%', height: '100%' }}
            >
              <YoutubePlayer
                ref={playerRef}
                width={isDocked ? PLAYER_WIDTH : MINI_WIDTH}
                height={isDocked ? PLAYER_HEIGHT : MINI_HEIGHT}
                play={ytData.playing}
                videoId={ytData.videoId}
                initialPlayerParams={{
                  start: Math.floor(currentTime),
                  preventFullScreen: false,
                }}
                onReady={() => {
                  if (currentTime > 0) {
                    playerRef.current?.seekTo(currentTime, true);
                  }
                }}
                onChangeState={async (state) => {
                  if (isDocked) {
                    if (state === 'playing') {
                      let sec = currentTime;
                      try {
                        sec = (await playerRef.current?.getCurrentTime()) || currentTime;
                      } catch (e) { }

                      setYtData(prev => ({ ...prev, playing: true }));
                      update(ref(db, 'games/youtube'), {
                        playing: true,
                        currentTime: Math.floor(sec)
                      });
                    } else if (state === 'paused' || state === 'ended') {
                      let sec = currentTime;
                      try {
                        sec = (await playerRef.current?.getCurrentTime()) || currentTime;
                      } catch (e) { }

                      setYtData(prev => ({ ...prev, playing: false }));
                      update(ref(db, 'games/youtube'), {
                        playing: false,
                        currentTime: Math.floor(sec)
                      });
                    }
                  }
                }}
              />
            </TouchableOpacity>

            {showMiniPlayer && (
              <TouchableOpacity
                style={styles.miniCloseBtn}
                onPress={handleCloseMiniPlayer}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <X size={13} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: bottomPadding, height: 60 + bottomPadding }]}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('biz')}
          activeOpacity={0.7}
        >
          <Heart
            size={22}
            color={activeTab === 'biz' ? theme.colors.gold : theme.colors.textSecondary}
            fill={activeTab === 'biz' ? theme.colors.gold : 'transparent'}
          />
          <Text style={[styles.tabLabel, activeTab === 'biz' && styles.tabLabelActive]}>Biz</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('radar')}
          activeOpacity={0.7}
        >
          <Compass
            size={22}
            color={activeTab === 'radar' ? theme.colors.gold : theme.colors.textSecondary}
          />
          <Text style={[styles.tabLabel, activeTab === 'radar' && styles.tabLabelActive]}>Radar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('planlar')}
          activeOpacity={0.7}
        >
          <CheckSquare
            size={22}
            color={activeTab === 'planlar' ? theme.colors.gold : theme.colors.textSecondary}
          />
          <Text style={[styles.tabLabel, activeTab === 'planlar' && styles.tabLabelActive]}>Planlar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('eglence')}
          activeOpacity={0.7}
        >
          <Sparkles
            size={22}
            color={activeTab === 'eglence' ? theme.colors.gold : theme.colors.textSecondary}
          />
          <Text style={[styles.tabLabel, activeTab === 'eglence' && styles.tabLabelActive]}>Eğlence</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Cinzel_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <UserProvider>
        <StatusBar barStyle="light-content" backgroundColor="#08080B" translucent={true} />
        <MainRouter />
      </UserProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  screenContainer: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#0D0D12',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flex: 1,
  },
  tabLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.gold,
  },

  /* Video Oynatıcı Stilleri */
  playerBase: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  dockedPlayer: {
    position: 'absolute',
    top: 74,
    left: 20,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    zIndex: 20,
  },
  miniPlayer: {
    position: 'absolute',
    width: MINI_WIDTH,
    height: MINI_HEIGHT,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.gold,
    zIndex: 9999,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  miniCloseBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
});