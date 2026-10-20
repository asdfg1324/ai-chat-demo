import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '@/views/ChatView.vue'
import Workflow from '@/views/Workflow.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'Chat', component: ChatView },
    { path: '/workflow', name: 'Workflow', component: Workflow },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
})

export default router