import React, { useState, useEffect, useContext, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput, 
  Animated, 
  Easing, 
  Dimensions 
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ref, onValue, set, push } from 'firebase/database';
import { db } from '../config/firebase';
import { UserContext } from '../context/UserContext';
import { theme } from '../theme/colors';
import { 
  Gamepad2, 
  Disc, 
  Tv, 
  Crown, 
  Gem, 
  RotateCcw, 
  Sparkles,
  Heart
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

// 16:9 Kusursuz Video Ölçüsü
const PLAYER_WIDTH = width - 40;
const PLAYER_HEIGHT = Math.round((PLAYER_WIDTH * 9) / 16);

const WHEEL_TASKS = [
  "30 saniye gözlerinin içine bakarak sarılın 💖",
  "Ona en sevdiğin huyunu fısılda ✨",
  "Sıcak bir kahve veya sevdiği bir içeceği ısmarla ☕",
  "Birlikte çekildiğiniz ilk fotoğrafı açıp anın 📸",
  "Yanağına uzun ve huzurlu bir öpücük kondur 💋",
  "En sevdiğiniz şarkıda 1 dakika dans edin 🎶",
  "Ona 5 dakikalık omuz masajı yap 💆‍♂️",
  "Bugün sevgilinin 1 dileğini koşulsuz yerine getir 👑"
];

const normalizeBoard = (rawBoard) => {
  const defaultBoard = Array(9).fill('');
  if (!rawBoard) return defaultBoard;
  if (Array.isArray(rawBoard)) {
    return Array.from({ length: 9 }, (_, i) => rawBoard[i] || '');
  }
  if (typeof rawBoard === 'object') {
    return Array.from({ length: 9 }, (_, i) => rawBoard[i] || '');
  }
  return defaultBoard;
};

export default function FunScreen({ subTab = 'xox', setSubTab }) {
  const { user } = useContext(UserContext);

  // ================= XOX OYUNU DURUMU =================
  const [board, setBoard] = useState(Array(9).fill(''));
  const [turn, setTurn] = useState('atakan');
  const [startingTurn, setStartingTurn] = useState('atakan'); // Eli başlatan oyuncu
  const [scores, setScores] = useState({ atakan: 0, cemre: 0 });
  const [winner, setWinner] = useState(null);
  const [winningLine, setWinningLine] = useState([]);

  // ================= ÇARKIFELEK DURUMU =================
  const [spinning, setSpinning] = useState(false);
  const [currentTask, setCurrentTask] = useState('');
  const spinAnim = useRef(new Animated.Value(0)).current;

  // ================= YOUTUBE SENKRON DURUMU =================
  const [inputUrl, setInputUrl] = useState('');

  useEffect(() => {
    const xoxRef = ref(db, 'games/xox');
    const unsubXox = onValue(xoxRef, (snap) => {
      if (snap.exists()) {
        const val = snap.val();
        setBoard(normalizeBoard(val.board));
        setTurn(val.turn || 'atakan');
        setStartingTurn(val.startingTurn || 'atakan');
        setScores(val.scores || { atakan: 0, cemre: 0 });
        setWinner(val.winner || null);
        setWinningLine(val.line || []);
      } else {
        resetXox();
      }
    });

    const wheelRef = ref(db, 'games/wheel');
    const unsubWheel = onValue(wheelRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        if (data.isSpinning && data.timestamp > Date.now() - 5000) {
          executeSpinAnimation(data.targetDeg, data.taskIndex);
        }
      }
    });

    return () => {
      unsubXox();
      unsubWheel();
    };
  }, [startingTurn]);

  const checkWinner = (squares) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a], line: [a, b, c] };
      }
    }
    if (squares.every(s => s && s !== '')) return { winner: 'draw', line: [] };
    return null;
  };

  const handleCellPress = (index) => {
    if (board[index] || winner || turn !== user) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newBoard = [...board];
    newBoard[index] = user;

    const result = checkWinner(newBoard);
    const gameWinner = result ? result.winner : null;
    const gameLine = result ? result.line : [];
    const nextTurn = user === 'atakan' ? 'cemre' : 'atakan';

    let newScores = { ...scores };
    if (gameWinner && gameWinner !== 'draw') {
      newScores[gameWinner] = (newScores[gameWinner] || 0) + 1;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    set(ref(db, 'games/xox'), {
      board: newBoard,
      turn: nextTurn,
      startingTurn: startingTurn,
      scores: newScores,
      winner: gameWinner,
      line: gameLine
    });
  };

  const resetXox = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Sıradaki oyuna önceki eli başlatanın tersi başlar
    const nextStarter = startingTurn === 'atakan' ? 'cemre' : 'atakan';
    
    set(ref(db, 'games/xox'), {
      board: Array(9).fill(''),
      turn: nextStarter,
      startingTurn: nextStarter,
      scores: scores,
      winner: null,
      line: []
    });
  };

  const triggerSpin = () => {
    if (spinning) return;
    const randomIndex = Math.floor(Math.random() * WHEEL_TASKS.length);
    const segmentDegree = 360 / WHEEL_TASKS.length;
    const targetDeg = (360 * 5) + (randomIndex * segmentDegree) + (segmentDegree / 2);

    set(ref(db, 'games/wheel'), {
      isSpinning: true,
      targetDeg: targetDeg,
      taskIndex: randomIndex,
      timestamp: Date.now()
    });

    push(ref(db, 'activity_logs'), {
      user: user,
      action: `${user === 'atakan' ? 'Atakan' : 'Cemre'} aşk çarkını çevirdi!`,
      timestamp: Date.now()
    });
  };

  const executeSpinAnimation = (deg, taskIdx) => {
    setSpinning(true);
    setCurrentTask('');
    spinAnim.setValue(0);

    Animated.timing(spinAnim, {
      toValue: deg,
      duration: 4000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSpinning(false);
      setCurrentTask(WHEEL_TASKS[taskIdx]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  const handleUpdateVideo = () => {
    if (!inputUrl.trim()) return;
    let extractedId = inputUrl.trim();
    if (inputUrl.includes('v=')) {
      extractedId = inputUrl.split('v=')[1].split('&')[0];
    } else if (inputUrl.includes('youtu.be/')) {
      extractedId = inputUrl.split('youtu.be/')[1].split('?')[0];
    }

    set(ref(db, 'games/youtube'), {
      videoId: extractedId,
      playing: true,
      currentTime: 0,
      timestamp: Date.now()
    });
    setInputUrl('');
  };

  const spinInterpolation = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg']
  });

  return (
    <View style={styles.container}>
      <View style={styles.subTabBar}>
        <TouchableOpacity 
          style={[styles.subTabItem, subTab === 'xox' && styles.subTabActive]} 
          onPress={() => setSubTab('xox')}
        >
          <Gamepad2 size={16} color={subTab === 'xox' ? theme.colors.gold : theme.colors.textSecondary} />
          <Text style={[styles.subTabText, subTab === 'xox' && styles.subTabTextActive]}>Aşk XOX'u</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.subTabItem, subTab === 'wheel' && styles.subTabActive]} 
          onPress={() => setSubTab('wheel')}
        >
          <Disc size={16} color={subTab === 'wheel' ? theme.colors.gold : theme.colors.textSecondary} />
          <Text style={[styles.subTabText, subTab === 'wheel' && styles.subTabTextActive]}>Çarkıfelek</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.subTabItem, subTab === 'watch' && styles.subTabActive]} 
          onPress={() => setSubTab('watch')}
        >
          <Tv size={16} color={subTab === 'watch' ? theme.colors.gold : theme.colors.textSecondary} />
          <Text style={[styles.subTabText, subTab === 'watch' && styles.subTabTextActive]}>Birlikte İzle</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        scrollEnabled={subTab !== 'watch'}
      >
        {/* ======================= XOX OYUNU ======================= */}
        {subTab === 'xox' && (
          <View style={styles.gameWrapper}>
            <View style={styles.scoreRow}>
              <View style={[styles.playerBadge, turn === 'atakan' && styles.activePlayer]}>
                <Crown size={16} color={theme.colors.gold} />
                <Text style={styles.playerName}>Atakan: {scores.atakan}</Text>
              </View>

              <Text style={styles.vsText}>VS</Text>

              <View style={[styles.playerBadge, turn === 'cemre' && styles.activePlayer]}>
                <Gem size={15} color="#70D6FF" />
                <Text style={styles.playerName}>Cemre: {scores.cemre}</Text>
              </View>
            </View>

            <Text style={styles.statusText}>
              {winner 
                ? (winner === 'draw' ? 'Dostluk kazandı!' : `${winner === 'atakan' ? 'Atakan' : 'Cemre'} Kazandı! 🎉`)
                : `Sıra: ${turn === 'atakan' ? 'Atakan\'da' : 'Cemre\'de'}`}
            </Text>

            <View style={styles.board}>
              {board.map((cell, idx) => {
                const isWinningCell = winningLine.includes(idx);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.cell,
                      isWinningCell && styles.winningCell
                    ]}
                    onPress={() => handleCellPress(idx)}
                    activeOpacity={0.8}
                  >
                    {cell === 'atakan' && <Crown size={32} color={theme.colors.gold} />}
                    {cell === 'cemre' && <Gem size={30} color="#70D6FF" />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.resetBtn} onPress={resetXox} activeOpacity={0.8}>
              <RotateCcw size={16} color={theme.colors.gold} />
              <Text style={styles.resetBtnText}>Yeniden Başlat</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ======================= ÇARKIFELEK ======================= */}
        {subTab === 'wheel' && (
          <View style={styles.gameWrapper}>
            <Text style={styles.wheelHeaderTitle}>Romantik Görev Çarkı</Text>
            <Text style={styles.wheelHeaderSub}>Çevirildiğinde iki ekranda aynı anda döner ✨</Text>

            <View style={styles.wheelContainer}>
              <View style={styles.wheelPointer} />
              <Animated.View style={[styles.wheelCircle, { transform: [{ rotate: spinInterpolation }] }]}>
                {WHEEL_TASKS.map((_, i) => (
                  <View 
                    key={i} 
                    style={[
                      styles.wheelSegmentLine, 
                      { transform: [{ rotate: `${i * (360 / WHEEL_TASKS.length)}deg` }] }
                    ]} 
                  />
                ))}
                <View style={styles.wheelCenter}>
                  <Heart size={24} color={theme.colors.gold} fill={theme.colors.gold} />
                </View>
              </Animated.View>
            </View>

            {currentTask ? (
              <View style={styles.taskCard}>
                <Sparkles size={18} color={theme.colors.gold} />
                <Text style={styles.taskText}>{currentTask}</Text>
              </View>
            ) : null}

            <TouchableOpacity 
              style={[styles.spinBtn, spinning && { opacity: 0.5 }]} 
              onPress={triggerSpin}
              disabled={spinning}
              activeOpacity={0.8}
            >
              <Text style={styles.spinBtnText}>{spinning ? 'Dönüyor...' : 'Kaderi Çevir'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ======================= BİRLİKTE İZLE ======================= */}
        {subTab === 'watch' && (
          <View style={styles.gameWrapper}>
            <View style={styles.playerPlaceholder} />

            <View style={styles.urlInputCard}>
              <Text style={styles.inputCardLabel}>YOUTUBE VİDEO LİNKİ VEYA ID</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.urlInput}
                  placeholder="https://youtu.be/... ya da video ID"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={inputUrl}
                  onChangeText={setInputUrl}
                />
                <TouchableOpacity style={styles.urlSetBtn} onPress={handleUpdateVideo} activeOpacity={0.8}>
                  <Text style={styles.urlSetBtnText}>Yükle</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  subTabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  subTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
    backgroundColor: '#121218',
  },
  subTabActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: theme.colors.gold,
  },
  subTabText: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  subTabTextActive: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.goldLight,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  gameWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  playerPlaceholder: {
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    marginBottom: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  playerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#14141B',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  activePlayer: {
    borderColor: theme.colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  playerName: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
  vsText: {
    fontFamily: theme.fonts.heading,
    color: theme.colors.gold,
    fontSize: 13,
  },
  statusText: {
    fontFamily: theme.fonts.heading,
    color: theme.colors.goldLight,
    fontSize: 15,
    marginBottom: 16,
  },
  board: {
    width: 270,
    height: 270,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 20,
  },
  cell: {
    width: 80,
    height: 80,
    backgroundColor: '#14141B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  winningCell: {
    borderColor: theme.colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
    borderWidth: 2,
    shadowColor: theme.colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    backgroundColor: '#121218',
  },
  resetBtnText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.gold,
    fontSize: 12,
  },
  wheelHeaderTitle: {
    fontFamily: theme.fonts.heading,
    fontSize: 20,
    color: theme.colors.goldLight,
    marginBottom: 4,
  },
  wheelHeaderSub: {
    fontFamily: theme.fonts.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 24,
  },
  wheelContainer: {
    width: 250,
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  wheelPointer: {
    position: 'absolute',
    top: -12,
    zIndex: 10,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: theme.colors.gold,
    transform: [{ rotate: '180deg' }],
  },
  wheelCircle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#151520',
    borderWidth: 3,
    borderColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  wheelSegmentLine: {
    position: 'absolute',
    width: 2,
    height: 240,
    backgroundColor: 'rgba(212, 175, 55, 0.25)',
  },
  wheelCenter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#0E0E14',
    borderWidth: 2,
    borderColor: theme.colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1A1820',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.gold,
    marginTop: 20,
    maxWidth: '90%',
  },
  taskText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.goldLight,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  spinBtn: {
    marginTop: 24,
    backgroundColor: theme.colors.gold,
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 16,
  },
  spinBtnText: {
    fontFamily: theme.fonts.bodyBold,
    color: '#08080B',
    fontSize: 14,
  },
  urlInputCard: {
    width: '100%',
    backgroundColor: '#111116',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  inputCardLabel: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.gold,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  urlInput: {
    flex: 1,
    backgroundColor: '#09090C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#FFF',
    paddingHorizontal: 12,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    height: 42,
  },
  urlSetBtn: {
    backgroundColor: '#1D1D27',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  urlSetBtnText: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.goldLight,
    fontSize: 12,
  },
});