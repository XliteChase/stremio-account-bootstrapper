import { ref, type Ref } from 'vue';

export type NotificationType = 'info' | 'success' | 'error' | 'warning';

export interface NotificationEntry {
  id: number;
  text: string;
  type: NotificationType | string;
}

export const notifications: Ref<NotificationEntry[]> = ref([]);

export const addNotification = (
  text: string,
  type: NotificationType | string = 'info'
): number => {
  const id = Date.now() + Math.random();
  notifications.value.push({ id, text, type });

  setTimeout(() => {
    removeNotification(id);
  }, 10000);

  return id;
};

export const removeNotification = (id: number) => {
  notifications.value = notifications.value.filter((n) => n.id !== id);
};
