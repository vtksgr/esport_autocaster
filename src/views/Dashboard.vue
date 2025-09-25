<script setup>
import { ref } from 'vue';

import ObsConnectStatus from '../ui/ObsConnectStatus.vue';
import ObsSceneCollection from '../ui/ObsSceneCollection.vue';
import StreamBtn from '../ui/StreamBtn.vue';
import RecordBtn from '../ui/RecordBtn.vue';
import ObsProgramDisplay from '../ui/ObsProgramDisplay.vue';
import ObsSceneList from '../ui/ObsSceneList.vue';
import ObsSourceList from '../ui/ObsSourceList.vue';
import ReloadBtn from '../ui/ReloadBtn.vue';


const selectedScene = ref('');

</script>

<template>
    <div class="flex bg-slate-700 p-2 rounded gap-3 justify-between items-start border border-slate-600">
        <div class="flex items-center ">
            <ObsConnectStatus /> 
            <ReloadBtn class="ml-2" :title="'Reload App'" :iconSize="15" />
        </div>
        
        <div class="flex gap-4">
            <ObsSceneCollection />
            <StreamBtn />
            <RecordBtn />
        </div>
    </div>
    <div class="flex gap-4 mt-4">
        <ObsSceneList @scene:select="selectedScene = $event" />
        <ObsSourceList :scene-name="selectedScene" />
        <ObsProgramDisplay />
    </div>
    
</template>