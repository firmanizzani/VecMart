<script lang="ts">
  export let size = 28;
  export let mascot = false;
</script>
<span class="assistant-avatar" class:mascot aria-hidden="true" style:width={`${size}px`} style:height={`${size}px`}>
  <span class="assistant-avatar-motion"><span class="assistant-robot-sprite"></span></span>
</span>
<style>
  .assistant-avatar { display: inline-flex; position: relative; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; border-radius: 50%; }
  .assistant-avatar.mascot { overflow: visible; border-radius: 0; }
  .assistant-avatar-motion { display: block; position: relative; width: 100%; height: 100%; transform-origin: 50% 80%; animation: robot-idle 9s ease-in-out 2s infinite; }
  .assistant-robot-sprite { display: block; position: absolute; inset: 0; width: 100%; height: 100%; background-image: url('/assistant-robot-sprite.png'); background-size: 200% 100%; background-position: 0% 0%; background-repeat: no-repeat; animation: robot-blink 7s steps(1,end) 1.5s infinite; }
  .assistant-avatar:not(.mascot) .assistant-robot-sprite { inset: auto; width: 165%; height: 165%; left: -32.5%; top: -8%; }
  @keyframes robot-idle { 0%,88%,100% { transform: translateY(0) rotate(0); } 92% { transform: translateY(-2px) rotate(-2deg); } 96% { transform: translateY(-.5px) rotate(1deg); } }
  @keyframes robot-blink { 0%,92%,96%,100% { background-position: 0% 0%; } 93%,95% { background-position: 100% 0%; } }
  @media (prefers-reduced-motion: reduce) { .assistant-avatar-motion, .assistant-robot-sprite { animation: none; } }
</style>
