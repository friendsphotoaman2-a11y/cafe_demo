import { MenuItem } from '@/types/database';

/**
 * Checks if a menu item is currently within its meal timing window using Asia/Kolkata time.
 * If outside the breakfast/lunch window, returns false (so the item can be hidden).
 */
export function isItemInMealWindow(item: MenuItem): boolean {
  if (!item.meal_timing || item.meal_timing === 'all_day') {
    return true;
  }

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.format(now).split(':');
    const hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    const currentMins = hour * 60 + minute;

    // Breakfast window: 07:00 to 11:30 (420 to 690 mins)
    if (item.meal_timing === 'breakfast') {
      return currentMins >= 420 && currentMins <= 690;
    }

    // Lunch window: 12:00 to 16:00 (720 to 960 mins)
    if (item.meal_timing === 'lunch') {
      return currentMins >= 720 && currentMins <= 960;
    }

    return true;
  } catch {
    // Fallback if Intl timeZone fails
    return true;
  }
}

/**
 * Checks if a menu item is available today.
 * Checks both is_available and is_available_today properties.
 */
export function isItemAvailableToday(item: MenuItem): boolean {
  const itemAny = item as unknown as Record<string, unknown>;
  if (itemAny.is_available === false || itemAny.is_available_today === false) {
    return false;
  }
  return true;
}
