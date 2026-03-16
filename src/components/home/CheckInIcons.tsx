import { Icon } from '@iconify/react';

interface IconProps {
  color: string;
}

// Sleep icons
export function SleepPoor({ color }: IconProps) {
  return <Icon icon="mdi:bed" width={24} height={24} color={color} />;
}
export function SleepFair({ color }: IconProps) {
  return <Icon icon="mdi:bed-clock" width={24} height={24} color={color} />;
}
export function SleepGood({ color }: IconProps) {
  return <Icon icon="mdi:sleep" width={24} height={24} color={color} />;
}
export function SleepGreat({ color }: IconProps) {
  return <Icon icon="mdi:bed-king" width={24} height={24} color={color} />;
}
export function SleepDeep({ color }: IconProps) {
  return <Icon icon="mdi:weather-night" width={24} height={24} color={color} />;
}

// Mood icons
export function MoodAwful({ color }: IconProps) {
  return <Icon icon="mdi:emoticon-angry-outline" width={24} height={24} color={color} />;
}
export function MoodBad({ color }: IconProps) {
  return <Icon icon="mdi:emoticon-sad-outline" width={24} height={24} color={color} />;
}
export function MoodMeh({ color }: IconProps) {
  return <Icon icon="mdi:emoticon-neutral-outline" width={24} height={24} color={color} />;
}
export function MoodGood({ color }: IconProps) {
  return <Icon icon="mdi:emoticon-happy-outline" width={24} height={24} color={color} />;
}
export function MoodAwesome({ color }: IconProps) {
  return <Icon icon="mdi:emoticon-excited-outline" width={24} height={24} color={color} />;
}

// Energy icons — battery fill levels
export function EnergyDrained({ color }: IconProps) {
  return <Icon icon="mdi:battery-outline" width={24} height={24} color={color} />;
}
export function EnergyLow({ color }: IconProps) {
  return <Icon icon="mdi:battery-low" width={24} height={24} color={color} />;
}
export function EnergyMedium({ color }: IconProps) {
  return <Icon icon="mdi:battery-medium" width={24} height={24} color={color} />;
}
export function EnergyActive({ color }: IconProps) {
  return <Icon icon="mdi:battery-high" width={24} height={24} color={color} />;
}
export function EnergyCharged({ color }: IconProps) {
  return <Icon icon="mdi:battery" width={24} height={24} color={color} />;
}

// Stress icons
export function StressExtreme({ color }: IconProps) {
  return <Icon icon="mdi:emoticon-dead-outline" width={24} height={24} color={color} />;
}
export function StressHigh({ color }: IconProps) {
  return <Icon icon="mdi:emoticon-confused-outline" width={24} height={24} color={color} />;
}
export function StressNeutral({ color }: IconProps) {
  return <Icon icon="mdi:emoticon-neutral-outline" width={24} height={24} color={color} />;
}
export function StressCalm({ color }: IconProps) {
  return <Icon icon="mdi:emoticon-cool-outline" width={24} height={24} color={color} />;
}
export function StressZen({ color }: IconProps) {
  return <Icon icon="mdi:meditation" width={24} height={24} color={color} />;
}
