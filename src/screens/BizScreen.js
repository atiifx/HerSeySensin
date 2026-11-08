import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Modal,
  TextInput,
  FlatList,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { WebView } from 'react-native-webview';
import { ref, onValue, set, runTransaction, push, update, onDisconnect } from 'firebase/database';
import { db } from '../config/firebase';
import { UserContext } from '../context/UserContext';
import { theme } from '../theme/colors';
import { sendPushNotificationToPartner } from '../utils/notifications';
import {
  Heart,
  Sun,
  Moon,
  Sparkles,
  Mail,
  Send,
  Archive,
  X,
  Star,
  PenTool
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const START_DATE = new Date('2026-06-08T00:00:00').getTime();

export default function BizScreen() {
  const { user, partner } = useContext(UserContext);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [heartbeats, setHeartbeats] = useState(0);
  const [thinkCount, setThinkCount] = useState(0);
  const [isHugging, setIsHugging] = useState(false);
  const [partnerHugging, setPartnerHugging] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Mektup & Sandık Durumları
  const [letters, setLetters] = useState([]);
  const [writeModal, setWriteModal] = useState(false);
  const [archiveModal, setArchiveModal] = useState(false);
  const [activeLetterModal, setActiveLetterModal] = useState(null);
  const [letterText, setLetterText] = useState('');

  // Animasyonlar & Referanslar
  const auraAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const heartbeatIntervalRef = useRef(null);
  const hasLoggedMutualHugRef = useRef(false);
  const soundEngineRef = useRef(null);

  // 1. Canlı Sayaç & Kalp Atışı
  useEffect(() => {
    const updateCounter = () => {
      const now = Date.now();
      const diff = Math.max(0, now - START_DATE);

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
      const totalSeconds = Math.floor(diff / 1000);
      setHeartbeats(Math.floor(totalSeconds * 2.5));
    };

    updateCounter();
    const interval = setInterval(updateCounter, 1000);
    return () => clearInterval(interval);
  }, []);

  // 2. Tane Tane Çizgili Halkanın Kesintisiz Dönüş Animasyonu
  useEffect(() => {
    let isMounted = true;

    const startContinuousSpin = () => {
      if (!isMounted) return;
      rotateAnim.setValue(0);
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && isMounted) {
          startContinuousSpin();
        }
      });
    };

    startContinuousSpin();

    return () => {
      isMounted = false;
      rotateAnim.stopAnimation();
    };
  }, [rotateAnim]);

  // 3. Açılışta Asılı Kalan Sarılma Verilerini Sıfırla
  useEffect(() => {
    if (user) {
      set(ref(db, `hugs/${user}`), null);
      onDisconnect(ref(db, `hugs/${user}`)).set(null);
    }
  }, [user]);

  // 4. Firebase Dinleyicileri
  useEffect(() => {
    const thinkRef = ref(db, 'counters/thinking_count');
    const unsubThink = onValue(thinkRef, (snap) => {
      if (snap.exists()) setThinkCount(snap.val());
    });

    let unsubHug = () => { };
    if (partner) {
      const hugRef = ref(db, `hugs/${partner}`);
      unsubHug = onValue(hugRef, (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          if (val && val.active === true && (Date.now() - (val.timestamp || 0) < 4000)) {
            setPartnerHugging(true);
            return;
          }
        }
        setPartnerHugging(false);
      });
    }

    const lettersRef = ref(db, 'letters');
    const unsubLetters = onValue(lettersRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list = Object.keys(data).map(k => ({ id: k, ...data[k] })).reverse();
        setLetters(list);
      } else {
        setLetters([]);
      }
    });

    return () => {
      unsubThink();
      unsubHug();
      unsubLetters();
    };
  }, [partner]);

  const isBothHugging = isHugging && partnerHugging;
  const partnerDisplayName = partner === 'atakan' ? 'Atakan' : 'Cemre';

  // 5. Senkronize Kalp Titreşim Döngüsü & Karşılıklı Sarılma Günlüğü
  useEffect(() => {
    if (isBothHugging) {
      if (!hasLoggedMutualHugRef.current) {
        hasLoggedMutualHugRef.current = true;
        if (user === 'atakan') {
          push(ref(db, 'activity_logs'), {
            user: 'biz',
            action: 'Atakan ve Cemre birbirine sımsıkı sarıldı.',
            timestamp: Date.now()
          });
        }
      }

      const pulseHeart = async () => {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          setTimeout(async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }, 140);
        } catch (e) {
          console.log(e);
        }
      };

      pulseHeart();
      heartbeatIntervalRef.current = setInterval(pulseHeart, 1100);
    } else {
      hasLoggedMutualHugRef.current = false;
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [isBothHugging, user]);

  // "Seni Düşünüyorum" Tetikleyici
  const handleThinkOfYou = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowConfetti(true);

    if (soundEngineRef.current) {
      soundEngineRef.current.injectJavaScript(`
        (function() {
          try {
            var ctx = new (window.AudioContext || window.webkitAudioContext)();
            var notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
            notes.forEach(function(freq, i) {
              setTimeout(function() {
                var osc = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 1.2);
              }, i * 75);
            });
            var audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3");
            audio.volume = 0.8;
            audio.play().catch(function(e){});
          } catch(e) {}
        })();
        true;
      `);
    }

    const thinkRef = ref(db, 'counters/thinking_count');
    runTransaction(thinkRef, (current) => (current || 0) + 1);

    const senderName = user === 'atakan' ? 'Atakan' : 'Cemre';
    const partnerTargetName = user === 'atakan' ? "Cemre'yi" : "Atakan'ı";

    push(ref(db, 'activity_logs'), {
      user: user,
      action: `${senderName}, ${partnerTargetName} düşündü.`,
      timestamp: Date.now()
    });

    sendPushNotificationToPartner(
      partner,
      'Seni Düşünüyor',
      `${senderName} şu an kalbinden seni geçirdi.`
    );
  };

  // Ritüeller
  const sendRitual = (type) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const actionText = type === 'morning'
      ? `${user === 'atakan' ? 'Atakan' : 'Cemre'} sana günaydın dedi.`
      : `${user === 'atakan' ? 'Atakan' : 'Cemre'} sana iyi geceler diledi.`;

    push(ref(db, 'activity_logs'), {
      user: user,
      action: actionText,
      timestamp: Date.now()
    });

    sendPushNotificationToPartner(
      partner,
      type === 'morning' ? 'Günaydın Sevgilim' : 'İyi Geceler Ruhum',
      actionText
    );
  };

  // Sanal Sarılma
  const startHug = () => {
    setIsHugging(true);
    set(ref(db, `hugs/${user}`), {
      active: true,
      timestamp: Date.now()
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    push(ref(db, 'activity_logs'), {
      user: user,
      action: `${user === 'atakan' ? 'Atakan' : 'Cemre'}, sarılmak için parmağını basılı tuttu.`,
      timestamp: Date.now()
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(auraAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(auraAnim, { toValue: 1, duration: 600, useNativeDriver: true })
      ])
    ).start();
  };

  const endHug = () => {
    setIsHugging(false);
    set(ref(db, `hugs/${user}`), null);
    auraAnim.stopAnimation();
    auraAnim.setValue(1);

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  // Mektup Gönderme
  const handleSendLetter = () => {
    if (!letterText.trim()) return;

    push(ref(db, 'letters'), {
      sender: user,
      receiver: partner,
      text: letterText.trim(),
      timestamp: Date.now(),
      isRead: false,
      isFavorite: false,
    });

    push(ref(db, 'activity_logs'), {
      user: user,
      action: `${user === 'atakan' ? 'Atakan' : 'Cemre'} Aşk Sandığı'na yeni bir not bıraktı.`,
      timestamp: Date.now()
    });

    sendPushNotificationToPartner(
      partner,
      'Yeni Bir Aşk Mektubu',
      `${user === 'atakan' ? 'Atakan' : 'Cemre'} Aşk Sandığı'na senin için mühürlü bir mektup bıraktı.`
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLetterText('');
    setWriteModal(false);
  };

  const toggleFavorite = (letterId, currentFav) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    update(ref(db, `letters/${letterId}`), {
      isFavorite: !currentFav
    });
  };

  const openLetter = (letter) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveLetterModal(letter);
    if (!letter.isRead && letter.receiver === user) {
      update(ref(db, `letters/${letter.id}`), { isRead: true });
    }
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const latestLetter = letters.length > 0 ? letters[0] : null;

  let ringColor = 'rgba(212, 175, 55, 0.45)';
  let hugStatusLabel = 'Beklemede';
  let hugStatusBadgeStyle = styles.badgeIdle;
  let hugHintText = 'Parmağını basılı tutarak temas başlat...';

  if (isBothHugging) {
    ringColor = '#FF2D55';
    hugStatusLabel = 'Sarılıyorsunuz';
    hugStatusBadgeStyle = styles.badgeBoth;
    hugHintText = 'Kalpleriniz birleşti, şu an birbirinize sarılıyorsunuz...';
  } else if (partnerHugging) {
    ringColor = '#32D74B';
    hugStatusLabel = `${partnerDisplayName} Dokunuyor!`;
    hugStatusBadgeStyle = styles.badgePartner;
    hugHintText = `${partnerDisplayName} ekrana dokunuyor, sen de bas ve sarılın...`;
  } else if (isHugging) {
    ringColor = '#FF2D55';
    hugStatusLabel = 'Bekleniyor...';
    hugStatusBadgeStyle = styles.badgeWaiting;
    hugHintText = `Parmağını çekme, ${partnerDisplayName} bekleniyor...`;
  }

  const getNoteBadgeLabel = () => {
    if (!latestLetter) return 'Aşk Sandığı';
    const isAtakan = latestLetter.sender === 'atakan';
    return isAtakan ? "Atakan'dan Not" : "Cemre'den Not";
  };

  return (
    <View style={styles.mainWrapper}>
      {/* Gizli Web Audio Arp Ses Motoru */}
      <View style={{ width: 0, height: 0, position: 'absolute', opacity: 0 }}>
        <WebView
          ref={soundEngineRef}
          source={{ html: '<html><body></body></html>' }}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          javaScriptEnabled={true}
        />
      </View>

      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.content}
        scrollEnabled={!isHugging}
      >
        {/* ==================== ÜST BAŞLIK ==================== */}
        <View style={styles.heroHeader}>
          <View style={styles.namesRow}>
            <Text style={styles.heroNames}>A T A K A N</Text>
            <Text style={styles.heroDiamond}>✦</Text>
            <Text style={styles.heroNames}>C E M R E</Text>
          </View>
          <Text style={styles.heroTitle}>SONSUZ AŞKIN TAKVİMİ</Text>
          <Text style={styles.heroSubtitle}>
            İlk günden bu yana geçen her saniye sana adandı.
          </Text>
        </View>

        {/* SAYAÇ KARTI */}
        <View style={styles.counterCard}>
          <Text style={styles.sinceLabel}>8 HAZİRAN 2026'DAN BERİ</Text>
          <View style={styles.timerRow}>
            <View style={styles.timeUnit}>
              <Text style={styles.timeNumber}>{timeLeft.days}</Text>
              <Text style={styles.timeLabel}>GÜN</Text>
            </View>
            <Text style={styles.separator}>:</Text>
            <View style={styles.timeUnit}>
              <Text style={styles.timeNumber}>{String(timeLeft.hours).padStart(2, '0')}</Text>
              <Text style={styles.timeLabel}>SAAT</Text>
            </View>
            <Text style={styles.separator}>:</Text>
            <View style={styles.timeUnit}>
              <Text style={styles.timeNumber}>{String(timeLeft.minutes).padStart(2, '0')}</Text>
              <Text style={styles.timeLabel}>DK</Text>
            </View>
            <Text style={styles.separator}>:</Text>
            <View style={styles.timeUnit}>
              <Text style={styles.timeNumber}>{String(timeLeft.seconds).padStart(2, '0')}</Text>
              <Text style={styles.timeLabel}>SN</Text>
            </View>
          </View>

          <View style={styles.heartbeatRow}>
            <Heart size={14} color={theme.colors.accentPink} fill={theme.colors.accentPink} />
            <Text style={styles.heartbeatText}>
              Birlikte atılan ~{heartbeats.toLocaleString('tr-TR')} kalp atışı
            </Text>
          </View>
        </View>

        {/* RİTÜEL BUTONLARI */}
        <View style={styles.ritualContainer}>
          <TouchableOpacity
            style={styles.ritualButton}
            onPress={() => sendRitual('morning')}
            activeOpacity={0.7}
          >
            <Sun size={18} color="#FFD166" />
            <Text style={styles.ritualText}>Günaydın</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ritualButton}
            onPress={() => sendRitual('night')}
            activeOpacity={0.7}
          >
            <Moon size={18} color="#A0C4FF" />
            <Text style={styles.ritualText}>İyi Geceler</Text>
          </TouchableOpacity>
        </View>

        {/* SENİ DÜŞÜNÜYORUM */}
        <TouchableOpacity
          style={styles.thinkingCard}
          onPress={handleThinkOfYou}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#1F1A24', '#121218']}
            style={styles.thinkingGradient}
          >
            <View style={styles.thinkingIcon}>
              <Sparkles size={20} color={theme.colors.gold} />
            </View>
            <View style={{ flex: 1, paddingRight: 4 }}>
              <Text style={styles.thinkingTitle}>Seni Düşünüyorum</Text>
              <Text numberOfLines={1} style={styles.thinkingDesc}>
                Kalbine minik bir dokunuş bırak
              </Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{thinkCount}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ==================== 1. SARILMA & TEMAS ==================== */}
        <View style={styles.hugCard}>
          <View style={styles.hugHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Sparkles size={15} color={theme.colors.gold} />
              <Text style={styles.hugCardTitle}>SARILMA & TEMAS</Text>
            </View>
            <View style={[styles.statusBadge, hugStatusBadgeStyle]}>
              <Text style={styles.statusBadgeText}>{hugStatusLabel}</Text>
            </View>
          </View>

          <Text style={styles.hugCardDesc}>
            İkiniz aynı anda basılı tuttuğunuzda telefonlarınız birlikte titrer...
          </Text>

          {/* Dönen Çizgili Halka ve Kalp Butonu */}
          <View style={styles.hugInteractionArea}>
            <Animated.View
              style={[
                styles.dashedHalo,
                { borderColor: ringColor, transform: [{ rotate: spin }] }
              ]}
            />

            <Animated.View style={{ transform: [{ scale: auraAnim }] }}>
              <TouchableOpacity
                onPressIn={startHug}
                onPressOut={endHug}
                activeOpacity={1}
                delayPressIn={0}
                pressRetentionOffset={{ top: 100, bottom: 100, left: 100, right: 100 }}
                style={[
                  styles.innerHugBtn,
                  isBothHugging && styles.innerHugBtnBoth,
                  isHugging && !isBothHugging && styles.innerHugBtnHolding
                ]}
              >
                <Heart
                  size={36}
                  color={isBothHugging || isHugging ? '#FFFFFF' : theme.colors.gold}
                  fill={isBothHugging || isHugging ? '#FF2D55' : 'transparent'}
                />
                <Text style={[styles.innerHugLabel, (isBothHugging || isHugging) && { color: '#FFFFFF' }]}>
                  BASILI TUT
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <View style={styles.hugHintBox}>
            <Text style={styles.hugHintText}>{hugHintText}</Text>
          </View>
        </View>

        {/* ==================== 2. GÜNÜN SÜRPRİZ NOTU ==================== */}
        <View style={styles.letterCard}>
          <View style={styles.letterHeaderRow}>
            <View style={styles.letterHeaderLeft}>
              <Mail size={14} color={theme.colors.gold} />
              <Text style={styles.letterHeaderTitle}>GÜNÜN SÜRPRİZ NOTU</Text>
            </View>
            <View style={styles.newNoteBadge}>
              <Sparkles size={10} color={theme.colors.goldLight} />
              <Text style={styles.newNoteBadgeText}>{getNoteBadgeLabel()}</Text>
            </View>
          </View>

          {/* Ortadaki Zarf Simgesi */}
          <TouchableOpacity
            style={styles.envelopeCircle}
            onPress={() => latestLetter ? openLetter(latestLetter) : setWriteModal(true)}
            activeOpacity={0.8}
          >
            <Mail size={28} color={theme.colors.gold} />
          </TouchableOpacity>

          {/* Simetrik Alıntı Kutusu */}
          <View style={styles.quoteBox}>
            {latestLetter ? (
              <>
                <Text style={styles.quoteText}>"{latestLetter.text}"</Text>
                <Text style={styles.quoteAuthor}>
                  — {latestLetter.sender === 'atakan' ? 'Atakan' : 'Cemre'} ({new Date(latestLetter.timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })})
                </Text>
              </>
            ) : (
              <Text style={[styles.quoteText, { fontStyle: 'normal' }]}>
                Henüz sandıkta bir not yok. İlk aşk mektubunu bırakarak kalbini aç...
              </Text>
            )}
          </View>

          {/* Simetrik Butonlar */}
          <View style={styles.letterButtonsRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setWriteModal(true)}
              activeOpacity={0.8}
            >
              <PenTool size={15} color={theme.colors.gold} />
              <Text style={styles.actionBtnText}>YENİ NOT BIRAK</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setArchiveModal(true)}
              activeOpacity={0.8}
            >
              <Archive size={15} color={theme.colors.gold} />
              <Text style={styles.actionBtnText}>AŞK SANDIĞI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* KONFETİ */}
      {showConfetti && (
        <ConfettiCannon
          count={35}
          origin={{ x: width / 2, y: -20 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={2400}
          onAnimationEnd={() => setShowConfetti(false)}
          colors={['#D4AF37', '#F5E08F', '#FF2D55', '#FFFFFF']}
        />
      )}

      {/* MODAL 1: MEKTUP YAZ */}
      <Modal visible={writeModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mektup Bırak</Text>
              <TouchableOpacity onPress={() => setWriteModal(false)}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.letterInput}
              multiline
              placeholder="Ona kalbinden geçenleri yaz..."
              placeholderTextColor={theme.colors.textSecondary}
              value={letterText}
              onChangeText={setLetterText}
              autoFocus
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSendLetter}
              activeOpacity={0.8}
            >
              <Send size={18} color="#08080B" />
              <Text style={styles.sendButtonText}>Mühürle ve Gönder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: MEKTUP OKU */}
      <Modal visible={!!activeLetterModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.readEnvelope]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Aşk Mektubu</Text>
              <TouchableOpacity onPress={() => setActiveLetterModal(null)}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ marginVertical: 16 }}>
              <Text style={styles.readText}>{activeLetterModal?.text}</Text>
            </ScrollView>
            <Text style={styles.readDate}>
              {activeLetterModal?.timestamp && new Date(activeLetterModal.timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: AŞK SANDIĞI */}
      <Modal visible={archiveModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Archive size={18} color={theme.colors.gold} />
                <Text style={styles.modalTitle}>Aşk Sandığı</Text>
              </View>
              <TouchableOpacity onPress={() => setArchiveModal(false)}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={letters}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: 10 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.archiveItem}
                  onPress={() => openLetter(item)}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.archiveSender}>
                      {item.sender === 'atakan' ? 'Atakan' : 'Cemre'}
                    </Text>
                    <Text numberOfLines={2} style={styles.archivePreview}>
                      {item.text}
                    </Text>
                    <Text style={styles.archiveDate}>
                      {new Date(item.timestamp).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => toggleFavorite(item.id, item.isFavorite)}
                    style={{ padding: 6 }}
                  >
                    <Star
                      size={20}
                      color={item.isFavorite ? theme.colors.gold : theme.colors.textSecondary}
                      fill={item.isFavorite ? theme.colors.gold : 'transparent'}
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Sandıkta henüz hiç mektup yok.</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  heroHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 2,
    gap: 6,
  },
  namesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroNames: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.gold,
    fontSize: 11,
    letterSpacing: 3,
  },
  heroDiamond: {
    color: theme.colors.gold,
    fontSize: 10,
  },
  heroTitle: {
    fontFamily: theme.fonts.heading,
    color: theme.colors.goldLight,
    fontSize: 22,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  counterCard: {
    backgroundColor: '#111116',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: 20,
    alignItems: 'center',
  },
  sinceLabel: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.gold,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 16,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeUnit: {
    alignItems: 'center',
    minWidth: 54,
  },
  timeNumber: {
    fontFamily: theme.fonts.heading,
    fontSize: 28,
    color: theme.colors.textPrimary,
  },
  timeLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 2,
    letterSpacing: 1,
  },
  separator: {
    fontFamily: theme.fonts.heading,
    fontSize: 22,
    color: theme.colors.gold,
    paddingBottom: 14,
  },
  heartbeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  heartbeatText: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  ritualContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  ritualButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#121218',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ritualText: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  thinkingCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    overflow: 'hidden',
  },
  thinkingGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  thinkingIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#231B2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thinkingTitle: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.goldLight,
    fontSize: 14.5,
  },
  thinkingDesc: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#2A2415',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    minWidth: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontFamily: theme.fonts.heading,
    color: theme.colors.gold,
    fontSize: 14,
  },
  hugCard: {
    backgroundColor: '#111116',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: 20,
    alignItems: 'center',
  },
  hugHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hugCardTitle: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.gold,
    fontSize: 11,
    letterSpacing: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeIdle: {
    backgroundColor: '#161620',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badgeWaiting: {
    backgroundColor: 'rgba(255, 45, 85, 0.15)',
    borderColor: '#FF2D55',
  },
  badgePartner: {
    backgroundColor: 'rgba(50, 215, 75, 0.15)',
    borderColor: '#32D74B',
  },
  badgeBoth: {
    backgroundColor: 'rgba(255, 45, 85, 0.25)',
    borderColor: '#FF2D55',
  },
  statusBadgeText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.goldLight,
    fontSize: 11,
  },
  hugCardDesc: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  hugInteractionArea: {
    width: 170,
    height: 170,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 6,
  },
  dashedHalo: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  innerHugBtn: {
    width: 122,
    height: 122,
    borderRadius: 61,
    backgroundColor: '#161622',
    borderWidth: 2,
    borderColor: theme.colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  innerHugBtnHolding: {
    backgroundColor: 'rgba(255, 45, 85, 0.2)',
    borderColor: '#FF2D55',
  },
  innerHugBtnBoth: {
    backgroundColor: '#FF2D55',
    borderColor: '#FF2D55',
  },
  innerHugLabel: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    color: theme.colors.gold,
    letterSpacing: 1,
  },
  hugHintBox: {
    backgroundColor: '#161620',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginTop: 18,
    width: '100%',
    alignItems: 'center',
  },
  hugHintText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  letterCard: {
    backgroundColor: '#111116',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: 20,
    alignItems: 'center',
  },
  letterHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  letterHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  letterHeaderTitle: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.gold,
    fontSize: 10.5,
    letterSpacing: 0.8,
  },
  newNoteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#181822',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    flexShrink: 0,
  },
  newNoteBadgeText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.goldLight,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  envelopeCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#181824',
    borderWidth: 1.5,
    borderColor: theme.colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  quoteBox: {
    width: '100%',
    backgroundColor: '#14141B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    borderStyle: 'dashed',
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteText: {
    fontFamily: theme.fonts.body,
    fontStyle: 'italic',
    color: theme.colors.textPrimary,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: 'center',
  },
  quoteAuthor: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.gold,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    letterSpacing: 0.3,
  },
  letterButtonsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#161622',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.goldLight,
    fontSize: 11.5,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#121218',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: 20,
  },
  readEnvelope: {
    minHeight: 220,
    backgroundColor: '#15151D',
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
  letterInput: {
    height: 120,
    backgroundColor: '#09090C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#FFF',
    padding: 14,
    marginTop: 14,
    textAlignVertical: 'top',
    fontFamily: theme.fonts.body,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: theme.colors.gold,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 14,
    gap: 8,
  },
  sendButtonText: {
    fontFamily: theme.fonts.bodyBold,
    color: '#08080B',
    fontSize: 13,
  },
  readText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  readDate: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 11,
    textAlign: 'right',
  },
  archiveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#161620',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  archiveSender: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.goldLight,
    fontSize: 13,
    marginBottom: 4,
  },
  archivePreview: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  archiveDate: {
    fontFamily: theme.fonts.body,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 13,
  },
});