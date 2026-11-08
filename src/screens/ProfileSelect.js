import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Gem } from 'lucide-react-native';
import { UserContext } from '../context/UserContext';
import { theme } from '../theme/colors';

export default function ProfileSelect() {
  const { selectUser } = useContext(UserContext);

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>BİZİM DÜNYAMIZ</Text>
      <Text style={styles.title}>Her Şey Sensin</Text>
      <Text style={styles.instruction}>Bu cihazı kim kullanıyor?</Text>

      <View style={styles.buttonContainer}>
        {/* Atakan Kartı */}
        <TouchableOpacity 
          activeOpacity={0.8} 
          style={styles.card}
          onPress={() => selectUser('atakan')}
        >
          <LinearGradient
            colors={['#181822', '#0E0E14']}
            style={styles.cardGradient}
          >
            <View style={styles.iconCircle}>
              <Crown size={32} color={theme.colors.gold} strokeWidth={1.8} />
            </View>
            <Text style={styles.name}>Atakan</Text>
            <Text style={styles.tag}>KORUYUCU</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Cemre Kartı */}
        <TouchableOpacity 
          activeOpacity={0.8} 
          style={styles.card}
          onPress={() => selectUser('cemre')}
        >
          <LinearGradient
            colors={['#181822', '#0E0E14']}
            style={styles.cardGradient}
          >
            <View style={[styles.iconCircle, { borderColor: 'rgba(100, 210, 255, 0.3)' }]}>
              <Gem size={30} color="#70D6FF" strokeWidth={1.8} />
            </View>
            <Text style={styles.name}>Cemre</Text>
            <Text style={[styles.tag, { color: '#70D6FF' }]}>IŞILTILI</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  subtitle: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.gold,
    letterSpacing: 4,
    fontSize: 11,
    marginBottom: 8,
  },
  title: {
    fontFamily: theme.fonts.heading,
    color: theme.colors.textPrimary,
    fontSize: 30,
    marginBottom: 10,
    letterSpacing: 1.5,
  },
  instruction: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 44,
  },
  buttonContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  card: {
    flex: 1,
    height: 180,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    overflow: 'hidden',
  },
  cardGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#121218',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  name: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.textPrimary,
    fontSize: 18,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tag: {
    fontFamily: theme.fonts.bodyBold,
    color: theme.colors.goldLight,
    fontSize: 10,
    letterSpacing: 2,
    opacity: 0.75,
  },
});