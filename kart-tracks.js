/* Original compact kart circuits. Coordinates in metres; banking is gameplay authored. */
window.KartTracks={ids:['switchback','hairpin'],install(maps){
 const shared={...maps.circuit,S:1,W:8,bw:2.6,terrain:true,tn:1.5,curveType:'centripetal',karting:true,banking:.24,fogN:100,fogF:650};
 maps.switchback={...shared,ctrl:[[0,-70,0],[35,-70,0],[60,-55,1],[62,-35,2],[45,-22,2],[5,-22,1],[-8,-10,0],[0,4,0],[45,4,1],[60,18,2],[55,35,3],[30,46,4],[-5,44,3],[-25,60,2],[-55,54,1],[-68,30,0],[-52,5,0],[-42,-20,1],[-60,-38,1],[-60,-58,0],[-35,-70,0]],corners:[]};
 maps.hairpin={...shared,banking:.31,ctrl:[[-25,-60,0],[20,-60,0],[50,-45,1],[50,-20,3],[25,-10,4],[-25,-10,5],[-40,5,5],[-30,22,4],[15,22,3],[32,35,2],[18,55,1],[-22,65,0],[-58,55,1],[-75,32,2],[-65,8,3],[-80,-18,2],[-82,-42,0],[-60,-60,0]],corners:[]};
}};
