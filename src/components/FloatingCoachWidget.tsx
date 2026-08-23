import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, View, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticFeedback } from '../utils/haptics';

interface FloatingCoachWidgetProps {
  onPress: () => void;
  hasUnread?: boolean;
}

export function FloatingCoachWidget({ onPress, hasUnread = true }: FloatingCoachWidgetProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View
      style={{
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 95 : 85,
        right: 18,
        zIndex: 40,
      }}
      pointerEvents="box-none"
    >
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          onPress={() => {
            hapticFeedback.medium();
            onPress();
          }}
          activeOpacity={0.85}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#09090b',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: '#10b981',
            shadowColor: '#10b981',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.45,
            shadowRadius: 10,
            elevation: 12,
          }}
        >
          {/* Inner Glowing Gradient Disc */}
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#10b981',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#34d399',
            }}
          >
            <Ionicons name="sparkles" size={22} color="#ffffff" />
          </View>

          {/* Active Status Badge Dot */}
          {hasUnread && (
            <View
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: '#34d399',
                borderWidth: 2,
                borderColor: '#09090b',
              }}
            />
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
