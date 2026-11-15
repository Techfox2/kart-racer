(()=>{'use strict';
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),panel=document.getElementById('panel');
function gear(){const open=panel.classList.contains('on');for(const id of ['setBtn','gear']){const button=document.getElementById(id);button.classList.toggle('settings-open',open);button.setAttribute('aria-expanded',String(open))}}
new MutationObserver(gear).observe(panel,{attributes:true,attributeFilter:['class']});gear();
const settingsTabs=document.getElementById('settingsTabs');
settingsTabs.addEventListener('wheel',e=>{if(e.ctrlKey||settingsTabs.scrollWidth<=settingsTabs.clientWidth||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?settingsTabs.clientWidth:1),next=Math.max(0,Math.min(settingsTabs.scrollWidth-settingsTabs.clientWidth,settingsTabs.scrollLeft+delta));if(next!==settingsTabs.scrollLeft){e.preventDefault();settingsTabs.scrollLeft=next}},{passive:false});
settingsTabs.addEventListener('focusin',e=>{if(e.target.matches('button'))KartUI.revealTab(e.target,false)});
document.addEventListener('click',e=>{const button=e.target.closest('.seg button,.card-btn');if(!button||button.disabled||reduced.matches)return;button.animate([{filter:'brightness(1)'},{filter:'brightness(1.22)'},{filter:'brightness(1)'}],{duration:260,easing:'ease-out'})});
})();
