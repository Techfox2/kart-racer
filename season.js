// UTC calendar shared by login, lobby images and the seasonal kart livery.
window.KartSeason=(()=>{
 const calendar=(date=new Date())=>date.getUTCMonth()===11;
 const active=(date=new Date())=>calendar(date)||!!(window.KART_ACCOUNT?.developer?.role&&window.KART_ACCOUNT.developer.christmasPreview);
 const background=(kind,date=new Date())=>'assets/backgrounds/'+(kind==='multiplayer'?(active(date)?'multiplayer-grid-christmas-v2':'multiplayer-grid-v2'):kind==='login'?(active(date)?'multiplayer-christmas-v1':'multiplayer-garage-v2'):(active(date)?'singleplayer-christmas-v1':'singleplayer-pitlane-v2'))+'.webp';
 let previous=active();
 function sync(force=false){const now=active();document.documentElement.style.setProperty('--login-background','url("'+background('login')+'")');if(now!==previous||force===true){previous=now;dispatchEvent(new Event('kart-season-change'))}}
 sync();setInterval(sync,30000);addEventListener('visibilitychange',sync);
 return {active,calendar,sync,background,skin:id=>id==='christmas'&&active()?'christmas':'original'};
})();
