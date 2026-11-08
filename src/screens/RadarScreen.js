import React, { useState, useEffect, useContext, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    Platform,
    Linking
} from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { ref, onValue, set, push, remove } from 'firebase/database';
import { db } from '../config/firebase';
import { UserContext } from '../context/UserContext';
import { theme } from '../theme/colors';
import { mapDarkStyle } from '../theme/mapDarkStyle';
import {
    Crown,
    Gem,
    Heart,
    X,
    MapPin,
    Navigation,
    Crosshair,
    Clock,
    Compass,
    CornerUpRight,
    Trash2
} from 'lucide-react-native';

export default function RadarScreen() {
    const { user, partner } = useContext(UserContext);
    const mapRef = useRef(null);

    const [myLocation, setMyLocation] = useState(null);
    const [partnerLocation, setPartnerLocation] = useState(null);
    const [memories, setMemories] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modallar
    const [sealModal, setSealModal] = useState(false);
    const [selectedCoord, setSelectedCoord] = useState(null);
    const [memoryTitle, setMemoryTitle] = useState('');
    const [memoryNote, setMemoryNote] = useState('');
    const [activeMemory, setActiveMemory] = useState(null);
    const [myInfoModal, setMyInfoModal] = useState(false);

    // 1. Canlı GPS Konumunu Al ve Firebase'e Yaz
    useEffect(() => {
        let locationSub = null;

        const startLocationWatch = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('İzin Gerekli', 'Canlı radar için konum izni vermeniz gerekiyor.');
                    setLoading(false);
                    return;
                }

                const initialLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setMyLocation(initialLoc.coords);
                setLoading(false);

                if (user) {
                    set(ref(db, `users/${user}/location`), {
                        latitude: initialLoc.coords.latitude,
                        longitude: initialLoc.coords.longitude,
                        accuracy: initialLoc.coords.accuracy || 10,
                        updatedAt: Date.now()
                    });
                }

                locationSub = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        timeInterval: 4000,
                        distanceInterval: 5,
                    },
                    (loc) => {
                        setMyLocation(loc.coords);
                        if (user) {
                            set(ref(db, `users/${user}/location`), {
                                latitude: loc.coords.latitude,
                                longitude: loc.coords.longitude,
                                accuracy: loc.coords.accuracy || 10,
                                updatedAt: Date.now()
                            });
                        }
                    }
                );
            } catch (err) {
                console.log('Location error:', err);
                setLoading(false);
            }
        };

        startLocationWatch();

        return () => {
            if (locationSub) locationSub.remove();
        };
    }, [user]);

    // 2. Karşı Tarafın Canlı Konumunu Dinle
    useEffect(() => {
        if (!partner) return;
        const partnerLocRef = ref(db, `users/${partner}/location`);
        const unsub = onValue(partnerLocRef, (snap) => {
            if (snap.exists()) {
                setPartnerLocation(snap.val());
            }
        });

        return () => unsub();
    }, [partner]);

    // 3. Mühürlenen Anıları Dinle
    useEffect(() => {
        const memoriesRef = ref(db, 'memories');
        const unsub = onValue(memoriesRef, (snap) => {
            if (snap.exists()) {
                const data = snap.val();
                const list = Object.keys(data).map(k => ({ id: k, ...data[k] }));
                setMemories(list);
            } else {
                setMemories([]);
            }
        });

        return () => unsub();
    }, []);

    // İki Konum Arasındaki Mesafeyi Hesapla
    const calculateDistance = () => {
        if (!myLocation || !partnerLocation) return null;
        const R = 6371; // km
        const dLat = (partnerLocation.latitude - myLocation.latitude) * Math.PI / 180;
        const dLon = (partnerLocation.longitude - myLocation.longitude) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(myLocation.latitude * Math.PI / 180) *
            Math.cos(partnerLocation.latitude * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        if (distance < 1) {
            return `${Math.round(distance * 1000)} metre`;
        }
        return `${distance.toFixed(1)} km`;
    };

    // Navigasyonu Aç
    const openDirectionsToPartner = () => {
        if (!partnerLocation) {
            Alert.alert('Bilgi', 'Karşı tarafın konumu henüz alınamadı.');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const { latitude, longitude } = partnerLocation;
        const url = Platform.select({
            ios: `maps://app?daddr=${latitude},${longitude}`,
            android: `google.navigation:q=${latitude},${longitude}`,
        });

        Linking.canOpenURL(url).then((supported) => {
            if (supported) {
                Linking.openURL(url);
            } else {
                Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
            }
        });
    };

    // Haritaya basılı tutarak anı noktası seçme
    const handleMapLongPress = (e) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const coord = e.nativeEvent.coordinate;
        setSelectedCoord(coord);
        setSealModal(true);
    };

    // Yeni Anı Kaydetme
    const handleSaveMemory = () => {
        if (!memoryTitle.trim() || !selectedCoord) return;

        push(ref(db, 'memories'), {
            title: memoryTitle.trim(),
            note: memoryNote.trim(),
            latitude: selectedCoord.latitude,
            longitude: selectedCoord.longitude,
            author: user,
            timestamp: Date.now(),
        });

        push(ref(db, 'activity_logs'), {
            user: user,
            action: `${user === 'atakan' ? 'Atakan' : 'Cemre'} haritada yeni bir anı mühürledi: "${memoryTitle.trim()}"`,
            timestamp: Date.now()
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMemoryTitle('');
        setMemoryNote('');
        setSelectedCoord(null);
        setSealModal(false);
    };

    // Anıyı Silme
    const handleDeleteMemory = (memoryId) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            'Anıyı Sil',
            'Bu güzel anıyı haritadan kaldırmak istediğine emin misin?',
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Sil',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await remove(ref(db, `memories/${memoryId}`));
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            setActiveMemory(null);
                        } catch (err) {
                            Alert.alert('Hata', 'Anı silinirken bir problem oluştu.');
                        }
                    }
                }
            ]
        );
    };

    const focusOnPartner = () => {
        if (partnerLocation && mapRef.current) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            mapRef.current.animateToRegion({
                latitude: partnerLocation.latitude,
                longitude: partnerLocation.longitude,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
            }, 1000);
        } else {
            Alert.alert('Bilgi', 'Karşı taraf henüz konum paylaşmadı.');
        }
    };

    const focusOnMe = () => {
        if (myLocation && mapRef.current) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            mapRef.current.animateToRegion({
                latitude: myLocation.latitude,
                longitude: myLocation.longitude,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
            }, 1000);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="small" color={theme.colors.gold} />
                <Text style={styles.loadingText}>GPS Uydularına Bağlanılıyor...</Text>
            </View>
        );
    }

    const initialRegion = myLocation ? {
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
    } : {
        latitude: 38.4237,
        longitude: 27.1428,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
    };

    const partnerDisplayName = partner === 'atakan' ? 'Atakan' : 'Cemre';
    const distanceText = calculateDistance();

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                provider={PROVIDER_DEFAULT}
                customMapStyle={mapDarkStyle}
                style={styles.map}
                initialRegion={initialRegion}
                showsUserLocation={false}
                showsCompass={false}
                showsMyLocationButton={false}
                toolbarEnabled={false}
                onLongPress={handleMapLongPress}
            >
                {/* BENİM PİNİM */}
                {myLocation && (
                    <>
                        <Circle
                            center={{ latitude: myLocation.latitude, longitude: myLocation.longitude }}
                            radius={myLocation.accuracy || 25}
                            fillColor="rgba(212, 175, 55, 0.15)"
                            strokeColor="rgba(212, 175, 55, 0.4)"
                            strokeWidth={1}
                        />
                        <Marker
                            coordinate={{ latitude: myLocation.latitude, longitude: myLocation.longitude }}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setMyInfoModal(true);
                            }}
                        >
                            <View style={[styles.avatarPin, user === 'atakan' ? styles.atakanPin : styles.cemrePin]}>
                                {user === 'atakan' ? (
                                    <Crown size={16} color={theme.colors.gold} />
                                ) : (
                                    <Gem size={15} color="#70D6FF" />
                                )}
                            </View>
                        </Marker>
                    </>
                )}

                {/* KARŞI TARAFIN PİNİ */}
                {partnerLocation && (
                    <>
                        <Circle
                            center={{ latitude: partnerLocation.latitude, longitude: partnerLocation.longitude }}
                            radius={partnerLocation.accuracy || 25}
                            fillColor={partner === 'atakan' ? 'rgba(212, 175, 55, 0.15)' : 'rgba(112, 214, 255, 0.15)'}
                            strokeColor={partner === 'atakan' ? 'rgba(212, 175, 55, 0.4)' : 'rgba(112, 214, 255, 0.4)'}
                            strokeWidth={1}
                        />
                        <Marker coordinate={{ latitude: partnerLocation.latitude, longitude: partnerLocation.longitude }}>
                            <View style={[styles.avatarPin, partner === 'atakan' ? styles.atakanPin : styles.cemrePin]}>
                                {partner === 'atakan' ? (
                                    <Crown size={16} color={theme.colors.gold} />
                                ) : (
                                    <Gem size={15} color="#70D6FF" />
                                )}
                            </View>
                        </Marker>
                    </>
                )}

                {/* MÜHÜRLENMİŞ ANILAR */}
                {memories.map((mem) => (
                    <Marker
                        key={mem.id}
                        coordinate={{ latitude: mem.latitude, longitude: mem.longitude }}
                        onPress={() => setActiveMemory(mem)}
                    >
                        <View style={styles.memoryPin}>
                            <Heart size={14} color="#08080B" fill="#08080B" />
                        </View>
                    </Marker>
                ))}
            </MapView>

            {/* ÜST BİLGİ PLAKASI */}
            <View style={styles.topInfoCard}>
                <MapPin size={14} color={theme.colors.gold} />
                <Text style={styles.topInfoText}>Anı mühürlemek için haritaya basılı tutun</Text>
            </View>

            {/* HIZLI ODAKLANMA BUTONLARI */}
            <View style={styles.fabContainer}>
                <TouchableOpacity style={styles.fabBtn} onPress={focusOnPartner} activeOpacity={0.8}>
                    {partner === 'atakan' ? <Crown size={18} color={theme.colors.gold} /> : <Gem size={18} color="#70D6FF" />}
                </TouchableOpacity>

                <TouchableOpacity style={styles.fabBtn} onPress={focusOnMe} activeOpacity={0.8}>
                    <Navigation size={18} color={theme.colors.goldLight} />
                </TouchableOpacity>
            </View>

            {/* MODAL 1: KENDİ KONUM VE MESAFE BİLGİ KARTI */}
            <Modal
                visible={myInfoModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setMyInfoModal(false)}
            >
                <View style={styles.bottomSheetOverlay}>
                    <TouchableOpacity
                        style={styles.backdropPressable}
                        activeOpacity={1}
                        onPress={() => setMyInfoModal(false)}
                    />

                    <View style={styles.bottomSheetContent}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Compass size={18} color={theme.colors.gold} />
                                <Text style={styles.modalTitle}>Canlı Konum Durumum</Text>
                            </View>
                            <TouchableOpacity onPress={() => setMyInfoModal(false)}>
                                <X size={20} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.infoRowGrid}>
                            <View style={styles.infoBox}>
                                <Crosshair size={16} color={theme.colors.gold} />
                                <Text style={styles.infoBoxLabel}>GPS Hassasiyeti</Text>
                                <Text style={styles.infoBoxValue}>±{Math.round(myLocation?.accuracy || 10)} metre</Text>
                            </View>

                            <View style={styles.infoBox}>
                                <Clock size={16} color={theme.colors.gold} />
                                <Text style={styles.infoBoxLabel}>Son Güncelleme</Text>
                                <Text style={styles.infoBoxValue}>
                                    {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.distanceBanner}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                {partner === 'atakan' ? <Crown size={18} color={theme.colors.gold} /> : <Gem size={18} color="#70D6FF" />}
                                <Text style={styles.distanceTitle}>
                                    {distanceText
                                        ? `${partnerDisplayName} ile aranızda ${distanceText} var.`
                                        : `${partnerDisplayName} henüz konum paylaşmadı.`}
                                </Text>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.routeBtn, !partnerLocation && { opacity: 0.5 }]}
                            onPress={openDirectionsToPartner}
                            disabled={!partnerLocation}
                            activeOpacity={0.8}
                        >
                            <CornerUpRight size={18} color="#08080B" />
                            <Text style={styles.routeBtnText}>{partnerDisplayName}'nin Yanına Rota Oluştur</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL 2: YENİ ANI MÜHÜRLE */}
            <Modal visible={sealModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Heart size={18} color={theme.colors.gold} fill={theme.colors.gold} />
                                <Text style={styles.modalTitle}>Anı Mühürle</Text>
                            </View>
                            <TouchableOpacity onPress={() => setSealModal(false)}>
                                <X size={20} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Anı Başlığı (Örn: İlk Kahvemiz)"
                            placeholderTextColor={theme.colors.textSecondary}
                            value={memoryTitle}
                            onChangeText={setMemoryTitle}
                        />

                        <TextInput
                            style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                            placeholder="O güne dair küçük bir not..."
                            placeholderTextColor={theme.colors.textSecondary}
                            value={memoryNote}
                            onChangeText={setMemoryNote}
                            multiline
                        />

                        <TouchableOpacity
                            style={styles.saveBtn}
                            onPress={handleSaveMemory}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.saveBtnText}>Bu Noktayı Mühürle</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MODAL 3: SEÇİLEN ANIYI GÖRÜNTÜLE & SİL */}
            <Modal visible={!!activeMemory} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, styles.memoryCard]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <Heart size={18} color={theme.colors.gold} fill={theme.colors.gold} />
                                <Text style={[styles.modalTitle, { flex: 1 }]} numberOfLines={1}>
                                    {activeMemory?.title}
                                </Text>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                                {/* SİLME BUTONU */}
                                <TouchableOpacity
                                    onPress={() => handleDeleteMemory(activeMemory?.id)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Trash2 size={18} color="#FF6B6B" />
                                </TouchableOpacity>

                                {/* KAPATMA BUTONU */}
                                <TouchableOpacity onPress={() => setActiveMemory(null)}>
                                    <X size={20} color={theme.colors.textSecondary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <Text style={styles.memoryNote}>{activeMemory?.note || 'Not eklenmemiş.'}</Text>

                        <View style={styles.memoryFooter}>
                            <View style={styles.memoryAuthorRow}>
                                <Text style={styles.memoryAuthorLabel}>Mühürleyen:</Text>
                                {activeMemory?.author === 'atakan' ? (
                                    <Crown size={13} color={theme.colors.gold} />
                                ) : (
                                    <Gem size={13} color="#70D6FF" />
                                )}
                                <Text style={styles.memoryAuthorName}>
                                    {activeMemory?.author === 'atakan' ? 'Atakan' : 'Cemre'}
                                </Text>
                            </View>

                            <Text style={styles.memoryDate}>
                                {activeMemory?.timestamp && new Date(activeMemory.timestamp).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    map: {
        flex: 1,
    },
    center: {
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontFamily: theme.fonts.body,
        color: theme.colors.textSecondary,
        fontSize: 13,
    },
    avatarPin: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#121218',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        elevation: 6,
    },
    atakanPin: {
        borderColor: theme.colors.gold,
    },
    cemrePin: {
        borderColor: '#70D6FF',
    },
    memoryPin: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: theme.colors.gold,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        elevation: 4,
    },
    topInfoCard: {
        position: 'absolute',
        top: 16,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(18, 18, 24, 0.85)',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.cardBorder,
    },
    topInfoText: {
        fontFamily: theme.fonts.body,
        color: theme.colors.textPrimary,
        fontSize: 11,
    },
    fabContainer: {
        position: 'absolute',
        right: 18,
        bottom: 32,
        gap: 12,
    },
    fabBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#121218',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.cardBorder,
        elevation: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        padding: 24,
    },
    modalContent: {
        backgroundColor: '#121218',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.colors.cardBorder,
        padding: 20,
    },
    bottomSheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'flex-end',
    },
    backdropPressable: {
        flex: 1,
        width: '100%',
    },
    bottomSheetContent: {
        backgroundColor: '#121218',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: theme.colors.cardBorder,
        paddingHorizontal: 22,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 48 : 68,
    },
    sheetHandle: {
        width: 38,
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    memoryCard: {
        backgroundColor: '#15151D',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        marginBottom: 16,
    },
    modalTitle: {
        fontFamily: theme.fonts.heading,
        color: theme.colors.goldLight,
        fontSize: 16,
        letterSpacing: 1,
    },
    infoRowGrid: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 14,
    },
    infoBox: {
        flex: 1,
        backgroundColor: '#161622',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        gap: 4,
    },
    infoBoxLabel: {
        fontFamily: theme.fonts.body,
        color: theme.colors.textSecondary,
        fontSize: 10.5,
        marginTop: 2,
    },
    infoBoxValue: {
        fontFamily: theme.fonts.bodyBold,
        color: theme.colors.textPrimary,
        fontSize: 12.5,
    },
    distanceBanner: {
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    distanceTitle: {
        fontFamily: theme.fonts.bodyBold,
        color: theme.colors.goldLight,
        fontSize: 12.5,
        flex: 1,
    },
    routeBtn: {
        backgroundColor: theme.colors.gold,
        borderRadius: 16,
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    routeBtnText: {
        fontFamily: theme.fonts.bodyBold,
        color: '#08080B',
        fontSize: 13,
    },
    input: {
        backgroundColor: '#09090C',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        color: '#FFF',
        padding: 14,
        marginBottom: 12,
        fontFamily: theme.fonts.body,
        fontSize: 13,
    },
    saveBtn: {
        backgroundColor: theme.colors.gold,
        borderRadius: 14,
        paddingVertical: 13,
        alignItems: 'center',
        marginTop: 6,
    },
    saveBtnText: {
        fontFamily: theme.fonts.bodyBold,
        color: '#08080B',
        fontSize: 13,
    },
    memoryNote: {
        fontFamily: theme.fonts.body,
        color: theme.colors.textPrimary,
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 16,
    },
    memoryFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    memoryAuthorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    memoryAuthorLabel: {
        fontFamily: theme.fonts.body,
        color: theme.colors.textSecondary,
        fontSize: 11,
    },
    memoryAuthorName: {
        fontFamily: theme.fonts.bodyBold,
        color: theme.colors.goldLight,
        fontSize: 11,
    },
    memoryDate: {
        fontFamily: theme.fonts.body,
        color: theme.colors.textSecondary,
        fontSize: 11,
    },
});