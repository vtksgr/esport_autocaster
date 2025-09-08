<script setup>
import { ref } from 'vue';

import ObsConnectStatus from '../ui/ObsConnectStatus.vue';
import ObsSceneCollection from '../ui/ObsSceneCollection.vue';
import ObsStreamController from '../ui/ObsStreamController.vue';
import ObsRecordController from '../ui/ObsRecordController.vue';
import ObsProgramDisplay from '../ui/ObsProgramDisplay.vue';
import ObsSceneList from '../ui/ObsSceneList.vue';
import ObsSourceList from '../ui/ObsSourceList.vue';
import RtmpStatus from '../ui/RtmpStatus.vue';

const selectedScene = ref('');

</script>

<template>
    <div class="flex gap-4 justify-between items-start">
        <div>
            <ObsConnectStatus />
        </div>
        <RtmpStatus />
        <div class="flex gap-4">
            <ObsSceneCollection />
            <ObsStreamController />
            <ObsRecordController />
        </div>
    </div>
    <div class="flex gap-4 mt-4">
        <ObsSceneList @scene:select="selectedScene = $event" />
        <ObsSourceList :scene-name="selectedScene" />
        <ObsProgramDisplay />
    </div>
    
</template>