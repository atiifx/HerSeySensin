import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  TextInput, 
  Modal, 
  Alert,
  Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { ref, onValue, push, update, remove } from 'firebase/database';
import { db } from '../config/firebase';
import { UserContext } from '../context/UserContext';
import { theme } from '../theme/colors';
import { 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  Sparkles, 
  X, 
  Crown, 
  Gem, 
  Compass, 
  Heart, 
  Film, 
  Star 
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'gezi', label: 'Gezi & Rota', icon: Compass },
  { id: 'romantik', label: 'Romantik An', icon: Heart },
  { id: 'aktivite', label: 'Aktivite', icon: Film },
  { id: 'hayal', label: 'Büyük Hayal', icon: Star },
];

export default function PlanScreen() {
  const { user } = useContext(UserContext);
  const [plans, setPlans] = useState([]);
  const [filter, setFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedCat, setSelectedCat] = useState('gezi');
  const [showPlanConfetti, setShowPlanConfetti] = useState(false);

  useEffect(() => {
    const plansRef = ref(db, 'bucket_list');
    const unsub = onValue(plansRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).reverse();
        setPlans(list);
      } else {
        setPlans([]);
      }
    });

    return () => unsub();
  }, []);

  const handleAddPlan = () => {
    if (!newTitle.trim()) return;

    push(ref(db, 'bucket_list'), {
      title: newTitle.trim(),
      category: selectedCat,
      completed: false,
      createdBy: user,
      createdAt: Date.now(),
      completedBy: null,
      completedAt: null,
    });

    push(ref(db, 'activity_logs'), {
      user: user,
      action: `${user === 'atakan' ? 'Atakan' : 'Cemre'} yeni bir hayal ekledi: "${newTitle.trim()}" ✨`,
      timestamp: Date.now()
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewTitle('');
    setSelectedCat('gezi');
    setModalVisible(false);
  };

  const handleToggleComplete = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const willBeCompleted = !item.completed;

    if (willBeCompleted) {
      setShowPlanConfetti(true);
      push(ref(db, 'activity_logs'), {
        user: user,
        action: `${user === 'atakan' ? 'Atakan' : 'Cemre'} bir hayali gerçekleştirdi: "${item.title}" 🎉`,
        timestamp: Date.now()
      });
    }

    update(ref(db, `bucket_list/${item.id}`), {
      completed: willBeCompleted,
      completedBy: willBeCompleted ? user : null,
      completedAt: willBeCompleted ? Date.now() : null,
    });
  };

  const handleDeletePlan = (id, title) => {
    Alert.alert(
      'Hayali Sil',
      `"${title}" hedefini silmek istediğinize emin misiniz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { 
          text: 'Sil', 
          style: 'destructive', 
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            remove(ref(db, `bucket_list/${id}`));
          } 
        }
      ]
    );
  };

  const filteredPlans = plans.filter(p => {
    if (filter === 'pending') return !p.completed;
    if (filter === 'completed') return p.completed;
    return true;
  });

  const completedCount = plans.filter(p => p.completed).length;

  return (
    <View style={styles.container}>
      {/* ÜST İSTATİSTİK KARTI */}
      <View style={styles.summaryCard}>
        <LinearGradient
          colors={['#181822', '#0F0F14']}
          style={styles.summaryGradient}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryLabel}>BİRLİKTE BİRİKENLER</Text>
            <Text style={styles.summaryTitle}>Ortak Hayallerimiz</Text>
            <Text style={styles.summarySub}>
              {plans.length === 0 
                ? 'Henüz ortak bir hedef eklenmedi.' 
                : `${plans.length} hedefin ${completedCount}'i tamamlandı ✨`}
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.addTriggerBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <Plus size={22} color="#08080B" />
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* FİLTRELEME BUTONLARI */}
      <View style={styles.filterRow}>
        <TouchableOpacity 
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
            Tümü ({plans.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterChip, filter === 'pending' && styles.filterChipActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterChipText, filter === 'pending' && styles.filterChipTextActive]}>
            Bekleyenler ({plans.length - completedCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterChip, filter === 'completed' && styles.filterChipActive]}
          onPress={() => setFilter('completed')}
        >
          <Text style={[styles.filterChipText, filter === 'completed' && styles.filterChipTextActive]}>
            Tamamlananlar ({completedCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* HAYALLER LİSTESİ */}
      <FlatList
        data={filteredPlans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const CategoryIcon = CATEGORIES.find(c => c.id === item.category)?.icon || Sparkles;

          return (
            <View style={[styles.planCard, item.completed && styles.planCardCompleted]}>
              <TouchableOpacity 
                style={styles.checkBtn}
                onPress={() => handleToggleComplete(item)}
                activeOpacity={0.7}
              >
                {item.completed ? (
                  <CheckSquare size={22} color={theme.colors.gold} />
                ) : (
                  <Square size={22} color={theme.colors.textSecondary} />
                )}
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={[styles.planTitle, item.completed && styles.planTitleCompleted]}>
                  {item.title}
                </Text>

                <View style={styles.planMetaRow}>
                  <View style={styles.catBadge}>
                    <CategoryIcon size={11} color={theme.colors.goldLight} />
                    <Text style={styles.catText}>
                      {CATEGORIES.find(c => c.id === item.category)?.label || 'Hayal'}
                    </Text>
                  </View>

                  <View style={styles.authorBadge}>
                    {item.createdBy === 'atakan' ? (
                      <Crown size={11} color={theme.colors.gold} />
                    ) : (
                      <Gem size={10} color="#70D6FF" />
                    )}
                    <Text style={styles.authorText}>
                      {item.createdBy === 'atakan' ? 'Atakan' : 'Cemre'}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.deleteBtn}
                onPress={() => handleDeletePlan(item.id, item.title)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Trash2 size={16} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Sparkles size={32} color={theme.colors.cardBorder} />
            <Text style={styles.emptyText}>Bu listede henüz hiçbir hayal yok.</Text>
          </View>
        }
      />

      {/* PLAN TAMAMLAMA KONFETİSİ */}
      {showPlanConfetti && (
        <ConfettiCannon
          count={40}
          origin={{ x: width / 2, y: -20 }}
          autoStart={true}
          fadeOut={true}
          fallSpeed={2200}
          onAnimationEnd={() => setShowPlanConfetti(false)}
          colors={['#D4AF37', '#F5E08F', '#32D74B', '#FFFFFF']}
        />
      )}

      {/* MODAL: YENİ HAYAL EKLE */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color={theme.colors.gold} />
                <Text style={styles.modalTitle}>Yeni Hayal Ekle</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Birlikte ne yapmak istersiniz? (Örn: Kapadokya Balon Turu)"
              placeholderTextColor={theme.colors.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
            />

            <Text style={styles.sectionLabel}>KATEGORİ SEÇİN</Text>
            <View style={styles.catSelectRow}>
              {CATEGORIES.map(cat => {
                const IconComponent = cat.icon;
                const isSelected = selectedCat === cat.id;

                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catOption, isSelected && styles.catOptionSelected]}
                    onPress={() => setSelectedCat(cat.id)}
                    activeOpacity={0.8}
                  >
                    <IconComponent size={14} color={isSelected ? '#08080B' : theme.colors.goldLight} />
                    <Text style={[styles.catOptionText, isSelected && styles.catOptionTextSelected]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity 
              style={styles.saveBtn}
              onPress={handleAddPlan}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>Hayali Mühürle</Text>
            </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    overflow: 'hidden',
    marginBottom: 16,
  },
  summaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 16,
  },
  summaryLabel: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.gold,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 4,
  },
  summaryTitle: {
    fontFamily: theme.fonts.heading,
    color: theme.colors.textPrimary,
    fontSize: 20,
    letterSpacing: 0.5,
  },
  summarySub: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  addTriggerBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#121218',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterChipActive: {
    borderColor: theme.colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  filterChipText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  filterChipTextActive: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.goldLight,
  },
  listContent: {
    paddingBottom: 24,
    gap: 10,
  },
  planCard: {
    backgroundColor: '#111116',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planCardCompleted: {
    opacity: 0.55,
    backgroundColor: '#0D0D12',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  checkBtn: {
    padding: 2,
  },
  planTitle: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.textPrimary,
    fontSize: 14,
    marginBottom: 6,
  },
  planTitleCompleted: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },
  planMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#181822',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  catText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 10,
  },
  authorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#181822',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  authorText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 10,
  },
  deleteBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 13,
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
  input: {
    backgroundColor: '#09090C',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#FFF',
    padding: 14,
    fontFamily: theme.fonts.body,
    fontSize: 13,
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.gold,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  catSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  catOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#161620',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  catOptionSelected: {
    backgroundColor: theme.colors.gold,
    borderColor: theme.colors.gold,
  },
  catOptionText: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  catOptionTextSelected: {
    fontFamily: theme.fonts.bodyBold,
    color: '#08080B',
  },
  saveBtn: {
    backgroundColor: theme.colors.gold,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: theme.fonts.bodyBold,
    color: '#08080B',
    fontSize: 13,
  },
});