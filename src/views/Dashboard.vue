<script setup>
import ObsConnectStatus from '../ui/ObsConnectStatus.vue';
import ObsSceneCollection from '../ui/ObsSceneCollection.vue';
import ObsStreamController from '../ui/ObsStreamController.vue';
import ObsRecordController from '../ui/ObsRecordController.vue';
import ObsProgramDisplay from '../ui/ObsProgramDisplay.vue';

</script>

<template>
    <div class="flex gap-4 justify-between items-start">
        <div>
            <ObsConnectStatus />
        </div>
        <div class="flex gap-4">
            <ObsSceneCollection />
            <ObsStreamController />
            <ObsRecordController />
        </div>
    </div>
    <div>
        <ObsProgramDisplay />
    </div>

</template>