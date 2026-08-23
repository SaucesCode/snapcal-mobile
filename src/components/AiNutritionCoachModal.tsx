import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Keyboard,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sendNutritionCoachMessage, ChatMessage, UserNutritionContext } from '../services/aiService';
import { hapticFeedback } from '../utils/haptics';

interface AiNutritionCoachModalProps {
  visible: boolean;
  onClose: () => void;
  userContext: UserNutritionContext;
}

const QUICK_PROMPTS = [
  '🍲 What can I eat for dinner with my remaining macros?',
  '🥩 High-protein snacks under 200 calories',
  '🥗 Fast food meals that fit my calorie target',
  '⚖️ Am I eating enough protein for muscle retention?',
  '⚡ Quick pre-workout meal suggestion',
];

/**
 * Parses markdown bold (**text**) and renders clean styled Text components
 * without showing raw markdown asterisks (**)
 */
function FormattedChatMessage({ content, isUser }: { content: string; isUser: boolean }) {
  const lines = content.split('\n');

  return (
    <View>
      {lines.map((line, lineIndex) => {
        const trimmed = line.trim();
        const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const isHeader = trimmed.startsWith('💡') || trimmed.startsWith('📊') || trimmed.startsWith('📝') || trimmed.startsWith('###');

        // Split line by **bold** tokens
        const parts = line.split(/(\*\*.*?\*\*)/g);

        return (
          <Text
            key={lineIndex}
            className={`text-xs leading-5 ${
              lineIndex > 0 ? 'mt-1' : ''
            } ${
              isUser
                ? 'text-white font-medium'
                : isHeader
                ? 'text-zinc-100 font-semibold'
                : isBullet
                ? 'text-zinc-200 pl-1'
                : 'text-zinc-300'
            }`}
          >
            {parts.map((part, partIndex) => {
              if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                const boldText = part.slice(2, -2);
                return (
                  <Text
                    key={partIndex}
                    style={{ fontFamily: 'Outfit_700Bold' }}
                    className={isUser ? 'text-white font-extrabold' : 'text-emerald-400 font-extrabold'}
                  >
                    {boldText}
                  </Text>
                );
              }
              // Clean any stray markdown asterisks
              const cleanPart = part.replace(/\*\*/g, '');
              return <Text key={partIndex}>{cleanPart}</Text>;
            })}
          </Text>
        );
      })}
    </View>
  );
}

