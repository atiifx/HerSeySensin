import React, { useEffect, useState, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  FlatList, 
  Platform 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Battery from 'expo-battery';
import { ref, onValue, set, onDisconnect } from 'firebase/database';
import { db } from '../config/firebase';
import { UserContext } from '../context/UserContext';
import { theme } from '../theme/colors';
import { 
  Battery as BatteryIcon, 
  BatteryCharging, 
  Zap, 
  Crown, 
  Gem, 
  Activity, 
  X, 
  Clock,
  Heart 
} from 'lucide-react-native';

export default function HeaderBar() {
  const insets = useSafeAreaInsets();
  const { user, partner } = useContext(UserContext);

  const [partnerBattery, setPartnerBattery] = useState({ level: 100, charging: false });
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all' | 'atakan' | 'cemre'

  // 1. Kendi pil durumunu dinle ve Firebase'e yaz
  useEffect(() => {
    let batteryLevelSub;
    let batteryStateSub;

    const syncBattery = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        const state = await Battery.getBatteryStateAsync();
        const isCharging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;

        if (user) {
          set(ref(db, `users/${user}/battery`), {
            level: Math.round(level * 100),
            charging: isCharging,
            updatedAt: Date.now()
          });
        }
      } catch (err) {
        console.log('Battery error:', err);
      }
    };

    syncBattery();

    batteryLevelSub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      if (user) {
        set(ref(db, `users/${user}/battery/level`), Math.round(batteryLevel * 100));
        set(ref(db, `users/${user}/battery/updatedAt`), Date.now());
      }
    });

    batteryStateSub = Battery.addBatteryStateListener(({ batteryState }) => {
      if (user) {
        const isCharging = batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL;
        set(ref(db, `users/${user}/battery/charging`), isCharging);
        set(ref(db, `users/${user}/battery/updatedAt`), Date.now());
      }
    });

    return () => {
      batteryLevelSub && batteryLevelSub.remove();
      batteryStateSub && batteryStateSub.remove();
    };
  }, [user]);

  // 2. Kendi çevrimiçi durumunu yönet ve partnerin durumunu dinle
  useEffect(() => {
    if (!user) return;

    const myStatusRef = ref(db, `users/${user}/isOnline`);
    const connectedRef = ref(db, '.info/connected');

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        set(myStatusRef, true);
        onDisconnect(myStatusRef).set(false);
      }
    });

    let unsubPartnerStatus = () => {};
    if (partner) {
      const partnerStatusRef = ref(db, `users/${partner}/isOnline`);
      unsubPartnerStatus = onValue(partnerStatusRef, (snap) => {
        setPartnerOnline(!!snap.val());
      });
    }

    return () => {
      unsubConnected();
      unsubPartnerStatus();
    };
  }, [user, partner]);

  // 3. Karşı tarafın pil durumunu Firebase'den dinle
  useEffect(() => {
    if (!partner) return;
    const partnerBatteryRef = ref(db, `users/${partner}/battery`);
    const unsubscribe = onValue(partnerBatteryRef, (snapshot) => {
      if (snapshot.exists()) {
        setPartnerBattery(snapshot.val());
      }
    });

    return () => unsubscribe();
  }, [partner]);

  // 4. Aktivite loglarını dinle
  useEffect(() => {
    const logsRef = ref(db, 'activity_logs');
    const unsubscribe = onValue(logsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const parsedLogs = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).reverse();
        setLogs(parsedLogs.slice(0, 50));
      }
    });

    return () => unsubscribe();
  }, []);

  const partnerName = partner === 'atakan' ? 'Atakan' : 'Cemre';

  // Seçilen filtreye göre logları süz
  const filteredLogs = logs.filter((item) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'atakan') return item.user === 'atakan' || item.user === 'biz';
    if (selectedFilter === 'cemre') return item.user === 'cemre' || item.user === 'biz';
    return true;
  });

  return (
    <>
      <View style={[styles.safeArea, { paddingTop: Math.max(insets.top, 24) + 6 }]}>
        <View style={styles.container}>
          {/* Sol: Karşı Tarafın Durumu */}
          <View style={styles.userSection}>
            <View style={styles.avatarMini}>
              {partner === 'atakan' ? (
                <Crown size={15} color={theme.colors.gold} />
              ) : (
                <Gem size={14} color="#70D6FF" />
              )}
              {partnerOnline && <View style={styles.onlineDot} />}
            </View>
            <View>
              <Text style={styles.partnerName}>{partnerName}</Text>
              <View style={styles.batteryRow}>
                {partnerBattery.charging ? (
                  <BatteryCharging size={13} color={theme.colors.accentGreen} />
                ) : (
                  <BatteryIcon size={13} color={partnerBattery.level <= 20 ? theme.colors.accentPink : theme.colors.goldLight} />
                )}
                <Text style={styles.batteryText}>%{partnerBattery.level ?? '--'}</Text>
                {partnerBattery.charging && (
                  <Zap size={11} color={theme.colors.accentGreen} fill={theme.colors.accentGreen} />
                )}
              </View>
            </View>
          </View>

          {/* Sağ: Aktivite Günlüğü Butonu */}
          <TouchableOpacity 
            onPress={() => setLogModalVisible(true)} 
            style={styles.logButton}
            activeOpacity={0.8}
          >
            <Activity size={18} color={theme.colors.gold} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Aktivite Günlüğü Modalı */}
      <Modal
        visible={logModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setLogModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          {/* Kartın dışındaki karartılmış alana basıldığında modalı kapatan katman */}
          <TouchableOpacity 
            style={styles.backdropPressable} 
            activeOpacity={1} 
            onPress={() => setLogModalVisible(false)} 
          />

          <View style={styles.modalContent}>
            {/* Çekme Tutamacı */}
            <View style={styles.sheetHandle} />

            {/* Modal Başlığı */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color={theme.colors.gold} />
                <Text style={styles.modalTitle}>Aktivite Günlüğü</Text>
              </View>
              <TouchableOpacity onPress={() => setLogModalVisible(false)}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Filtreleme Sekmeleri: Tümü / Atakan / Cemre */}
            <View style={styles.filterRow}>
              <TouchableOpacity 
                style={[styles.filterBtn, selectedFilter === 'all' && styles.filterBtnActive]} 
                onPress={() => setSelectedFilter('all')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterBtnText, selectedFilter === 'all' && styles.filterBtnTextActive]}>
                  Tümü
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.filterBtn, selectedFilter === 'atakan' && styles.filterBtnActive]} 
                onPress={() => setSelectedFilter('atakan')}
                activeOpacity={0.7}
              >
                <Crown size={12} color={selectedFilter === 'atakan' ? theme.colors.gold : theme.colors.textSecondary} />
                <Text style={[styles.filterBtnText, selectedFilter === 'atakan' && styles.filterBtnTextActive]}>
                  Atakan
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.filterBtn, selectedFilter === 'cemre' && styles.filterBtnActive]} 
                onPress={() => setSelectedFilter('cemre')}
                activeOpacity={0.7}
              >
                <Gem size={12} color={selectedFilter === 'cemre' ? '#70D6FF' : theme.colors.textSecondary} />
                <Text style={[styles.filterBtnText, selectedFilter === 'cemre' && styles.filterBtnTextActive]}>
                  Cemre
                </Text>
              </TouchableOpacity>
            </View>

            {/* Log Listesi */}
            <FlatList
              data={filteredLogs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: 6 }}
              renderItem={({ item }) => (
                <View style={styles.logItem}>
                  <View style={styles.logIconCol}>
                    {item.user === 'biz' ? (
                      <Heart size={13} color="#FF2D55" fill="#FF2D55" />
                    ) : item.user === 'atakan' ? (
                      <Crown size={14} color={theme.colors.gold} />
                    ) : (
                      <Gem size={13} color="#70D6FF" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logText}>{item.action}</Text>
                    <Text style={styles.logTime}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Bu filtreye ait aktivite bulunamadı.</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.background,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.1)',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#14141B',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#32D74B',
    borderWidth: 1.5,
    borderColor: '#08080B',
  },
  partnerName: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.textPrimary,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  batteryText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  logButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#14141B',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    flex: 1,
    width: '100%',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalContent: {
    backgroundColor: '#121218',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    height: '68%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 48,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalTitle: {
    fontFamily: theme.fonts.heading,
    color: theme.colors.goldLight,
    fontSize: 16,
    letterSpacing: 1,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    marginBottom: 6,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#161620',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterBtnActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderColor: theme.colors.gold,
  },
  filterBtnText: {
    fontFamily: theme.fonts.body,
    fontSize: 11.5,
    color: theme.colors.textSecondary,
  },
  filterBtnTextActive: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.goldLight,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 12,
  },
  logIconCol: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A1A24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textPrimary,
    fontSize: 13,
  },
  logTime: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 32,
    fontSize: 13,
  },
});