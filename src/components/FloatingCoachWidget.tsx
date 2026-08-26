import React, { useRef, useEffect } from 'react';
import {
  View,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { hapticFeedback } from '../utils/haptics';
import Svg, { Path } from 'react-native-svg';

interface FloatingCoachWidgetProps {
  onPress: () => void;
  hasUnread?: boolean;
}

const WIDGET_SIZE = 58;

export function FloatingCoachWidget({ onPress, hasUnread = true }: FloatingCoachWidgetProps) {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

  const MIN_X = 12;
  const MAX_X = SCREEN_WIDTH - WIDGET_SIZE - 12;
  const MIN_Y = Platform.OS === 'ios' ? 60 : 44;
  const MAX_Y = Platform.OS === 'ios' ? SCREEN_HEIGHT - 170 : SCREEN_HEIGHT - 150;

  const INITIAL_X = SCREEN_WIDTH - WIDGET_SIZE - 18;
  const INITIAL_Y = Platform.OS === 'ios' ? SCREEN_HEIGHT - 175 : SCREEN_HEIGHT - 155;

  const pan = useRef(new Animated.ValueXY({ x: INITIAL_X, y: INITIAL_Y })).current;
  const currentPos = useRef({ x: INITIAL_X, y: INITIAL_Y });
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Track position updates
  useEffect(() => {
    const listenerId = pan.addListener((val) => {
      currentPos.current = val;
    });
    return () => {
      pan.removeListener(listenerId);
    };
  }, [pan]);

  // Subtle breathing pulse animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
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
  }, [pulseAnim]);

  // 2D Drag PanResponder with edge-snapping and tap detection
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 2 || Math.abs(gesture.dy) > 2,

      onPanResponderGrant: () => {
        pan.setOffset({
          x: currentPos.current.x,
          y: currentPos.current.y,
        });
        pan.setValue({ x: 0, y: 0 });
        hapticFeedback.light();
      },

      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),

      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();

        // Tap detected (< 6px movement)
        if (Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6) {
          hapticFeedback.medium();
          onPress();
          return;
        }

        // Calculate snap-to-edge target X
        const midPoint = SCREEN_WIDTH / 2 - WIDGET_SIZE / 2;
        const targetX = currentPos.current.x < midPoint ? MIN_X : MAX_X;

        // Clamp target Y within safe bounds
        const targetY = Math.max(MIN_Y, Math.min(MAX_Y, currentPos.current.y));

        // Spring snap to edge
        Animated.spring(pan, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          friction: 6,
          tension: 40,
        }).start();

        currentPos.current = { x: targetX, y: targetY };
        hapticFeedback.selection();
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        left: pan.x,
        top: pan.y,
        zIndex: 9999,
        elevation: 9999,
      }}
    >
      <Animated.View
        style={{
          transform: [{ scale: pulseAnim }],
          alignItems: 'center',
        }}
      >
        {/* Vector Cat Ears perched on top */}
        <View style={{ width: WIDGET_SIZE, height: 12, position: 'relative', marginBottom: -2, zIndex: 1 }}>
          <Svg width={WIDGET_SIZE} height={12} viewBox="0 0 58 12">
            {/* Left Ear */}
            <Path d="M 8 12 L 14 1 L 22 12 Z" fill="#09090B" stroke="#10B981" strokeWidth="1.5" strokeLinejoin="round" />
            <Path d="M 11 11 L 14 3 L 19 11 Z" fill="#10B981" opacity={0.3} />
            {/* Right Ear */}
            <Path d="M 36 12 L 44 1 L 50 12 Z" fill="#09090B" stroke="#10B981" strokeWidth="1.5" strokeLinejoin="round" />
            <Path d="M 39 11 L 44 3 L 47 11 Z" fill="#10B981" opacity={0.3} />
          </Svg>
        </View>

        {/* Main Circular Mascot Bubble */}
        <View
          style={{
            width: WIDGET_SIZE,
            height: WIDGET_SIZE,
            borderRadius: WIDGET_SIZE / 2,
            backgroundColor: '#09090b',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: '#10b981',
            shadowColor: '#10b981',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.45,
            shadowRadius: 10,
            elevation: 14,
          }}
        >
          {/* Inner Glowing Disc with Sia Mascot */}
          <View
            style={{
              width: WIDGET_SIZE - 10,
              height: WIDGET_SIZE - 10,
              borderRadius: (WIDGET_SIZE - 10) / 2,
              backgroundColor: '#09090b',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderWidth: 1.5,
              borderColor: '#10b981',
            }}
          >
            <Animated.Image
              source={require('../../assets/images/logo.jpg')}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: (WIDGET_SIZE - 10) / 2,
              }}
              resizeMode="cover"
            />
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
        </View>
      </Animated.View>
    </Animated.View>
  );
}

