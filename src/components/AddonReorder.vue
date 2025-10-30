<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import draggable from 'vuedraggable';
import AddonItem from './AddonItem.vue';
import { getAddonCollection, setAddonCollection } from '../api/stremioApi';
import { addNotification } from '../composables/useNotifications';
import { useAnalytics } from '../composables/useAnalytics';

interface ManagedAddon {
  __key: string;
  [key: string]: any;
}

const props = defineProps<{
  stremioAuthKey?: string;
}>();

const { t } = useI18n();
const { track } = useAnalytics();

const addons = ref<ManagedAddon[]>([]);
const isImporting = ref(false);
const isReinstalling = ref(false);
const noop = () => undefined;

const hasAddons = computed(() => addons.value.length > 0);
const hasAuthKey = computed(() => Boolean(props.stremioAuthKey));
const isImportDisabled = computed(
  () => !hasAuthKey.value || isImporting.value || isReinstalling.value
);
const isReinstallDisabled = computed(
  () =>
    !hasAuthKey.value ||
    !hasAddons.value ||
    isImporting.value ||
    isReinstalling.value
);

watch(
  () => props.stremioAuthKey,
  (newKey) => {
    if (!newKey) {
      addons.value = [];
    }
  }
);

function createAddonKey(addon: Record<string, any>, index: number) {
  const manifestId = addon?.manifest?.id;
  const name = addon?.manifest?.name;
  const transportUrl = addon?.transportUrl || addon?.transport;

  return [manifestId, name, transportUrl, index].filter(Boolean).join('::');
}

function normalizeAddons(loadedAddons: any[]): ManagedAddon[] {
  return loadedAddons
    .filter((addon) => Boolean(addon))
    .map((addon, index) => {
      const clonedAddon = JSON.parse(JSON.stringify(addon));
      return {
        ...clonedAddon,
        __key: createAddonKey(clonedAddon, index)
      };
    });
}

async function importInstalledAddons() {
  if (!hasAuthKey.value || !props.stremioAuthKey) {
    addNotification(t('auth_key_required'), 'error');
    return;
  }

  isImporting.value = true;

  try {
    const response = await getAddonCollection(props.stremioAuthKey);
    const loadedAddons = response?.result?.addons;

    if (!Array.isArray(loadedAddons)) {
      throw new Error(t('import_addons_failed'));
    }

    addons.value = normalizeAddons(loadedAddons);

    addNotification(t('addons_imported'), 'success');
    track('import_installed_addons_click', {
      title: 'Import installed addons',
      vars: {
        count: String(addons.value.length)
      }
    });
  } catch (error: any) {
    const message = error?.message || t('import_addons_failed');
    addNotification(message, 'error');
  } finally {
    isImporting.value = false;
  }
}

async function reinstallAddonsInOrder() {
  if (!hasAuthKey.value || !props.stremioAuthKey) {
    addNotification(t('auth_key_required'), 'error');
    return;
  }

  if (!hasAddons.value) {
    addNotification(t('no_addons_loaded'), 'error');
    return;
  }

  isReinstalling.value = true;

  try {
    const payload = addons.value.map(({ __key, ...rest }) => ({
      ...rest
    }));

    const response = await setAddonCollection(payload, props.stremioAuthKey);

    if (!response?.result?.success) {
      throw new Error(response?.result?.error || t('reinstall_failed'));
    }

    addNotification(t('reinstall_successful'), 'success');
    track('reinstall_addons_click', {
      title: 'Reinstall addons in order',
      vars: {
        count: String(payload.length)
      }
    });
  } catch (error: any) {
    const message = error?.message || t('reinstall_failed');
    addNotification(message, 'error');
  } finally {
    isReinstalling.value = false;
  }
}
</script>

<template>
  <section id="reorder" class="max-w-4xl mx-auto p-4">
    <h2 class="text-2xl font-bold mb-2">
      {{ $t('reorder_addons_title') }}
    </h2>
    <p class="mb-6 text-base-content/80">
      {{ $t('reorder_addons_description') }}
    </p>

    <div class="bg-base-100 p-6 rounded-lg border border-base-300 space-y-4">
      <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <button
            class="btn btn-outline"
            :disabled="isImportDisabled"
            @click="importInstalledAddons"
          >
            <span v-if="isImporting" class="loading loading-spinner loading-sm"></span>
            <span>
              {{ isImporting ? $t('importing_installed_addons') : $t('import_installed_addons') }}
            </span>
          </button>
          <button
            class="btn btn-primary"
            :disabled="isReinstallDisabled"
            @click="reinstallAddonsInOrder"
          >
            <span v-if="isReinstalling" class="loading loading-spinner loading-sm"></span>
            <span>
              {{
                isReinstalling
                  ? $t('reinstalling_addons')
                  : $t('reinstall_addons_in_order')
              }}
            </span>
          </button>
        </div>
      </div>

      <p v-if="!addons.length && !isImporting" class="text-base-content/70">
        {{ $t('reorder_list_helper') }}
      </p>

      <draggable
        v-else
        v-model="addons"
        item-key="__key"
        class="min-h-[3rem]"
        ghost-class="opacity-60"
        :disabled="isReinstalling"
      >
        <template #item="{ element, index }">
          <AddonItem
            :idx="index"
            :name="element?.manifest?.name || element?.manifest?.id || 'Addon'"
            :manifestURL="element?.transportUrl || element?.transport || ''"
            :logoURL="element?.manifest?.logo"
            :isDeletable="false"
            @delete-addon="noop"
            @edit-manifest="noop"
          />
        </template>
      </draggable>
    </div>
  </section>
</template>
