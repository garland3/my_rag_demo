<template>
  <div id="app">
    <RAGApp />
  </div>
</template>

<script>
import RAGApp from './components/RAGApp.vue'

export default {
  name: 'App',
  components: {
    RAGApp
  }
}
</script>

<style>
@import './assets/tailwind.css';
</style>