export function AiNutritionCoachModal({
  visible,
  onClose,
  userContext,
}: AiNutritionCoachModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView | null>(null);

  // Initialize greeting with live telemetry context
  useEffect(() => {
    if (visible && messages.length === 0) {
      const remainingCal = userContext.remainingCalories ?? 2000;
      const remainingProt = userContext.remainingProtein ?? 150;
      const greeting: ChatMessage = {
        id: 'initial_greeting',
        role: 'assistant',
        content: `Hey ${userContext.displayName || 'Athlete'}! I'm your dedicated SnapCal Nutrition Coach.\n\n📊 **Your Live Status Today:**\n• **${remainingCal} kcal** remaining\n• **${remainingProt}g protein** remaining\n\nAsk me for meal ideas, macro swaps, or dietary advice to hit your targets today!`,
        timestamp: new Date().toISOString(),
      };
      setMessages([greeting]);
    }
  }, [visible]);

  // Robust native keyboard listener for both iOS and Android
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e?.endCoordinates?.height || 0;
      if (height > 0) {
        setKeyboardHeight(height);
      }
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Auto scroll on new messages
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, visible]);

  if (!visible) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent || isTyping) return;

    hapticFeedback.light();
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputText('');
    setIsTyping(true);

    try {
      const conversationPayload = newHistory.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const reply = await sendNutritionCoachMessage(conversationPayload, userContext);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      };

      hapticFeedback.success();
      setMessages([...newHistory, assistantMsg]);
    } catch (err: any) {
      hapticFeedback.error();
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ ${err.message || 'Unable to connect with AI coach. Please try again.'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages([...newHistory, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const remainingCal = userContext.remainingCalories ?? 2000;
  const remainingProt = userContext.remainingProtein ?? 150;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'flex-end',
      }}
    >
      {/* 1. Absolute Backdrop Overlay - tap to dismiss keyboard & modal */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Main High-Impact Bottom Sheet (86% Height, padded flush above keyboard) */}
      <View
        style={{
          height: '86%',
          backgroundColor: '#18181b',
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          borderTopWidth: 1,
          borderColor: '#27272a',
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom:
            keyboardHeight > 0
              ? (Platform.OS === 'ios' ? keyboardHeight + 2 : Math.max(8, keyboardHeight - 28))
              : (Platform.OS === 'ios' ? 30 : 16),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
          elevation: 24,
        }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between pb-3 border-b border-zinc-800/80">
          <View className="flex-row items-center gap-2.5">
            <View className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 items-center justify-center">
              <Ionicons name="sparkles" size={16} color="#10b981" />
            </View>
            <View>
              <Text
                style={{ fontFamily: 'Outfit_700Bold' }}
                className="text-white text-base"
              >
                SnapCal AI Coach
              </Text>
              <Text className="text-zinc-500 text-[10px] font-semibold">
                Personalized Nutrition & Meal Guidance
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              Keyboard.dismiss();
              hapticFeedback.light();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-zinc-800 items-center justify-center"
          >
            <Ionicons name="close" size={16} color="#a1a1aa" />
          </TouchableOpacity>
        </View>

        {/* Compact Telemetry Context Ribbon */}
        <View className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-3.5 py-2 my-2.5 flex-row items-center justify-between">
          <View className="flex-row items-center gap-1.5">
            <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <Text className="text-zinc-400 text-[11px] font-bold">
              Remaining: <Text className="text-white font-extrabold">{remainingCal} kcal</Text>
            </Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <View className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <Text className="text-zinc-400 text-[11px] font-bold">
              Protein: <Text className="text-sky-400 font-extrabold">{remainingProt}g</Text>
            </Text>
          </View>
        </View>

        {/* Chat Messages List */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 py-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 10 }}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              className={`mb-3 flex-row ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <View className="w-6 h-6 rounded-lg bg-emerald-500/20 items-center justify-center mr-2 mt-1">
                  <Ionicons name="sparkles" size={12} color="#10b981" />
                </View>
              )}

              <View
                className={`max-w-[84%] rounded-2xl p-3.5 ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 rounded-tr-sm shadow-md shadow-emerald-600/20'
                    : 'bg-zinc-950 border border-zinc-800/90 rounded-tl-sm shadow-sm'
                }`}
              >
                <FormattedChatMessage content={msg.content} isUser={msg.role === 'user'} />
              </View>
            </View>
          ))}

          {isTyping && (
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-6 h-6 rounded-lg bg-emerald-500/20 items-center justify-center">
                <Ionicons name="sparkles" size={12} color="#10b981" />
              </View>
              <View className="bg-zinc-950 border border-zinc-800 p-3 rounded-2xl flex-row items-center gap-1.5">
                <ActivityIndicator size="small" color="#10b981" />
                <Text className="text-zinc-500 text-xs font-semibold">Coach is crafting your nutrition advice...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick Suggestion Chips */}
        <View className="mb-2.5">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            className="flex-row"
          >
            {QUICK_PROMPTS.map((prompt, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => handleSendMessage(prompt)}
                disabled={isTyping}
                className="bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl mr-2"
              >
                <Text className="text-zinc-300 text-[11px] font-medium">{prompt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Input Bar (Directly Above Keyboard) */}
        <View className="flex-row items-center bg-zinc-950 border border-zinc-800 rounded-2xl p-1.5 pr-2">
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about meals, macros, or food choices..."
            placeholderTextColor="#52525b"
            multiline
            maxLength={250}
            className="flex-1 text-white text-xs px-3 py-2 max-h-20"
            editable={!isTyping}
          />

          <TouchableOpacity
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim() || isTyping}
            activeOpacity={0.8}
            className={`w-9 h-9 rounded-xl items-center justify-center ${
              inputText.trim() && !isTyping ? 'bg-emerald-500' : 'bg-zinc-800 opacity-50'
            }`}
          >
            <Ionicons name="arrow-up" size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
