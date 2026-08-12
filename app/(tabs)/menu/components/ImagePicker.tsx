/**
 * Menu/components/ImagePicker.tsx
 *
 * Reusable image field: tap to pick from the photo library, preview with a
 * crossfade, and replace/remove via a small action row.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ExpoImagePicker from 'expo-image-picker';
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react-native';

import { COLORS } from '../utils/theme';

export interface ImagePickerFieldProps {
  value: string | null;
  onChange: (uri: string | null) => void;
  /** Called with a message when picking fails, so the parent can toast. */
  onError?: (message: string) => void;
}

export function ImagePickerField({
  value,
  onChange,
  onError,
}: ImagePickerFieldProps): React.JSX.Element {
  const [displayedUri, setDisplayedUri] = useState<string | null>(value);
  const crossfade = useRef(new Animated.Value(1)).current;

  // Crossfade whenever the selected image changes.
  useEffect(() => {
    if (value === displayedUri) return;
    Animated.sequence([
      Animated.timing(crossfade, {
        toValue: 0,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(crossfade, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    const swap = setTimeout(() => setDisplayedUri(value), 120);
    return () => clearTimeout(swap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const pickImage = useCallback(async () => {
    try {
      const permission = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        onError?.('Photo access is needed to add an image.');
        return;
      }
      const result = await ExpoImagePicker.launchImageLibraryAsync({
        mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        onChange(result.assets[0].uri);
      }
    } catch {
      onError?.("We couldn't open your photo library.");
    }
  }, [onChange, onError]);

  const removeImage = useCallback(() => onChange(null), [onChange]);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={pickImage}
        accessibilityRole="button"
        accessibilityLabel={value ? 'Replace image' : 'Add image'}
      >
        <Animated.View style={[styles.imageCard, { opacity: crossfade }]}>
          {displayedUri ? (
            <Image source={{ uri: displayedUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <View style={styles.placeholderIcon}>
                <ImagePlus size={26} color={COLORS.primaryDark} strokeWidth={1.9} />
              </View>
              <Text style={styles.placeholderTitle}>Add a photo</Text>
              <Text style={styles.placeholderSubtitle}>Tap to choose from your library</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>

      {value ? (
        <View style={styles.actionsRow}>
          <Pressable
            onPress={pickImage}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Replace image"
          >
            <View style={styles.actionChip}>
              <RefreshCw size={13} color={COLORS.primaryDark} strokeWidth={2.4} />
              <Text style={styles.actionChipText}>Replace</Text>
            </View>
          </Pressable>
          <Pressable
            onPress={removeImage}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Remove image"
          >
            <View style={[styles.actionChip, styles.actionChipDanger]}>
              <Trash2 size={13} color={COLORS.error} strokeWidth={2.4} />
              <Text style={[styles.actionChipText, styles.actionChipTextDanger]}>Remove</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  imageCard: {
    height: 190,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderTitle: { marginTop: 12, fontSize: 15.5, fontWeight: '700', color: COLORS.text },
  placeholderSubtitle: { marginTop: 3, fontSize: 13, color: COLORS.textMuted },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: COLORS.primaryFaint,
  },
  actionChipDanger: { backgroundColor: COLORS.errorSoft },
  actionChipText: { fontSize: 13, fontWeight: '700', color: COLORS.primaryDark },
  actionChipTextDanger: { color: COLORS.error },
});

export default ImagePickerField;